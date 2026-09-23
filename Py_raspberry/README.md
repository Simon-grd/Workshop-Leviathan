# Py_raspberry — Surveillance vaisseau (boutons + température)

Script Python pour Raspberry Pi qui surveille :
- 3 boutons poussoirs (`bt1`, `bt2`, `bt3`), chacun associé à un type d'alerte différent
- 1 capteur de température/humidité DHT22, avec alerte si la température dépasse un seuil
- Publication de chaque alerte en MQTT vers un broker Mosquitto, pour être reçue par un autre programme (dashboard, appli, etc.)

## Câblage

| Élément | GPIO (BCM) |
|---|---|
| Bouton 1 (bleu) — alerte astéroïde | GPIO27 |
| Bouton 2 (jaune) — alerte radiation | GPIO17 |
| Bouton 3 (rouge) — alerte sabotage | GPIO22 |
| Capteur DHT22 (fil data) | GPIO23 |

Ces numéros sont définis en haut de [main.py](main.py) et peuvent être changés facilement si le câblage réel est différent. Si la lecture du DHT22 échoue systématiquement, le fil data est probablement branché sur un autre GPIO (essayer GPIO24 ou GPIO18).

## Installation

À faire une seule fois sur le Raspberry Pi.

### 1. Dépendances Python

```bash
pip install gpiozero
pip install adafruit-circuitpython-dht
pip install paho-mqtt
```

### 2. Dépendance système du capteur DHT

```bash
sudo apt-get install libgpiod2
```

### 3. Broker MQTT Mosquitto

Le script publie ses alertes vers un broker MQTT local. Si Mosquitto n'est pas déjà installé :

```bash
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable --now mosquitto
```

## Lancement

```bash
python main.py
```

Arrêt propre avec `Ctrl+C` (le script libère le capteur et ferme la connexion MQTT proprement).

Si le broker Mosquitto n'est pas joignable au démarrage, le script continue de fonctionner normalement (boutons + température affichés en console), il désactive simplement l'envoi MQTT.

## Alertes et topics MQTT

Chaque alerte est publiée en JSON avec un `type`, un `message` et un `timestamp`.

| Déclencheur | Topic MQTT | Type |
|---|---|---|
| Bouton 1 | `alerte/asteroide` | `asteroide` |
| Bouton 2 | `alerte/radiation` | `radiation` |
| Bouton 3 | `alerte/sabotage` | `sabotage` |
| Température > seuil | `alerte/incendie` | `incendie` |
| Température repassée sous le seuil | `alerte/incendie` | `incendie_fin` |

### Comportement de l'alerte température

L'alerte incendie est **edge-triggered** : elle n'est publiée/affichée qu'au moment où la température **franchit** le seuil (dans un sens ou dans l'autre), pas en boucle tant qu'elle reste au-dessus. Concrètement :
- un message est envoyé une seule fois quand la température passe au-dessus du seuil (début d'alerte)
- un message différent est envoyé une seule fois quand elle repasse sous le seuil (fin d'alerte / retour à la normale)

Le seuil (`SEUIL_ALERTE_TEMPERATURE`, en °C) et l'intervalle de lecture du capteur (`INTERVALLE_LECTURE_DHT`, en secondes) sont réglables en haut de [main.py](main.py).

## Structure du fichier

- **Configuration** : constantes GPIO, seuil, intervalle, config MQTT
- **Client MQTT** : connexion au broker + fonction `publier_alerte_mqtt()` qui envoie un message sans jamais planter le programme si le broker est indisponible
- **Boutons** : initialisation `gpiozero.Button` + callbacks (`on_bouton_1_appuye`, etc.) déclenchés automatiquement à l'appui
- **Capteur DHT22** : `lire_temperature()` lit la température, renvoie `None` en cas d'échec de lecture (normal et fréquent avec ce capteur)
- **Boucle principale** : lit la température en continu et gère l'alerte incendie edge-triggered ; les boutons sont gérés en arrière-plan par gpiozero et n'ont pas besoin de cette boucle
