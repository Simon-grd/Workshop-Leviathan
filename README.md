# Léviathan : Proxmox, playbook de crise et deux interfaces

> Workshop 2026 · B3 · Groupe 6

Cette version remplace la logique Docker SDK par un contrôle Proxmox via MQTT et un playbook de crise dédié. Le système coupe les services des pools secondaires puis applique la procédure de redémarrage humaine avec validation à deux officiers.

## Architecture du cluster et flux de données

```text
Hetzner SN1 • cluster « leviathan »

+------------------------------------------------+ +----------------------------------------+ +-------------------------------------+
| PVE-node01                                     | | PVE-node02                              | | PVE-node03                          |
| 10.0.0.1 • Taishcale                           | | 10.0.0.2 • Tailscale                    | | 10.0.0.3                            |
|                                                | |                                        | |                                     |
| 101 mqtt                                       | | 102 moteur                             | | 103 prometheus                      |
| 10 • HA                                        | | 11 • HA                                | | .12 • HA                            |
|                                                | |                                        | |                                     |
| 104 grafana                                    | | 202 comms                              | | 105 terminal                        |
| 13 • HA                                        | | 21 • HA • critique                     | | 14 • HA                             |
|                                                | |                                        | |                                     |
| 201 oxygène                                    | | 206 loisirs                            | | 203 base-bord                       |
| 20 • HA • critique                             | | 25 • délestable                        | | 22 • HA                             |
|                                                | |                                        | |                                     |
| 205 labo                                       | |                                        | | 204 serre                           |
| 24 • délestable                                | |                                        | | 23 • délestable                     |
+------------------------------------------------+ +----------------------------------------+ +-------------------------------------+

+------------------------------------------------------------------------------------+
| vSwitch VLAN 4000 • vmbr4000 • 10.0.0.0/24 • MTU 1400                           |
+------------------------------------------------------------------------------------+

+------------------------------------------------------------------------------------+
| Pool Ceph « vaisseau » • RBD • 3 réplicas • ~220 Go utiles                        |
+------------------------------------------------------------------------------------+

+----------------------+----------------------+------------------------------------+
| Service système      | Secteur du vaisseau  | HA = relance ailleurs si nœud perdu |
| (couleur violette)   | (couleur verte)      |                                    |
+----------------------+----------------------+------------------------------------+
```

- Les services système sont dans le cluster : `mqtt`, `moteur`, `terminal`, `prometheus`, `grafana`.
- Les secteurs délestables sont pilotés par le moteur via Proxmox API : `oxygene`, `comms`, `base-bord`, `serre`, `labo`, `loisirs`.
- Le HA est réservé aux services critiques et aux secteurs vitaux ; les secteurs non critiques ne doivent pas être en HA pour éviter le relancement automatique.

### Vue simplifiée du flux

```text
+--------------------------------------------------------------------------+
| Tainted WireGuard                                                        |
| UDP 41641 • relays 443                                                  |
+-------------------------------+------------------------------------------+
| Raspberry Pi                 | Cluster • vSwitch 10.0.0.0/24             |
| Campus • client MQTT         | +----------------------------+         |
|                             | | mqtt                      |         |
|                             | | MQTT 1883 • WS 9001       |         |
|                             | +----------------------------+         |
|                             | +----------------------------+         |
|                             | | moteur                    |         |
|                             | | Playbooks • paho-mqtt     |         |
|                             | +----------------------------+         |
|                             |          |                  |          |
|                             |          v                  v          |
|                             | +----------------+ +----------------+ |
|                             | | terminal       | | API Proxmox    | |
|                             | | HTTP 3000     | | HTTPS 806    | |
|                             | +----------------+ +----------------+ |
|                             |          |                  |          |
|                             |          v                  v          |
|                             | +----------------+ +----------------+ |
|                             | | grafana       | | prometheus     | |
|                             | | HTTP 3000     | | HTTP 9090     | |
|                             | +----------------+ +----------------+ |
+-------------------------------+------------------------------------------+
| PC équipe                                                       |
| Navigateur                                                     |
+------------------------------------------------------------------+
```

## Règles techniques et contraintes de conception

Le vaisseau est conçu comme une architecture à deux niveaux :

- les services système sont les composants critiques du contrôle, du monitoring et du terminal de commandement ; ils sont en HA et ne doivent jamais être délestés ;
- les secteurs du vaisseau sont des ressources consommables ; ils sont allumés ou arrêtés par le moteur selon la criticité, le budget énergétique et l'état global du vaisseau.

Cette séparation est essentielle pour éviter le piège classique du HA Proxmox : si les secteurs délestables sont aussi en HA, le moteur les coupe puis le HA les remonte immédiatement, ce qui annule entièrement le mécanisme de délestage.

## Déploiement Proxmox et plan de mise en service

### 1. Créer une base saine puis la dupliquer

1. Créer un premier CT Alpine dédié au secteur `oxygene`.
2. Connecter le CT sur le bridge `vmbr4000`.
3. Configurer le paramètre `mtu=1400` pour réduire les pertes sur le réseau du vaisseau.
4. Placer le disque sur le pool `vaisseau`.
5. Installer un petit script de heartbeat MQTT qui publie régulièrement `je suis vivant`.
6. Convertir le CT en template.
7. Cloner ensuite `serre`, `labo`, `loisirs`, `comms` et `base-bord` depuis ce template.

Cette méthode est beaucoup plus fiable que de reproduire chaque CT à la main : elle permet de standardiser le réseau, la mémoire, le système d'exploitation et le script d'état sans oublier un détail.

### 2. Règles de criticité

- `oxygene`, `comms`, `base-bord` : priorité critique ou haute, sous HA.
- `serre`, `labo`, `loisirs` : délestables, pas de HA.
- Le budget énergétique en watts est stocké dans les tags Proxmox, puis lu par le moteur pour décider si un secteur peut être maintenu allumé.

### 3. Fuites de mémoire et dimensionnement

Le vaisseau entier est dimensionné pour tenir dans une empreinte mémoire proche de 3 Go, ce qui est un argument de soutenance fort : le système donne l'impression d'un vaisseau autonome, alors qu'en réalité il s'appuie sur une infrastructure compacte et robuste. Sur des nœuds de 32 à 64 Go, l'ensemble du vaisseau reste bien en dessous de la capacité de la machine, tout en restant redondé à travers le cluster.

## Checklist de mise en service

1. Démarrer les conteneurs système 101 à 105.
2. Vérifier que `mqtt` réponde sur `1883` et `WebSocket`.
3. Vérifier que `moteur` reçoit les messages MQTT et publie les journaux SQLite.
4. Vérifier que `prometheus` collecte les métriques et que `pve-exporter` alimente les séries pertinentes.
5. Vérifier que `grafana` affiche les dashboards de supervision.
6. Vérifier que `terminal` sert l'interface Next.js ainsi que l'API FastAPI/TOTP.
7. Préparer le template `oxygene` avec le réseau `vmbr4000` et `mtu=1400`.
8. Cloner les secteurs délestables depuis ce modèle.
9. Désactiver le HA sur les conteneurs non critiques.
10. Vérifier les heartbeats MQTT de chaque secteur pour valider leur présence sur la carte.
11. Tester le délestage par priorité et valider le comportement sur la carte du vaisseau.

## Règles de sécurité et d'exploitation

- Les tokens Proxmox et les secrets sensibles ne doivent jamais être stockés dans le dépôt Git.
- Les secteurs de faible priorité doivent être traités comme des ressources sacrificielles, pas comme des services de base.
- Les services du système doivent rester toujours disponibles, même pendant une crise énergétique.
- Le moteur est le seul élément capable d'allumer ou d'éteindre les secteurs ; il ne modifie jamais l'état des services critiques sans logique explicite.
- Le redémarrage des services coupés doit rester humainement validé, afin d'éviter un cycle de relance automatisée dangereux.

## Synthèse de l'architecture

Le vaisseau Leviathan repose sur une architecture robuste et lisible :

- 5 services système critiques, toujours sous HA ;
- 6 secteurs délestables, minimalistes et volatiles ;
- un moteur central qui décide sur base MQTT, priorité, budget et état de santé ;
- un terminal de supervision qui donne une vue claire du vaisseau en temps réel.
