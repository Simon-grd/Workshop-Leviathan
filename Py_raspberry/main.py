"""
Script de surveillance Raspberry Pi :
 - 3 boutons poussoirs (bt1, bt2, bt3) avec détection individuelle et anti-rebond
 - 1 capteur de température/humidité DHT11 avec alerte si dépassement de seuil
 - Publication MQTT de chaque alerte (boutons + température) vers un broker Mosquitto

Installation des dépendances (à exécuter une seule fois sur le Raspberry Pi) :
    pip install gpiozero
    pip install adafruit-circuitpython-dht
    sudo apt-get install libgpiod2   # dépendance système requise par adafruit-circuitpython-dht
    pip install paho-mqtt

Installation et lancement du broker MQTT Mosquitto sur le Raspberry Pi (si ce
n'est pas déjà fait) :
    sudo apt install mosquitto mosquitto-clients
    sudo systemctl enable --now mosquitto   # démarre Mosquitto et l'active au boot
"""

import time
import json
from datetime import datetime

from gpiozero import Button
import board
import adafruit_dht
import paho.mqtt.client as mqtt

# ---------------------------------------------------------------------------
# CONSTANTES DE CONFIGURATION (à adapter facilement selon le câblage réel)
# ---------------------------------------------------------------------------

# Numéros de GPIO (numérotation BCM) pour chaque bouton poussoir.
PIN_BOUTON_1 = 17  # Bouton bleu
PIN_BOUTON_2 = 27  # Bouton jaune
PIN_BOUTON_3 = 22  # Bouton rouge

# Numéro de GPIO pour le fil data du capteur DHT11.
# Estimation basée sur le câblage : GPIO23. Si la lecture du capteur plante
# (erreur au moment de dht_capteur.temperature / dht_capteur.humidity),
# cela signifie très probablement que le fil data est en réalité branché
# sur un autre GPIO (essayer GPIO24 ou GPIO18 dans ce cas), et non que le
# code est fautif.
PIN_CAPTEUR_DHT = board.D23

# Durée anti-rebond en secondes : ignore les changements d'état trop rapprochés
# dus aux micro-oscillations mécaniques du contact du bouton.
DUREE_ANTI_REBOND = 0.2

# Seuil de température (en °C) au-delà duquel une alerte est affichée.
SEUIL_ALERTE_TEMPERATURE = 35

# Intervalle entre deux lectures du capteur DHT11 (en secondes).
# Le DHT11 est un capteur lent : il ne faut pas l'interroger plus souvent
# qu'environ toutes les 2 secondes, sous peine d'obtenir des erreurs de lecture.
INTERVALLE_LECTURE_DHT = 2

# --- Configuration MQTT (nouveau) ------------------------------------------
# Adresse et port du broker Mosquitto. En local sur le Raspberry Pi lui-même,
# c'est "localhost" avec le port MQTT standard 1883.
MQTT_BROKER_HOTE = "localhost"
MQTT_BROKER_PORT = 1883
MQTT_KEEPALIVE = 60  # durée max (s) sans message avant que le broker considère le client déconnecté

# Un topic MQTT par thème d'alerte, associé à chaque bouton / au capteur.
MQTT_TOPIC_ASTEROIDE = "alerte/asteroide"   # bt1
MQTT_TOPIC_RADIATION = "alerte/radiation"   # bt2
MQTT_TOPIC_AVARIE = "alerte/avarie"         # bt3
MQTT_TOPIC_INCENDIE = "alerte/incendie"     # capteur DHT11

# ---------------------------------------------------------------------------
# INITIALISATION DU CLIENT MQTT (nouveau)
# ---------------------------------------------------------------------------
# On crée le client et on tente la connexion au broker dès le démarrage.
# mqtt_connecte permet de savoir, partout ailleurs dans le script, si la
# connexion a réussi : si le broker est injoignable, on ne plante pas le
# programme, on désactive juste l'envoi MQTT (les boutons et le capteur
# continuent de fonctionner et de s'afficher normalement dans la console).
mqtt_client = mqtt.Client()
mqtt_connecte = False


def on_mqtt_connect(client, userdata, flags, rc):
    """Callback appelé par paho-mqtt une fois la connexion au broker établie."""
    global mqtt_connecte
    if rc == 0:
        mqtt_connecte = True
        print("MQTT : connecté au broker Mosquitto.")
    else:
        mqtt_connecte = False
        print(f"MQTT : échec de connexion au broker (code {rc}).")


def on_mqtt_disconnect(client, userdata, rc):
    """Callback appelé par paho-mqtt en cas de perte de connexion au broker."""
    global mqtt_connecte
    mqtt_connecte = False
    print("MQTT : déconnecté du broker.")


mqtt_client.on_connect = on_mqtt_connect
mqtt_client.on_disconnect = on_mqtt_disconnect

try:
    mqtt_client.connect(MQTT_BROKER_HOTE, MQTT_BROKER_PORT, MQTT_KEEPALIVE)
    # loop_start() lance un thread interne qui gère la connexion (reconnexion
    # automatique incluse) en arrière-plan, sans bloquer le reste du script.
    mqtt_client.loop_start()
except Exception as erreur:
    # Le broker n'est pas joignable au démarrage (Mosquitto non lancé, mauvaise
    # adresse, etc.) : on informe clairement dans la console et on continue
    # sans MQTT plutôt que de planter le programme.
    print(f"MQTT : impossible de se connecter au broker au démarrage ({erreur}). "
          f"Le programme continue sans MQTT.")


def publier_alerte_mqtt(topic, payload):
    """
    Publie un message JSON sur le topic MQTT donné, si une connexion au
    broker est disponible. Ne lève jamais d'exception : en cas de souci
    (broker coupé en cours de route, etc.), on log l'erreur en console et
    on continue, sans jamais interrompre la boucle principale ni les
    callbacks des boutons.
    """
    if not mqtt_connecte:
        print(f"MQTT : non connecté, message non envoyé sur {topic}.")
        return
    try:
        mqtt_client.publish(topic, json.dumps(payload))
    except Exception as erreur:
        print(f"MQTT : échec de publication sur {topic} ({erreur}).")


# ---------------------------------------------------------------------------
# INITIALISATION DES BOUTONS
# ---------------------------------------------------------------------------
# pull_up=True active la résistance de pull-up interne du GPIO : la broche est
# au niveau haut (1) au repos, et passe au niveau bas (0) quand le bouton
# relie la broche à la masse (GND) lors de l'appui. gpiozero gère cette
# logique automatiquement (is_pressed devient True lors de l'appui).
# bounce_time applique l'anti-rebond directement au niveau de la librairie.
bt1 = Button(PIN_BOUTON_1, pull_up=True, bounce_time=DUREE_ANTI_REBOND)
bt2 = Button(PIN_BOUTON_2, pull_up=True, bounce_time=DUREE_ANTI_REBOND)
bt3 = Button(PIN_BOUTON_3, pull_up=True, bounce_time=DUREE_ANTI_REBOND)


# ---------------------------------------------------------------------------
# CALLBACKS DES BOUTONS
# ---------------------------------------------------------------------------
# Chaque fonction est appelée automatiquement par gpiozero dans un thread
# interne dès que le bouton correspondant est appuyé (front descendant filtré
# par l'anti-rebond). On n'a donc pas besoin de les tester manuellement dans
# la boucle principale : gpiozero s'en charge en arrière-plan.
def on_bouton_1_appuye():
    print("Bouton 1 appuyé")
    # Publication MQTT (nouveau) : alerte thème "astéroïde".
    publier_alerte_mqtt(MQTT_TOPIC_ASTEROIDE, {
        "type": "asteroide",
        "message": "Astéroïde détecté",
        "timestamp": datetime.now().isoformat(),
    })


def on_bouton_2_appuye():
    print("Bouton 2 appuyé")
    # Publication MQTT (nouveau) : alerte thème "fuite de radiation".
    publier_alerte_mqtt(MQTT_TOPIC_RADIATION, {
        "type": "radiation",
        "message": "Fuite de radiation détectée",
        "timestamp": datetime.now().isoformat(),
    })


def on_bouton_3_appuye():
    print("Bouton 3 appuyé")
    # Publication MQTT (nouveau) : alerte thème "avarie spatiale".
    publier_alerte_mqtt(MQTT_TOPIC_AVARIE, {
        "type": "avarie",
        "message": "Avarie critique détectée : panne du système de survie du vaisseau",
        "timestamp": datetime.now().isoformat(),
    })


# Association de chaque bouton à son callback.
bt1.when_pressed = on_bouton_1_appuye
bt2.when_pressed = on_bouton_2_appuye
bt3.when_pressed = on_bouton_3_appuye


# ---------------------------------------------------------------------------
# INITIALISATION DU CAPTEUR DHT11
# ---------------------------------------------------------------------------
dht_capteur = adafruit_dht.DHT11(PIN_CAPTEUR_DHT)


def lire_temperature():
    """
    Effectue une lecture du capteur DHT11 et renvoie la température en °C,
    ou None si la lecture a échoué (les échecs ponctuels sont normaux et
    fréquents avec ce type de capteur, il ne faut pas les traiter comme
    une erreur fatale).
    """
    try:
        return dht_capteur.temperature
    except RuntimeError as erreur:
        # Le DHT11 échoue régulièrement à répondre à temps (erreur de
        # checksum, timing, etc.). On log simplement l'erreur et on
        # réessaiera à la prochaine itération de la boucle, sans arrêter
        # le programme.
        print(f"Lecture DHT11 échouée, nouvelle tentative au prochain cycle : {erreur}")
        return None


# ---------------------------------------------------------------------------
# BOUCLE PRINCIPALE : lecture continue de la température
# ---------------------------------------------------------------------------
# La détection des boutons est entièrement gérée par les callbacks gpiozero
# ci-dessus (exécutés dans des threads séparés), donc cette boucle ne
# s'occupe que du capteur de température, sans bloquer la réactivité des
# boutons.
print("Démarrage de la surveillance (boutons + température). Ctrl+C pour quitter.")

try:
    while True:
        temperature = lire_temperature()

        if temperature is not None:
            print(f"Température actuelle : {temperature} °C")

            if temperature > SEUIL_ALERTE_TEMPERATURE:
                print(f"!!! ALERTE : température de {temperature} °C supérieure au seuil de {SEUIL_ALERTE_TEMPERATURE} °C !!!")
                # Publication MQTT (nouveau) : alerte thème "incendie", avec la température mesurée dans le payload.
                publier_alerte_mqtt(MQTT_TOPIC_INCENDIE, {
                    "type": "incendie",
                    "message": "Température anormalement élevée détectée",
                    "temperature": temperature,
                    "timestamp": datetime.now().isoformat(),
                })

        time.sleep(INTERVALLE_LECTURE_DHT)

except KeyboardInterrupt:
    # Arrêt propre du programme sur Ctrl+C.
    print("\nArrêt du programme demandé par l'utilisateur.")

finally:
    # Libère proprement les ressources du capteur (évite les erreurs si le
    # script est relancé juste après).
    dht_capteur.exit()
    # Arrête proprement le thread MQTT et ferme la connexion au broker (nouveau).
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
