# Conventions

## Tiers de conteneurs

Label Docker obligatoire sur chaque conteneur : `tier=<valeur>`

| Tier | Exemple | Coupé ? |
|---|---|---|
| `vital` | oxygène, comms de secours, BDD survie | Jamais |
| `essentiel` | annuaire, DNS/DHCP | Jamais automatiquement |
| `loisir` | divertissement | À < 40 % |
| `recherche` | calcul scientifique | À < 20 % |

## Seuils (configurables dans `hypervisor/config.yaml`)

| Batterie | Action |
|---|---|
| < 40 % | Arrêt `loisir` |
| < 20 % | Arrêt `recherche` |
| < 10 % | Migration des BDD vers le cluster Alpine |

## Git

- Branches : `main` · `dev` · `feature/<nom>`
- Pull request obligatoire vers `main`, relue par un autre membre
- Commits : `feat:` `fix:` `docs:` `test:` `chore:`
- Tag de gel : `v1.0-soutenance` (jeudi)

## Secrets

Jamais dans le dépôt. Copier `.env.example` en `.env`.
