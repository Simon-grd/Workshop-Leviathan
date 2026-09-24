from radiation import (
    Action,
    Declencheur,
    Etape,
    Playbook,
    Sortie,
    Surveillance,
)
 
PLAYBOOK_OVNI = Playbook(
    id="ovni_sabotage",
    nom="Intrusion OVNI et sabotage",
    zone="hangar",
    declencheur=Declencheur(
        evenement="Objet non identifié en approche, amarrage non autorisé au hangar.",
        condition="ovni_detecte",
    ),
    etapes=[
        Etape(
            delai=1,
            role="IA-BORD",
            message="Contact inconnu détecté. Alerte générale déclenchée.",
            action=Action("declencher_alarme", {"niveau": "rouge"}),
        ),
        Etape(
            delai=4,
            role="IA-BORD",
            message="Perte des communications externes : brouillage en cours.",
            action=Action("set_communications", {"externes": False}),
        ),
        Etape(
            delai=6,
            role="PONT",
            message="Évacuation du hangar. Repli de l'équipage vers Support vie.",
            action=Action("evacuer", {"de": "hangar", "vers": "support-vie"}),
        ),
Etape(
            delai=8,
            role="IA-BORD",
            message="Sabotage détecté : recycleur d'oxygène hors service.",
            action=Action("set_systeme", {"cible": "recycleur-o2", "etat": "hors_service"}),
        ),
        Etape(
            delai=10,
            role="IA-BORD",
            message="Cloisons étanches fermées, hangar isolé du reste du vaisseau.",
            action=Action("set_zone_etat", {"zone": "hangar", "valeur": "verrouille"}),
        ),
    ],
    surveillance=Surveillance(
        role="PONT",
        intervalle=8,
        message="Suivi de l'intrus, hangar : {statut}. Oxygène restant : {o2}%",
        sortie=Sortie(
            condition="intrus_neutralise",
            message="Intrus neutralisé. Recycleur réparé, retour au nominal.",
            action=Action("set_systeme", {"cible": "recycleur-o2", "etat": "nominal"}),
        ),
    ),
)
 
 
if __name__ == "__main__":
    pb = PLAYBOOK_OVNI
    print(f"{pb.nom} ({pb.id}) - zone {pb.zone}")
    for e in pb.etapes:
        print(f"[+{e.delai}s] {e.role}: {e.message} -> {e.action.type} {e.action.params}")
    print(pb.surveillance.message.format(statut="en mouvement", o2=74))