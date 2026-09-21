# Firmware

Contenu du capteur ESP32 et des simulateurs associés.

## Fonction
- publie sur MQTT les messages de feu ou de panne énergétique
- peut être remplacé par un vrai capteur sans changer le contrat MQTT

## Contrat MQTT
- `leviathan/sensors/lab/fire`
- payload exemple : `{"sensor":"esp32-lab-01","fire":true,"value":812}`
