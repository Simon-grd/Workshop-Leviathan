# Contrat d'API v2

## MQTT

### Topics publiés par l'ESP32

- `leviathan/sensors/lab/fire`
- Payload exemple :

```json
{"sensor":"esp32-lab-01","fire":true,"value":812}
```

### Topic pour les scénarios

- `leviathan/scenarios/run`
- Payload exemple :

```json
{"scenario":"fire_lab"}
```

### Topic retour playbook → interface

- `leviathan/playbook/log`
- Payload attendu :

```json
{"step":"stop_pool","pool":"lab-vlan20","status":"started","timestamp":"2026-09-21T10:00:00Z"}
```

## API REST (FastAPI)

### Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/login` | Login utilisateur |
| POST | `/auth/2fa` | Validation TOTP du second officier |

### Scénarios

| Méthode | Route | Description |
|---|---|---|
| POST | `/scenarios/fire_lab` | Lance le scénario incendie sur le pool labo |
| POST | `/scenarios/power_drop` | Simule une chute d'énergie 80 % |
| POST | `/scenarios/reset` | Remet la démo à zéro |

### État

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État de l'API |
| GET | `/status` | État des CT et des alertes |
| GET | `/logs` | Journal d'audit |

### WebSocket

| Route | Description |
|---|---|
| `/ws` | Flux temps réel des événements MQTT / playbook vers `Interface 1` |

## Schéma de données WebSocket

```json
{
  "type": "alert",
  "zone": "lab",
  "severity": "red",
  "message": "Incendie détecté dans le laboratoire",
  "timestamp": "2026-09-21T10:00:00Z"
}
```

## Codes de réponse

- `200` OK
- `202` accepté / scénario planifié
- `401` non authentifié
- `403` droits insuffisants
- `409` conflit de scénario
- `500` erreur côté bus ou Proxmox

## Règle de conformité

Le playbook et l'API doivent accepter le même payload MQTT que le capteur réel ; la démo doit donc jouer le chemin final sans artifices de simulation interne.
