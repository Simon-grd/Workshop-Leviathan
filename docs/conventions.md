# Conventions (v2)

## VLANs et pools

| VLAN | Réseau | Description |
|---|---|---|
| 10 | 10.10.10.0/24 | Services critiques : Next.js, API, PostgreSQL, Mosquitto, playbook |
| 20 | 10.10.20.0/24 | Laboratoire : CT secondaires |
| 30 | 10.10.30.0/24 | Loisirs : CT secondaires |

Le playbook ne doit jamais toucher les CT vitaux car ils doivent rester hors des pools arrêtés par le scénario.

## Proxmox : pools et ACL

- `lab-vlan20` contient les CT du laboratoire
- `loisirs-vlan30` contient les CT du secteur loisirs
- Les ACL sur le token doivent être strictement limitées à ces pools
- L'utilisateur `playbook@pve` et le token `playbook@pve!leviathan` doivent être autorisés séparément

## Scénarios de crise

| Scénario | Action |
|---|---|
| `fire_lab` | Coupe les CT du pool `lab-vlan20` |
| `power_drop` | Coupe les CT de `loisirs-vlan30`, puis `lab-vlan20` si la crise persiste |
| `reset` | Remet l'application et les états de la démo à zéro |

## Sécurité des redémarrages

- Le redémarrage des systèmes coupés reste sous contrôle humain.
- La règle des deux officiers s'applique au moment où l'opérateur valide la relance.
- `VM.PowerMgmt` couvre à la fois l'arrêt brutal et le redémarrage, mais la décision ne doit pas être automatisée.

## Git

- Branches : `main` · `dev` · `feature/<nom>`
- PR obligatoire vers `main`
- Commits : `feat:` `fix:` `docs:` `test:` `chore:`
- Secrets : jamais dans Git ; utiliser `.env` localement uniquement

## Sécrets

- Les tokens Proxmox ont une durée de vie limitée et ne doivent pas être inscrits dans le dépôt.
- `verify_ssl=False` est toléré uniquement en labo avec certificat auto-signé ; documenter l’exception pour le dossier technique.
