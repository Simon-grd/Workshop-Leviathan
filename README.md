# Léviathan v2 : Proxmox, playbook de crise et deux interfaces

> Workshop 2026 · B3 · Groupe G<6>

Cette version remplace la logique Docker SDK par un contrôle Proxmox via MQTT et un playbook de crise dédié. Le système coupe les services des pools secondaires puis applique la procédure de redémarrage humaine avec validation à deux officiers.

## Flux de bout en bout

```text
ESP32 (capteur feu) ──MQTT──▶ Mosquitto (VLAN 10) ◀──MQTT── API Python ◀── Interface 2 (scénarios)
                                    │                            │
                                    ▼                            ▼
                             Playbook Python              WebSocket ──▶ Interface 1 (schéma + alertes)
                                    │ proxmoxer (token restreint)
                                    ▼
                    Proxmox : kill des CT du pool VLAN 20 (puis VLAN 30 si crise énergétique)
```

Le lanceur de scénarios publie le même message qu'un ESP32. La démo passe donc par le vrai chemin du système et un vrai capteur peut être branché sans modifier l'API.

## Structure du dépôt

```text
Workshop-Leviathan/
├── web/              # Next.js : /ship et /scenarios
├── api/              # FastAPI : REST, WebSocket, auth 2FA, relais MQTT, PostgreSQL
├── playbook/         # Script Python : MQTT → proxmoxer
├── firmware/         # ESP32 / capteur feu
├── infra/            # Runbooks Proxmox/Ceph/VLAN, scripts pveum
├── docs/             # Architecture, contrat d'API, conventions
├── .env.example      # Variables d'environnement (copier en .env, jamais commit)
├── README.md
├── hypervisor/       # Ancien dossier v1 (mémoire historique)
├── terminal/         # Ancien dossier v1 (mémoire historique)
├── simulator/        # Legacy v1, hors périmètre de la v2
└── {hypervisor,terminal/}  # ancien arborescence non utilisée
```

## Les deux interfaces

### Interface 1 : /ship
- Schéma SVG du vaisseau, zones cliquables : Passerelle, Support vie, Salle serveurs, Laboratoire, Loisirs
- Couleurs : vert (OK), orange (alerte), rouge (incendie), gris (conteneurs coupés)
- Journal en direct des étapes du playbook
- Données WebSocket de l'API : état des CT par pool + alertes MQTT

### Interface 2 : /scenarios
- Boutons : incendie laboratoire, perte d'énergie 80 %, reset de la démo
- Appel de `POST /scenarios/{nom}` (authentifié)
- Publication du même message MQTT qu'un vrai capteur

## Infra : préparation du terrain

- 3 nœuds Proxmox minimum, chacun avec un disque dédié pour un OSD Ceph
- Pool Ceph RBD `vital-pool` avec `size=3` et `min_size=2`
- CT vitaux sous HA, hors des pools VLAN 20/30
- VLAN 10 critique, VLAN 20 laboratoire, VLAN 30 loisirs
- Firewall datacenter avec règles de quarantaine
- Token Proxmox restreint avec `privsep=1` et ACL sur `lab-vlan20` et `loisirs-vlan30`

## Points critiques à respecter

- Le HA peut relancer un CT immédiatement après un `stop` ; seuls les CT vitaux doivent être sous HA.
- Il faut deux ACL pour le token : sur l'utilisateur et sur le token lui-même.
- Le redémarrage des systèmes coupés doit rester sous validation humaine à double officier.
- `status/stop` est bien le bon appel pour un kill immédiat ; `shutdown` est propre mais trop lent.
- Le playbook est vital : il doit tourner dans le VLAN 10, sous HA.
- Le secret du token Proxmox ne doit jamais aller dans Git.

## Documentation technique

- [docs/architecture.md](docs/architecture.md)
- [docs/api-contract.md](docs/api-contract.md)
- [docs/conventions.md](docs/conventions.md)

## Répartition par binôme

| Profil | Mission |
|---|---|
| Infra système | Cluster Proxmox, Ceph, HA des CT vitaux, réplique PostgreSQL, pools, token |
| Infra réseau | Bridge VLAN-aware, firewall, isolation, accès ESP32 |
| Dev 1 | Playbook, contrat MQTT, firmware ESP32, tests `DRY_RUN` |
| Dev 2 | Next.js `/ship` et `/scenarios`, API FastAPI + WebSocket, auth 2FA |

> Les dossiers `hypervisor/`, `terminal/` et `simulator/` de la v1 restent présents uniquement en mémoire historique. La v2 s'appuie sur `api/`, `web/`, `playbook/`, `firmware/` et `infra/`.
