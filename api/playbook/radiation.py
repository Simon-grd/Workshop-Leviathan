from dataclasses import dataclass, field
from typing import Any
 
 
@dataclass
class Action:
    type: str
    params: dict[str, Any] = field(default_factory=dict)
 
 
@dataclass
class Etape:
    delai: int  # en secondes
    role: str
    message: str
    action: Action
 
 
@dataclass
class Sortie:
    condition: str
    message: str
    action: Action
 
 
@dataclass
class Surveillance:
    role: str
    intervalle: int  # en secondes
    message: str  # gabarit : utiliser message.format(rad=...)
    sortie: Sortie
 
 
@dataclass
class Declencheur:
    evenement: str
    condition: str
@dataclass
class Playbook:
    id: str
    nom: str
    zone: str
    declencheur: Declencheur
    etapes: list[Etape]
    surveillance: Surveillance
 
 
PLAYBOOK_RADIATION = Playbook(
    id="radiation",
    nom="Protocole radiation",
    zone="labo",
    declencheur=Declencheur(
        evenement="Pic de radiation signalé en zone labo.",
        condition="rad_elevee",
    ),
    etapes=[
        Etape(
            delai=1,
            role="IA-BORD",
            message="Verrouillage des accès à la zone labo.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "verrouille"}),
        ),
        Etape(
            delai=3,
            role="PONT",
            message="Confinement de l'équipage à Support vie.",
            action=Action("evacuer", {"de": "labo", "vers": "support-vie"}),
        ),
        Etape(
            delai=5,
            role="IA-BORD",
            message="Activation du blindage magnétique.",
            action=Action("set_blindage", {"zone": "labo", "valeur": True}),
        ),
    ],
    surveillance=Surveillance(
        role="MEDECIN",
        intervalle=10,
        message="Relevé dosimètres zone labo : {rad}",
        sortie=Sortie(
            condition="rad_stable",
            message="Radiation stable, retour au nominal. Zone labo réhabilitée.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "nominal"}),
        ),
    ),
)

 
if __name__ == "__main__":
    pb = PLAYBOOK_RADIATION
    print(f"{pb.nom} ({pb.id}) - zone {pb.zone}")
    for e in pb.etapes:
        print(f"[+{e.delai}s] {e.role}: {e.message} -> {e.action.type} {e.action.params}")
    print(pb.surveillance.message.format(rad=1.2))