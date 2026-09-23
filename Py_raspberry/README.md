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

## Installation sur le Raspberry Pi

### 1. Récupérer le projet (git clone / git pull)

Première fois :

```bash
git clone <url-du-repo>
cd Py_raspberry
```

Pour les fois suivantes (mise à jour du code) :

```bash
cd Py_raspberry
git pull
```

**⚠️ Important : après chaque `git pull`, recréer l'environnement virtuel (venv).** Un `git pull` peut changer les dépendances (nouvelles librairies, versions différentes) ; un venv gardé d'avant peut être incomplet ou incohérent avec le code mis à jour. Pour repartir propre, supprimer l'ancien venv et en recréer un neuf (voir étape suivante).

### 2. Créer et activer l'environnement virtuel (venv)

Si un dossier `venv` existe déjà (par exemple après un `git pull`), le supprimer avant de le recréer :

```bash
rm -rf venv
```

Créer le venv et l'activer :

```bash
python3 -m venv venv
source venv/bin/activate
```

Une fois activé, l'invite de commande affiche `(venv)` devant le prompt. Le venv doit être réactivé (`source venv/bin/activate`) à chaque nouvelle session de terminal, avant de lancer le script ou d'installer des dépendances.

### 3. Dépendances Python

Avec le venv activé :

```bash
pip install gpiozero
pip install adafruit-circuitpython-dht
pip install paho-mqtt
```

### 4. Dépendance système du capteur DHT

```bash
sudo apt-get install libgpiod2
```

### 5. Broker MQTT Mosquitto

Le script publie ses alertes vers un broker MQTT local. Si Mosquitto n'est pas déjà installé :

```bash
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable --now mosquitto
```

## Lancement

Avec le venv activé (`source venv/bin/activate`) :

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

## Topics de monitoring continu : `capteur/temperature` et `capteur/humidite`

En plus des alertes, la température **et** l'humidité sont aussi publiées en continu, pour alimenter un dashboard avec des valeurs/courbes en direct plutôt qu'un simple événement d'alerte.

| Topic MQTT | Payload |
|---|---|
| `capteur/temperature` | `{"temperature": 22.4, "timestamp": "2026-09-23T14:32:00"}` |
| `capteur/humidite` | `{"humidite": 45.0, "timestamp": "2026-09-23T14:32:00"}` |

Différences avec l'alerte incendie :
- **Pas edge-triggered** : les valeurs sont envoyées à intervalle régulier (toutes les `INTERVALLE_PUBLICATION_CAPTEUR` secondes, 10s par défaut), qu'elles soient stables, en hausse ou en baisse.
- **Intervalle indépendant** de la lecture du capteur : le DHT22 est lu toutes les `INTERVALLE_LECTURE_DHT` secondes (2s par défaut), mais seule une lecture sur ~5 est effectivement publiée sur ces topics.
- **Rien n'est publié si la lecture échoue** : si le capteur renvoie une erreur sur un cycle donné, ce cycle est simplement ignoré pour la valeur concernée (pas de valeur manquante/fausse envoyée). Température et humidité sont indépendantes : si l'une échoue, l'autre est publiée normalement.

Les deux intervalles (`INTERVALLE_LECTURE_DHT` et `INTERVALLE_PUBLICATION_CAPTEUR`) sont réglables en haut de [main.py](main.py).

## Structure du fichier

- **Configuration** : constantes GPIO, seuil, intervalles, config MQTT
- **Client MQTT** : connexion au broker + fonction `publier_alerte_mqtt()` qui envoie un message sans jamais planter le programme si le broker est indisponible
- **Boutons** : initialisation `gpiozero.Button` + callbacks (`on_bouton_1_appuye`, etc.) déclenchés automatiquement à l'appui
- **Capteur DHT22** : `lire_temperature()` et `lire_humidite()` lisent le capteur, renvoient `None` en cas d'échec de lecture (normal et fréquent avec ce capteur)
- **Boucle principale** : lit température et humidité en continu, publie ces valeurs toutes les 10s et gère l'alerte incendie edge-triggered ; les boutons sont gérés en arrière-plan par gpiozero et n'ont pas besoin de cette boucle

## Notes techniques

- Le client MQTT est créé avec `mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)` pour rester compatible avec les versions récentes de `paho-mqtt` (2.x) sans afficher d'avertissement de dépréciation à chaque lancement ; le code retombe automatiquement sur l'ancien constructeur si une version plus ancienne de la librairie est installée.
- `json.dumps(..., ensure_ascii=False)` est utilisé pour que les accents (é, à...) apparaissent normalement dans les messages MQTT au lieu d'être échappés en `\uXXXX`.
