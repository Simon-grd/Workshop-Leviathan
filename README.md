#  Léviathan : Edge Computing & Conteneurisation de Survie

> Workshop 2026 · B3 · Groupe G<n>

En situation de crise extrême (perte de 80 % de l'énergie), le vaisseau ne peut plus faire tourner des OS lourds.
**Léviathan** bascule automatiquement les services vitaux (oxygène, communications de secours) sur un cluster de conteneurs ultra-légers (Alpine) et coupe tout ce qui n'est pas indispensable.

## Pourquoi ça sauve le vaisseau

- Les services **vitaux** restent actifs même à 10 % de batterie.
- La bascule est **automatique** : aucune intervention humaine nécessaire pendant la crise.
- Le redémarrage des systèmes coupés reste **sous contrôle humain**, via un terminal à double authentification (règle des deux officiers).

## Architecture

```
[Simulateur d'énergie]──▶ Prometheus ──▶ Grafana (dashboards + alertes)
   (exporter Python)          ▲                   │ webhook
                              │                   ▼
   node_exporter + cAdvisor   │        Hyperviseur Python (contrôleur)
   sur chaque nœud ───────────┘          │  Docker SDK
                                         ▼
                        Nœud "confort" ──migration──▶ Cluster "survie" Alpine
                                                      ▲
                        Terminal manuel (web + 2FA) ──┘
```

Détails : [docs/architecture.md](docs/architecture.md)

## Structure du dépôt

```
leviathan/
├── hypervisor/   # Contrôleur : lit les métriques, décide, coupe/migre (Dev 1)
├── terminal/     # Interface web asynchrone + double authentification (Dev 2)
├── simulator/    # Exporter Prometheus simulant batterie et consommation
├── docs/         # Architecture, contrat d'API, conventions, dossier
├── .env.example  # Variables d'environnement (copier en .env, jamais commité)
└── README.md
```

| Dossier | Rôle | Stack | Port |
|---|---|---|---|
| `simulator/` | Expose `battery_percent` et `power_draw_watts`, chute déclenchable en démo | Python, prometheus_client | 8000 (métriques), 8001 (contrôle) |
| `hypervisor/` | Boucle de décision par seuils, arrêt par tier, migration BDD | Python, Docker SDK | 8100 (webhook/API) |
| `terminal/` | Login mot de passe + TOTP, validation 2e officier, redémarrage forcé | FastAPI, WebSocket, pyotp | 8200 |

## Prérequis

- Python 3.11+
- Docker (accès au socket Docker de l'hôte ou distant)
- Prometheus + Grafana fournis par l'équipe infra

## Démarrage rapide (développement local)

```bash
cp .env.example .env

# 1. Simulateur
cd simulator && pip install -r requirements.txt && python exporter.py

# 2. Hyperviseur (mode dry-run par défaut)
cd hypervisor && pip install -r requirements.txt && python main.py --dry-run

# 3. Terminal
cd terminal && pip install -r requirements.txt && uvicorn app.main:app --port 8200 --reload
```

Provoquer une crise pendant la démo :

```bash
curl "http://localhost:8001/set?battery=15"   # force la batterie à 15 %
curl "http://localhost:8001/set?battery=100"  # remise à zéro avant la soutenance
```

## Conventions (à respecter par toute l'équipe)

Voir [docs/conventions.md](docs/conventions.md).

- **Tiers de conteneurs** (label Docker `tier`) : `vital` · `essentiel` · `loisir` · `recherche`
- **Seuils de décision** : < 40 % → arrêt `loisir` · < 20 % → arrêt `recherche` · < 10 % → migration des BDD
- **Branches** : `main` (stable) · `dev` · `feature/<nom>` · pas de push direct sur `main`
- **Commits** : `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- **Secrets** : jamais dans le dépôt (voir `.env.example`)

## Contrat d'API

Voir [docs/api-contract.md](docs/api-contract.md).

## Planning

| Jour | Objectif dev |
|---|---|
| Lundi | Contrat d'API figé, dépôt, maquettes, seuils |
| Mardi | Simulateur, boucle de décision, squelette du terminal, 2FA |
| Mercredi | Déploiement sur l'infra, migration BDD, webhook Grafana, tests de crise |
| Jeudi | Gel du code (`v1.0-soutenance`), dossier PDF, ZIP |
| Vendredi | Soutenance (5 min) : impact → intro en anglais → démo |

## Équipe

| Nom | Profil | Périmètre |
|---|---|---|
| … | Dev 1 | `hypervisor/`, `simulator/` |
| … | Dev 2 | `terminal/` |
| … | Infra système | Alpine, Docker, Prometheus/Grafana, AD |
| … | Infra réseau | DNS/DHCP, VRRP, réseaux virtuels |
