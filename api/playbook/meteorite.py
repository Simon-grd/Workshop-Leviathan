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

meteorite = Playbook(
    id="meteorite",
    nom="Protocole impact météorite",
    zone="labo",
    declencheur=Declencheur(
        evenement="Impact de météorite signalé en zone labo.",
        condition="impact_detecte",
    ),
    etapes=[
        Etape(
            delai=1,
            role="PONT",
            message="Impact de météorite en zone labo. Alerte équipage.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "alerte"}),
        ),
        Etape(
            delai=2,
            role="IA-BORD",
            message="Brèche détectée dans la coque. Chute de pression.",
            action=Action("set_o2", {"zone": "labo", "valeur": "baisse"}),
        ),
        Etape(
            delai=4,
            role="IA-BORD",
            message="Fermeture des cloisons étanches, secteur isolé.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "isole"}),
        ),
        Etape(
            delai=6,
            role="PONT",
            message="Évacuation vers Support vie.",
            action=Action("evacuer", {"de": "labo", "vers": "support-vie"}),
        ),
        Etape(
            delai=8,
            role="IA-BORD",
            message="Bilan des dégâts : laboratoire hors ligne.",
            action=Action("set_zone_etat", {"zone": "labo", "valeur": "hors_ligne"}),
        ),
    ],
)