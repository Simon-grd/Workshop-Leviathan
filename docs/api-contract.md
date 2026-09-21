# Contrat d'API

> Statut : **à figer lundi** avec l'équipe.

## Métriques Prometheus (simulateur)

| Métrique | Type | Description |
|---|---|---|
| `battery_percent` | gauge | Niveau de batterie (0-100) |
| `power_draw_watts` | gauge | Consommation instantanée |

## API du simulateur (port 8001)

| Méthode | Route | Description |
|---|---|---|
| GET | `/set?battery=<0-100>` | Force le niveau de batterie |

## API de l'hyperviseur (port 8100)

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État du contrôleur |
| GET | `/containers` | Conteneurs et tiers |
| POST | `/webhook/grafana` | Réception d'une alerte Grafana |
| POST | `/restart/{tier}` | Redémarre un tier (appelé par le terminal, après double validation) |

## API du terminal (port 8200)

| Méthode | Route | Description |
|---|---|---|
| POST | `/login` | Mot de passe → jeton intermédiaire |
| POST | `/2fa` | Code TOTP → session |
| GET | `/status` | État des systèmes (WebSocket `/ws` pour le temps réel) |
| POST | `/restart` | Demande de redémarrage (officier 1) → statut `pending` |
| POST | `/approve/{request_id}` | Validation par un second officier (TOTP) |
| GET | `/audit` | Journal d'audit |

## Codes d'erreur

`401` non authentifié · `403` rôle insuffisant / même officier · `409` demande déjà traitée · `410` demande expirée
