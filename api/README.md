# API

FastAPI pour l'API de supervision, le relais MQTT et la gestion des scénarios.

## Rôle
- REST pour les scénarios et l'état de la plateforme
- WebSocket pour les alertes en temps réel
- authentification TOTP / 2FA pour les actions sensibles
- relais MQTT vers le playbook

## Variables attendues
Voir la racine `.env.example`.
