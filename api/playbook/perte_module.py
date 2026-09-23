import sys
import os
import time
import json
from proxmoxer import ProxmoxAPI

chemin_api = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if chemin_api not in sys.path:
    sys.path.append(chemin_api)

from app.logger import log_incident

# Mémoire de l'état des nœuds pour ne déclencher l'alerte qu'une fois
ETAT_NOEUDS = {
    "pve-node01": True,
    "pve-node02": True,
    "pve-node03": True
}

# Services critiques qui doivent être protégés par la HA (High Availability)
SERVICES_CRITIQUES = ["201", "202", "203"]

# Secteurs sacrifiables pour sauver le cluster
SECTEURS_DELESTABLES = ["204", "205", "206"]

# Mapping pour l'interface utilisateur
ZONE_MAPPING = {
    "pve-node01": "laboratoire",
    "pve-node02": "loisirs",
    "pve-node03": "support_vie"
}

def get_proxmox():
    return ProxmoxAPI(
        os.getenv("PROXMOX_HOST", "10.0.0.1"),
        user=os.getenv("PROXMOX_USER", "root@pam"),
        token_name=os.getenv("PROXMOX_TOKEN_NAME", "api-token"),
        token_value=os.getenv("PROXMOX_TOKEN_VALUE", "xxxx-xxxx-xxxx-xxxx"),
        verify_ssl=False
    )

def evaluer_perte_noeud(mqtt_client, node_id, is_up):
    t_start = time.time()
    actions_prises = []
    
    # 1. Mise à jour de l'état et arrêt anticipé si pas de changement
    etat_precedent = ETAT_NOEUDS.get(node_id, True)
    ETAT_NOEUDS[node_id] = is_up
    
    if is_up or not etat_precedent:
        return # Le nœud va bien, ou était déjà déclaré mort

    try:
        px = get_proxmox()
        zone_ui = ZONE_MAPPING.get(node_id, "passerelle")
        
        # 2. Action UI : Passer la zone en rouge (status: offline/alert)
        mqtt_client.publish(f"leviathan/secteurs/{zone_ui}/telemetry", json.dumps({"status": "offline"}))
        actions_prises.append(f"Alerte UI: {zone_ui} hors ligne")

        # 3. Délestage préventif : On coupe les secteurs faibles sur les AUTRES nœuds
        # Car avec un nœud en moins, le cluster n'a plus assez de RAM pour tout faire tourner
        for vmid in SECTEURS_DELESTABLES:
            try:
                # On cherche où se trouve ce VMID actuellement
                for n in px.nodes.get():
                    node_name = n["node"]
                    # On évite d'interroger le nœud mort
                    if node_name != node_id:
                        for lxc in px.nodes(node_name).lxc.get():
                            if str(lxc["vmid"]) == vmid and lxc["status"] == "running":
                                px.nodes(node_name).lxc(vmid).status.stop.post()
                                actions_prises.append(f"Délestage CT {vmid} sur {node_name}")
            except Exception:
                pass # Ignorer les erreurs si un CT est introuvable

        # 4. Vérification de la reprise HA (High Availability)
        actions_prises.append("Vérification de la bascule HA pour les services critiques")
        services_restaures = 0
        timeout_ha = 30 # On attend max 30 secondes que Proxmox redémarre les CT critiques
        
        while services_restaures < len(SERVICES_CRITIQUES) and (time.time() - t_start) < timeout_ha:
            services_restaures = 0
            # On vérifie sur les nœuds survivants si les services critiques tournent
            for n in px.nodes.get():
                if n["node"] != node_id:
                    for lxc in px.nodes(n["node"]).lxc.get():
                        if str(lxc["vmid"]) in SERVICES_CRITIQUES and lxc["status"] == "running":
                            services_restaures += 1
            if services_restaures < len(SERVICES_CRITIQUES):
                time.sleep(2) # On patiente pendant que Proxmox fait la bascule

        temps_reprise = time.time() - t_start
        
        if services_restaures == len(SERVICES_CRITIQUES):
            actions_prises.append(f"Succès HA: Tous les services critiques ont migré et tournent")
            statut_final = "Reprise d'activité HA réussie avec délestage"
        else:
            actions_prises.append("Échec HA: Certains services critiques ne sont pas remontés")
            statut_final = "Cluster instable (perte de quorum ou RAM insuffisante)"

        # 5. Journalisation avec le temps de reprise précis pour la soutenance
        log_incident(
            mqtt_client=mqtt_client,
            zone=node_id,
            severity="Critique",
            rule="Perte de nœud (Quorum/Réseau)",
            actions=actions_prises,
            result=statut_final,
            t_start=t_start,
            t_end=time.time()
        )

    except Exception as e:
        print(f"❌ Erreur Playbook Perte Nœud: {e}")