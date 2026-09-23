import sys
import os
import time
import json
from proxmoxer import ProxmoxAPI

chemin_api = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if chemin_api not in sys.path:
    sys.path.append(chemin_api)

from app.logger import log_incident

# Mémoire d'état pour la règle des "10 secondes"
# Format: {"pve-node01": {"timestamp": 1690000000, "etat": "normal"}}
ETAT_NOEUDS = {}

# Mapping simplifié pour savoir où migrer et quels secteurs sont faibles
SECTEURS_FAIBLES = {
    "pve-node01": [{"vmid": "205", "nom": "labo", "repli": "pve-node02"}],
    "pve-node02": [{"vmid": "206", "nom": "loisirs", "repli": "pve-node03"}],
    "pve-node03": [{"vmid": "204", "nom": "serre", "repli": "pve-node01"}]
}

def get_proxmox():
    return ProxmoxAPI(
        os.getenv("PROXMOX_HOST", "10.0.0.1"),
        user=os.getenv("PROXMOX_USER", "root@pam"),
        token_name=os.getenv("PROXMOX_TOKEN_NAME", "api-token"),
        token_value=os.getenv("PROXMOX_TOKEN_VALUE", "xxxx-xxxx-xxxx-xxxx"),
        verify_ssl=False
    )

def evaluer_surchauffe(mqtt_client, node, temp):
    t_start = time.time()
    now = time.time()
    actions_prises = []
    
    # Initialisation de l'état du nœud s'il est inconnu
    if node not in ETAT_NOEUDS:
        ETAT_NOEUDS[node] = {"timestamp": now, "etat": "normal"}
        
    etat_actuel = ETAT_NOEUDS[node]["etat"]

    # 1. Retour à la normale (< 35°C)
    if temp < 35 and etat_actuel != "normal":
        # Éteindre le ventilateur
        mqtt_client.publish(f"leviathan/relais/fan/{node}", json.dumps({"state": "OFF"}))
        actions_prises.append(f"Ventilateur {node} OFF")
        
        # Rallumer les conteneurs s'ils avaient été coupés
        px = get_proxmox()
        for secteur in SECTEURS_FAIBLES.get(node, []):
            status = px.nodes(node).lxc(secteur["vmid"]).status.current.get().get("status")
            if status == "stopped":
                px.nodes(node).lxc(secteur["vmid"]).status.start.post()
                actions_prises.append(f"Restauration (allumage) de {secteur['nom']}")
                
        ETAT_NOEUDS[node] = {"timestamp": now, "etat": "normal"}
        
        log_incident(mqtt_client, node, "Basse", f"Fin de surchauffe ({temp}°C)", actions_prises, "Température stabilisée", t_start, time.time())
        return

    # 2. Détection Surchauffe Critique (> 50°C)
    if temp >= 50 and etat_actuel != "critique":
        px = get_proxmox()
        for secteur in SECTEURS_FAIBLES.get(node, []):
            status = px.nodes(node).lxc(secteur["vmid"]).status.current.get().get("status")
            if status == "running":
                px.nodes(node).lxc(secteur["vmid"]).status.stop.post()
                actions_prises.append(f"Coupure d'urgence de {secteur['nom']}")
                
        ETAT_NOEUDS[node]["etat"] = "critique"
        log_incident(mqtt_client, node, "Critique", f"Surchauffe extrême ({temp}°C)", actions_prises, "Secteurs faibles coupés", t_start, time.time())
        return

    # 3. Détection Surchauffe Modérée (> 40°C)
    if 40 <= temp < 50:
        if etat_actuel == "normal":
            # Le compte à rebours de 10s commence
            ETAT_NOEUDS[node] = {"timestamp": now, "etat": "warning"}
        
        elif etat_actuel == "warning":
            duree = now - ETAT_NOEUDS[node]["timestamp"]
            if duree >= 10:
                # La barre des 10 secondes est franchie
                mqtt_client.publish(f"leviathan/relais/fan/{node}", json.dumps({"state": "ON"}))
                actions_prises.append(f"Ventilateur {node} ON")
                
                px = get_proxmox()
                for secteur in SECTEURS_FAIBLES.get(node, []):
                    # Migration du conteneur vers le nœud de repli
                    actions_prises.append(f"Migration {secteur['nom']} vers {secteur['repli']}")
                    try:
                        px.nodes(node).lxc(secteur["vmid"]).migrate.post(target=secteur["repli"])
                    except Exception as e:
                        actions_prises.append(f"Échec migration {secteur['nom']}: {str(e)}")

                ETAT_NOEUDS[node]["etat"] = "migrated"
                log_incident(mqtt_client, node, "Haute", f"Surchauffe > 40°C pdt 10s ({temp}°C)", actions_prises, "Ventilation activée et nœud allégé", t_start, time.time())