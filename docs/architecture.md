# Architecture (v2)

## Flux principal

1. Un **ESP32** détecte un incendie dans le laboratoire et publie sur MQTT : `leviathan/sensors/lab/fire`.
2. Le **broker Mosquitto** (VLAN 10) reçoit le message et le relaye vers l'API Python.
3. L'**API FastAPI** valide le message, le publie sur le WebSocket de l'interface `/ship` et le transmet au playbook de crise.
4. Le **playbook** écoute le même contrat MQTT et exécute l'action Proxmox sur les pools autorisés.
5. Le playbook tue les CT du pool `lab-vlan20` puis, si nécessaire, ceux du pool `loisirs-vlan30` lors d'une crise énergétique.
6. L'**interface 1** affiche le schéma du vaisseau, les zones impactées et les alertes en direct ; l'**interface 2** permet de lancer des scénarios depuis le navigateur.

## Schéma fonctionnel

```text
ESP32 / scénario navigateur
          │
          ▼
      MQTT broker
          │
          ├──▶ API FastAPI (relais + WebSocket)
          │          │
          │          ├──▶ Interface 1 /ship
          │          └──▶ stockage / logs / PostgreSQL
          │
          └──▶ Playbook Python
                     │
                     ▼
                 Proxmox VE
                 ├── pool lab-vlan20
                 ├── pool loisirs-vlan30
                 └── CT vitaux hors pool (HA / critical)
```

## Répartition réseau

| VLAN | Réseau | Contenu |
|---|---|---|
| 10 | 10.10.10.0/24 | Next.js, API, PostgreSQL, Mosquitto, playbook |
| 20 | 10.10.20.0/24 | CT Debian/Alpine secondaires (Laboratoire) |
| 30 | 10.10.30.0/24 | CT Debian/Alpine secondaires (Loisirs) |

Les zones critiques (passerelle, support vie, salle serveurs) sont considérées comme VLAN 10 et ne doivent pas être dans les pools secondaires arrêtés.

## Points techniques clés

- **Fail-safe** : si le playbook n'a plus accès à Proxmox, il ne décide rien sur les CT vitaux et logue une alerte.
- **Anti-faux positif** : le playbook attend une confirmation de tâche Proxmox avant de déclarer un arrêt effectif.
- **Auditabilité** : chaque scénario est journalisé dans l'API et relayé en WebSocket.
- **Deux officiers** : le redémarrage des services coupés reste sous validation humaine, selon le principe du double contrôle.

## Pièges à anticiper

- Le HA de Proxmox peut relancer un CT après un arrêt ; seuls les CT vitaux doivent être sous HA.
- Les ACL du token Proxmox doivent être ajoutées à la fois pour l'utilisateur `playbook@pve` et pour le token lui-même.
- `VM.PowerMgmt` couvre à la fois `stop` et `start` ; la logique de redémarrage doit donc être appliquée côté application.
- `status/stop` est brutal et adapté au kill de crise ; `shutdown` est propre mais trop lent pour l'urgence.
