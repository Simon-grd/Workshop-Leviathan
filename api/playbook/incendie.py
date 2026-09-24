from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Declencheur:
    evenement: str
    condition: str


@dataclass(frozen=True)
class Action:
    type: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Etape:
    delai: float  # en secondes
    role: str
    message: str
    action: Action


@dataclass(frozen=True)
class Playbook:
    id: str
    nom: str
    zone: str
    declencheur: Declencheur
    etapes: list[Etape]


incendie = Playbook(
    id="incendie",
    nom="Protocole incendie",
    zone="labo",
    declencheur=Declencheur(
        evenement="Incendie signalé en zone labo.",
        condition="temperature_anormale",
    ),
    etapes=[
        Etape(
            delai=1,
            role="IA-BORD",
            message="Isolation du laboratoire : fermeture des sas.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "isole"}),
        ),
        Etape(
            delai=2,
            role="IA-BORD",
            message="Coupure de la ventilation de la zone labo.",
            action=Action("set_ventilation", {"zone": "labo", "valeur": False}),
        ),
        Etape(
            delai=4,
            role="IA-BORD",
            message="Injection de gaz inerte en cours.",
            action=Action("set_gaz_inerte", {"zone": "labo", "valeur": True}),
        ),
        Etape(
            delai=6,
            role="PONT",
            message="Alerte équipage : évacuation vers Support vie.",
            action=Action("evacuer", {"de": "labo", "vers": "support-vie"}),
        ),
    ],
)