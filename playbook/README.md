# Playbook

Script Python chargé de surveiller MQTT et d'exécuter les actions Proxmox.

## Objectif
- écouter les messages `leviathan/sensors/...` et `leviathan/scenarios/run`
- vérifie les pools autorisés (`lab-vlan20`, `loisirs-vlan30`)
- stop les CT avec le token Proxmox restreint
- publie les logs vers `leviathan/playbook/log`

## Sécurité
- tourner sur le VLAN 10 sous HA
- utiliser un token Proxmox avec ACL limitées
- ne jamais commiter le secret du token
