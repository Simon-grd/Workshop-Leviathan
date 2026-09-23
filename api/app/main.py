"""Terminal de commande manuel : FastAPI + WebSocket + double authentification.

Squelette : les routes suivent docs/api-contract.md.
"""
import json
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket
import paho.mqtt.client as mqtt_lib

# Import des playbooks
from playbook.crise_energie import evaluer_crise_energie
from playbook.surchauffe import evaluer_surchauffe
from playbook.perte_module import evaluer_perte_noeud

# --- CONFIGURATION DU MOTEUR MQTT ---
MQTT_BROKER = "test.mosquitto.org" # Serveur de test public
MQTT_PORT = 1883
mqtt_client = mqtt_lib.Client()

def on_connect(client, userdata, flags, rc):
    print("✅ [MOTEUR] Connecté au broker MQTT")
    # On s'abonne aux topics pour les démos des playbooks
    client.subscribe("leviathan/energie/batterie")
    client.subscribe("leviathan/telemetrie/thermique/#")
    client.subscribe("leviathan/telemetrie/noeuds/#")

def on_message(client, userdata, msg):
    topic = msg.topic
    print(f"[MOTEUR] Message reçu sur {topic}")
    
    # --- PLAYBOOK 1 : CRISE ÉNERGÉTIQUE ---
    if topic == "leviathan/energie/batterie":
        try:
            payload = json.loads(msg.payload.decode())
            energie_disponible_pct = payload.get("energie_disponible_pct", 100)
            
            # Déclenche l'évaluation du playbook énergétique
            evaluer_crise_energie(client, energie_disponible_pct)
            
        except Exception as e:
            print(f"❌ [MOTEUR] Erreur de traitement MQTT (Énergie): {e}")

    # --- PLAYBOOK 2 : SURCHAUFFE THERMIQUE ---
    elif topic.startswith("leviathan/telemetrie/thermique/"):
        try:
            # Ex: leviathan/telemetrie/thermique/pve-node01
            node_id = topic.split("/")[-1] 
            payload = json.loads(msg.payload.decode())
            temperature = payload.get("temperature", 20)
            
            # Déclenche l'évaluation du playbook thermique
            evaluer_surchauffe(client, node_id, temperature)
            
        except Exception as e:
            print(f"❌ [MOTEUR] Erreur de lecture thermique: {e}")

    # --- PLAYBOOK 3 : PERTE DE NŒUD (HORS LIGNE) ---
    elif topic.startswith("leviathan/telemetrie/noeuds/"):
        try:
            # Ex: leviathan/telemetrie/noeuds/pve-node02
            node_id = topic.split("/")[-1] 
            payload = json.loads(msg.payload.decode())
            # Si le payload contient "up": 0, le nœud est considéré mort
            is_up = payload.get("up", 1) == 1
            
            # Déclenche l'évaluation du playbook de perte de module
            evaluer_perte_noeud(client, node_id, is_up)
            
        except Exception as e:
            print(f"❌ [MOTEUR] Erreur de lecture nœud: {e}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# --- CYCLE DE VIE FASTAPI (Démarrage/Arrêt du Moteur) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Action au démarrage de l'API
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start() # Lance MQTT en arrière-plan
    except Exception as e:
        print(f"⚠️ Impossible de se connecter à Mosquitto : {e}")
    
    yield # L'API FastAPI tourne ici
    
    # Action à l'arrêt de l'API
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    print("🛑 [MOTEUR] Déconnecté du broker MQTT")


# --- DÉCLARATION DE L'API ---
app = FastAPI(title="Léviathan Terminal", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login():
    # TODO : vérifier le mot de passe (argon2), renvoyer un jeton intermédiaire
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/2fa")
def two_factor():
    # TODO : vérifier le TOTP (pyotp), ouvrir la session (JWT à expiration courte)
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.get("/status")
def status():
    # TODO : interroger l'hyperviseur (état des conteneurs par tier)
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/restart")
def restart():
    # TODO : officier 1 → créer une demande "pending"
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.post("/approve/{request_id}")
def approve(request_id: str):
    # TODO : officier 2 (≠ officier 1) + TOTP → exécuter via l'hyperviseur
    raise HTTPException(status_code=501, detail="Non implémenté")


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    # TODO : pousser les états en direct (authentification requise)
    await websocket.accept()
    await websocket.send_json({"status": "connected"})
    await websocket.close()