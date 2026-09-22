# Infra

## Objectif
Préparer le cluster Proxmox, Ceph, HA, VLAN et firewall nécessaires au fonctionnement du scénario de crise.

## Contenu prévu
- configuration Proxmox / Ceph / OSD
- pools `lab-vlan20` et `loisirs-vlan30`
- règles `pveum` et ACL de token
- bridge VLAN-aware et règles firewall
- runbooks de validation d'isolation et de redémarrage
**Cluster Proxmox VE** nommé `leviathan`, 3 nœuds :
  - `PVE-node01`
  - `PVE-node02`
  - `PVE-node03`
- **Stockage distribué Ceph** : pool `vaisseau`, répliqué sur les 3 nœuds — utilisé comme stockage disque pour tous les conteneurs (résilience en cas de panne d'un nœud).
- **Stockage local** (`local`) sur chaque nœud : contient les templates de conteneurs (Alpine 3.22). À télécharger sur chaque nœud individuellement (le stockage local n'est pas partagé entre nœuds).

## 3. Plan d'adressage

Tous les secteurs partagent le même sous-réseau `10.10.20.0/24`, avec passerelle unique `10.10.20.1`. La séparation logique se fait par **VLAN** (tag Proxmox), pas par subnet.

| Secteur | Nœud | Hostname | VLAN | IP | Priorité | Budget (W) |
|---|---|---|---|---|---|---|
| Oxygène | node01 | `lxc-oxygene-01` | 4000 | 10.10.20.10/24 | critique | 200 |
| Communications | node01 | `lxc-communications-01` | --- | 10.10.20.11/24 | haute | 100 |
| Base de bord | node02 | `lxc-base-bord` | --- | 10.10.20.12/24 | haute | 150 |
| Serre | node02 | `lxc-serre` | --- | 10.10.20.13/24 | haute | 300 |
| Laboratoire | node03 | `lxc-laboratoire` | --- | 10.10.20.14/24 | moyenne | 250 |
| Loisirs | node03 | `lxc-loisirs` | --- | 10.10.20.15/24 | faible | 400 |

## 6. Procédure de création d'un conteneur LXC

1. **Créer un conteneur** (bouton en haut à droite de l'interface Proxmox)
2. **Général** : choisir le nœud, définir hostname (`lxc-<secteur>`), mot de passe root
3. **Modèle** : stockage `local`, template `alpine-3.22-default` (le télécharger via `[nœud] > local > Modèles de conteneurs > Modèles` s'il n'est pas déjà présent sur ce nœud)
4. **Disques** : stockage `vaisseau` (Ceph), 4-8 Go
5. **Processeur** : 1 cœur
6. **Mémoire** : 512 Mio / swap 512 Mio
7. **Réseau** : bridge `vmbr4000`, tag VLAN `4000 ou ---`, IPv4 statique selon le plan d'adressage, passerelle `10.10.20.1`, IPv6 désactivé
8. **Confirmation** : vérifier le résumé, cocher "Démarrer après création" si besoin, **Terminer**
9. Une fois créé : ajouter les 3 tags (secteur/priorité/budget) dans le champ **Tags** du résumé du conteneur

## 7. Vérifications effectuées

- Conteneurs `lxc-oxygene-01` et `lxc-communications-01` créés et démarrés avec succès
- Connexion console OK (login `root` + mot de passe défini à la création)
- Réseau vérifié depuis l'intérieur du conteneur :
  ```sh
  ip addr show eth0 
  ping -c 3 10.10.20.1
  ```
