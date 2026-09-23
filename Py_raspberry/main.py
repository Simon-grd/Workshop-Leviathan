"""
Script de surveillance Raspberry Pi : boutons poussoirs + capteur de
température, avec publication de chaque alerte en MQTT.

Voir README.md pour l'installation et le détail des alertes/topics.
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

# GPIO (numérotation BCM) de chaque bouton poussoir.
PIN_BOUTON_1 = 27  # Bouton bleu
PIN_BOUTON_2 = 17  # Bouton jaune
PIN_BOUTON_3 = 22  # Bouton rouge

# GPIO du fil data du capteur DHT22. Si la lecture plante systématiquement,
# le fil est probablement branché sur un autre GPIO (essayer GPIO24/GPIO18).
PIN_CAPTEUR_DHT = board.D23

# Anti-rebond (secondes) : ignore les changements d'état trop rapprochés dus
# aux micro-oscillations mécaniques du bouton.
DUREE_ANTI_REBOND = 0.2

# Seuil de température (°C) au-delà duquel l'alerte incendie se déclenche.
SEUIL_ALERTE_TEMPERATURE = 30

# Intervalle entre deux lectures du DHT22 (secondes). Capteur lent : ne pas
# l'interroger trop souvent sous peine d'erreurs de lecture.
INTERVALLE_LECTURE_DHT = 2

# --- Configuration MQTT ------------------------------------------
MQTT_BROKER_HOTE = "localhost"
MQTT_BROKER_PORT = 1883
MQTT_KEEPALIVE = 60  # durée max (s) sans message avant déconnexion côté broker

# Un topic MQTT par thème d'alerte, associé à chaque bouton / au capteur.
MQTT_TOPIC_ASTEROIDE = "alerte/asteroide"   # bt1
MQTT_TOPIC_RADIATION = "alerte/radiation"   # bt2
MQTT_TOPIC_SABOTAGE = "alerte/sabotage"     # bt3
MQTT_TOPIC_INCENDIE = "alerte/incendie"     # capteur DHT22

# ---------------------------------------------------------------------------
# CLIENT MQTT
# ---------------------------------------------------------------------------
# mqtt_connecte indique si la connexion au broker est active : si le broker
# est injoignable, le programme ne plante pas, il désactive juste l'envoi
# MQTT (boutons et capteur continuent de fonctionner normalement).
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
    # loop_start() gère la connexion (reconnexion incluse) dans un thread à
    # part, sans bloquer le reste du script.
    mqtt_client.loop_start()
except Exception as erreur:
    # Broker injoignable au démarrage : on log et on continue sans MQTT
    # plutôt que de planter le programme.
    print(f"MQTT : impossible de se connecter au broker au démarrage ({erreur}). "
          f"Le programme continue sans MQTT.")


def publier_alerte_mqtt(topic, payload):
    """
    Publie un message JSON sur le topic donné si le broker est connecté.
    Ne lève jamais d'exception, pour ne jamais interrompre la boucle
    principale ni les callbacks des boutons.
    """
    if not mqtt_connecte:
        print(f"MQTT : non connecté, message non envoyé sur {topic}.")
        return
    try:
        # ensure_ascii=False : garde les accents tels quels dans le JSON
        # (ex. "é") au lieu de les échapper en \uXXXX.
        mqtt_client.publish(topic, json.dumps(payload, ensure_ascii=False))
    except Exception as erreur:
        print(f"MQTT : échec de publication sur {topic} ({erreur}).")


# ---------------------------------------------------------------------------
# BOUTONS
# ---------------------------------------------------------------------------
# pull_up=True : broche au niveau haut au repos, niveau bas quand le bouton
# relie la broche à la masse (gpiozero gère ça : is_pressed devient True à
# l'appui). bounce_time applique l'anti-rebond au niveau de la librairie.
bt1 = Button(PIN_BOUTON_1, pull_up=True, bounce_time=DUREE_ANTI_REBOND)
bt2 = Button(PIN_BOUTON_2, pull_up=True, bounce_time=DUREE_ANTI_REBOND)
bt3 = Button(PIN_BOUTON_3, pull_up=True, bounce_time=DUREE_ANTI_REBOND)


# ---------------------------------------------------------------------------
# CALLBACKS DES BOUTONS
# ---------------------------------------------------------------------------
# Appelées automatiquement par gpiozero (thread interne) dès l'appui sur le
# bouton correspondant : pas besoin de les tester dans la boucle principale.
def on_bouton_1_appuye():
    print("Bouton 1 appuyé")
    publier_alerte_mqtt(MQTT_TOPIC_ASTEROIDE, {
        "type": "asteroide",
        "message": "Astéroïde détecté",
        "timestamp": datetime.now().isoformat(),
    })


def on_bouton_2_appuye():
    print("Bouton 2 appuyé")
    publier_alerte_mqtt(MQTT_TOPIC_RADIATION, {
        "type": "radiation",
        "message": "Fuite de radiation détectée",
        "timestamp": datetime.now().isoformat(),
    })


def on_bouton_3_appuye():
    print("Bouton 3 appuyé")
    publier_alerte_mqtt(MQTT_TOPIC_SABOTAGE, {
        "type": "sabotage",
        "message": "Sabotage détecté : panne du système de survie du vaisseau",
        "timestamp": datetime.now().isoformat(),
    })


# Association de chaque bouton à son callback.
bt1.when_pressed = on_bouton_1_appuye
bt2.when_pressed = on_bouton_2_appuye
bt3.when_pressed = on_bouton_3_appuye


# ---------------------------------------------------------------------------
# INITIALISATION DU CAPTEUR DHT22
# ---------------------------------------------------------------------------
dht_capteur = adafruit_dht.DHT22(PIN_CAPTEUR_DHT)


def lire_temperature():
    """
    Effectue une lecture du capteur DHT22 et renvoie la température en °C,
    ou None si la lecture a échoué (les échecs ponctuels sont normaux et
    fréquents avec ce type de capteur, il ne faut pas les traiter comme
    une erreur fatale).
    """
    try:
        return dht_capteur.temperature
    except RuntimeError as erreur:
        # Échecs de lecture ponctuels normaux avec ce capteur : on log et on
        # réessaie au prochain cycle, sans arrêter le programme.
        print(f"Lecture DHT22 échouée, nouvelle tentative au prochain cycle : {erreur}")
        return None


# ---------------------------------------------------------------------------
# BOUCLE PRINCIPALE : lecture continue de la température
# ---------------------------------------------------------------------------
# Les boutons sont gérés en arrière-plan par leurs callbacks gpiozero, donc
# cette boucle ne s'occupe que du capteur de température.
print("Démarrage de la surveillance (boutons + température). Ctrl+C pour quitter.")

# Mémorise si on est déjà en alerte incendie, pour ne déclencher un message
# qu'au moment où l'état change (front montant/descendant) et non à chaque
# lecture tant que la température reste au-dessus du seuil.
en_alerte_incendie = False

try:
    while True:
        temperature = lire_temperature()

        if temperature is not None:
            print(f"Température actuelle : {temperature} °C")

            if temperature > SEUIL_ALERTE_TEMPERATURE and not en_alerte_incendie:
                # Front montant : passage de "normal" à "en alerte".
                en_alerte_incendie = True
                print(f"!!! ALERTE : température de {temperature} °C supérieure au seuil de {SEUIL_ALERTE_TEMPERATURE} °C !!!")
                publier_alerte_mqtt(MQTT_TOPIC_INCENDIE, {
                    "type": "incendie",
                    "message": "Température anormalement élevée détectée",
                    "temperature": temperature,
                    "timestamp": datetime.now().isoformat(),
                })

            elif temperature <= SEUIL_ALERTE_TEMPERATURE and en_alerte_incendie:
                # Front descendant : retour de "en alerte" à "normal".
                en_alerte_incendie = False
                print(f"Fin d'alerte : température de {temperature} °C revenue sous le seuil de {SEUIL_ALERTE_TEMPERATURE} °C. Retour à la normale.")
                publier_alerte_mqtt(MQTT_TOPIC_INCENDIE, {
                    "type": "incendie_fin",
                    "message": "Retour à la normale : température repassée sous le seuil",
                    "temperature": temperature,
                    "timestamp": datetime.now().isoformat(),
                })

        time.sleep(INTERVALLE_LECTURE_DHT)

except KeyboardInterrupt:
    # Arrêt propre du programme sur Ctrl+C.
    print("\nArrêt du programme demandé par l'utilisateur.")

finally:
    # Libère les ressources du capteur (évite les erreurs si le script est
    # relancé juste après) et ferme proprement la connexion MQTT.
    dht_capteur.exit()
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
