# Infra

## Objectif
Préparer le cluster Proxmox, Ceph, HA, VLAN et firewall nécessaires au fonctionnement du scénario de crise.

## Contenu prévu
- configuration Proxmox / Ceph / OSD
- pools `lab-vlan20` et `loisirs-vlan30`
- règles `pveum` et ACL de token
- bridge VLAN-aware et règles firewall
- runbooks de validation d'isolation et de redémarrage
