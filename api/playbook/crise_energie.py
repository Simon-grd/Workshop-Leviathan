import sys
import os
import time
from proxmoxer import ProxmoxAPI

# Configuration du chemin pour l'import
chemin_api = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if chemin_api not in sys.path:
    sys.path.append(chemin_api)

from app.logger import log_incident

# Liste ORDONNÉE du moins prioritaire (coupé en 1er) au plus prioritaire (coupé en dernier)
# Les CT 201 (Oxygène) et 202 (Comms) n'y figurent pas, ils sont donc physiquement impossibles à couper ici.
SECTEURS_PRIORITE_DELESTAGE = [
    {"vmid": "206", "nom": "loisirs", "node": "pve-node02", "seuil_requis": 80}, # Rallumé si énergie > 80%
    {"vmid": "205", "nom": "labo", "node": "pve-node01", "seuil_requis": 50},    # Rallumé si énergie > 50%
    {"vmid": "204", "nom": "serre", "node": "pve-node03", "seuil_requis": 30},   # Rallumé si énergie > 30%
]

def get_proxmox():
    return ProxmoxAPI(
        os.getenv("PROXMOX_HOST", "10.0.0.1"),
        user=os.getenv("PROXMOX_USER", "root@pam"),
        token_name=os.getenv("PROXMOX_TOKEN_NAME", "api-token"),
        token_value=os.getenv("PROXMOX_TOKEN_VALUE", "xxxx-xxxx-xxxx-xxxx"),
        verify_ssl=False
    )

def evaluer_crise_energie(mqtt_client, energie_pct):
    """
    Évalue le niveau d'énergie actuel et ajuste dynamiquement l'état des secteurs.
    Appelé à chaque fois que la télémétrie énergétique est mise à jour.
    """
    t_start = time.time()
    actions_prises = []
    
    try:
        px = get_proxmox()
        
        # 1. Mode Crise (Délestage) : on parcourt du moins au plus important
        for secteur in SECTEURS_PRIORITE_DELESTAGE:
            status = px.nodes(secteur["node"]).lxc(secteur["vmid"]).status.current.get().get("status")
            
            # Si l'énergie est sous le seuil requis pour ce secteur, on le coupe
            if energie_pct < secteur["seuil_requis"] and status == "running":
                px.nodes(secteur["node"]).lxc(secteur["vmid"]).status.stop.post()
                actions_prises.append(f"Coupure {secteur['nom'].upper()} (Énergie: {energie_pct}%)")
                
        # 2. Mode Retour à la normale (Rallumage) : on parcourt du plus au moins important (ordre inverse)
        for secteur in reversed(SECTEURS_PRIORITE_DELESTAGE):
            status = px.nodes(secteur["node"]).lxc(secteur["vmid"]).status.current.get().get("status")
            
            # Si l'énergie est remontée au-dessus de son seuil, on le rallume
            if energie_pct >= secteur["seuil_requis"] and status == "stopped":
                px.nodes(secteur["node"]).lxc(secteur["vmid"]).status.start.post()
                actions_prises.append(f"Rallumage {secteur['nom'].upper()} (Énergie suffisante: {energie_pct}%)")

        if not actions_prises:
            return # Rien n'a changé, on ne spamme pas le journal

        statut_final = "Succès - Ajustement du réseau énergétique appliqué"
        gravite = "Critique" if energie_pct < 30 else "Moyenne"

    except Exception as e:
        actions_prises.append(f"Erreur de communication Proxmox : {str(e)}")
        statut_final = "Échec - Procédure interrompue"
        gravite = "Haute"

    # Enregistrement de l'action dans le journal
    log_incident(
        mqtt_client=mqtt_client,
        zone="Vaisseau (Global)",
        severity=gravite,
        rule=f"Gestion d'énergie dynamique ({energie_pct}%)",
        actions=actions_prises,
        result=statut_final,
        t_start=t_start,
        t_end=time.time()
    )