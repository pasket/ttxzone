"""TTX-Zone's exercise risk library (needs analysis, section 8, "Add from
the library"): risks to the exercise itself and how they are usually
handled, in both supported locales. Read-only and code-level; a risk picked
from it is a copy into the form. The first three are the defaults every new
form starts with (`default_risks`, read by `ttx_needs_form_service.add_default_risks`)."""

from dataclasses import dataclass
from enum import StrEnum


class RiskCategory(StrEnum):
    CONFIDENTIALITY = "confidentiality"
    PEOPLE = "people"
    OPERATIONS = "operations"
    LOGISTICS = "logistics"
    CONDUCT = "conduct"


@dataclass(frozen=True)
class RiskTemplate:
    id: str
    category: RiskCategory
    risk_en: str
    risk_es: str
    mitigation_en: str
    mitigation_es: str
    default: bool = False


R = RiskCategory

RISK_CATALOG: tuple[RiskTemplate, ...] = (
    RiskTemplate(
        "scenario-leak",
        R.CONFIDENTIALITY,
        "Scenario leak",
        "Filtración del escenario",
        "Share the scenario only with the planning team until the session.",
        "Compartir el escenario solo con el equipo de planificación hasta la sesión.",
        default=True,
    ),
    RiskTemplate(
        "key-people-absent",
        R.PEOPLE,
        "Key decision-makers absent",
        "Ausencia de asistentes imprescindibles",
        "Confirm attendance in advance and name a deputy for each key role.",
        "Confirmar la asistencia con antelación y designar un suplente por rol clave.",
        default=True,
    ),
    RiskTemplate(
        "real-incident",
        R.OPERATIONS,
        "A real incident coincides with the exercise",
        "Coincidencia con un incidente real",
        "Stop-exercise procedure: anyone says the agreed keyword and the exercise halts.",
        'Procedimiento "stop exercise": cualquiera dice la palabra clave acordada y el '
        "ejercicio se detiene.",
        default=True,
    ),
    RiskTemplate(
        "mistaken-for-real",
        R.OPERATIONS,
        "Exercise messages mistaken for a real incident",
        "Mensajes del ejercicio confundidos con un incidente real",
        'Mark every inject "EXERCISE"; never send simulated messages through production '
        "channels to people outside the session.",
        'Marcar cada inject como "EJERCICIO"; no enviar nunca mensajes simulados por canales de '
        "producción a personas ajenas a la sesión.",
    ),
    RiskTemplate(
        "real-systems-touched",
        R.OPERATIONS,
        "Players act on production systems",
        "Los jugadores actúan sobre sistemas en producción",
        "State at the briefing that every action is described, not executed; the Controller "
        "stops any real change.",
        "Explicar en la presentación que toda acción se describe, no se ejecuta; el Controlador "
        "detiene cualquier cambio real.",
    ),
    RiskTemplate(
        "sensitive-data-in-artifacts",
        R.CONFIDENTIALITY,
        "Real sensitive data in the exercise material",
        "Datos sensibles reales en el material del ejercicio",
        "Use fictitious names, documentation IP ranges and example domains; review every "
        "handout before the session.",
        "Usar nombres ficticios, rangos IP de documentación y dominios de ejemplo; revisar cada "
        "documento entregado antes de la sesión.",
    ),
    RiskTemplate(
        "findings-misused",
        R.CONFIDENTIALITY,
        "Findings used to blame individuals",
        "Uso de las conclusiones para culpar a personas",
        "Agree at the opening that the exercise evaluates plans and capabilities, not people; "
        "the report names roles, never persons.",
        "Acordar en la apertura que el ejercicio evalúa planes y capacidades, no personas; el "
        "informe nombra roles, nunca personas.",
    ),
    RiskTemplate(
        "dominant-participant",
        R.CONDUCT,
        "One participant dominates the discussion",
        "Un participante acapara la discusión",
        "The Facilitator addresses questions to each role in turn and keeps a parking lot for "
        "side topics.",
        "El Facilitador dirige las preguntas a cada rol por turnos y aparca los temas secundarios.",
    ),
    RiskTemplate(
        "fighting-the-scenario",
        R.CONDUCT,
        "Players dispute the scenario's realism",
        "Los jugadores discuten el realismo del escenario",
        "Explain the assumptions at the briefing; the Facilitator acknowledges the point and "
        "brings the discussion back to the objectives.",
        "Explicar las premisas en la presentación; el Facilitador reconoce la objeción y "
        "devuelve la discusión a los objetivos.",
    ),
    RiskTemplate(
        "overrun",
        R.CONDUCT,
        "The session runs out of time",
        "La sesión se queda sin tiempo",
        "Mark optional injects in the MSEL and let the Controller skip them; keep the hot wash "
        "slot fixed.",
        "Marcar injects opcionales en el MSEL para que el Controlador pueda saltarlos; mantener "
        "fijo el hueco del hot wash.",
    ),
    RiskTemplate(
        "platform-unavailable",
        R.LOGISTICS,
        "The exercise platform or network fails",
        "Fallo de la plataforma del ejercicio o de la red",
        "Print the inject cards and the Controller guide as a fallback; check connectivity the "
        "day before.",
        "Imprimir las tarjetas de inject y la guía del Controlador como respaldo; comprobar la "
        "conectividad el día anterior.",
    ),
    RiskTemplate(
        "remote-participation",
        R.LOGISTICS,
        "Remote participants lose the thread",
        "Los participantes en remoto pierden el hilo",
        "Name a Facilitator for remote attendees, share the screen of the current inject and "
        "test audio before starting.",
        "Designar un Facilitador para los asistentes en remoto, compartir en pantalla el inject "
        "en curso y probar el audio antes de empezar.",
    ),
    RiskTemplate(
        "supplier-confidentiality",
        R.CONFIDENTIALITY,
        "Third parties taking part see internal details",
        "Los terceros participantes ven detalles internos",
        "Sign a confidentiality agreement and limit their injects and documents to what they need.",
        "Firmar un acuerdo de confidencialidad y limitar sus injects y documentos a lo que "
        "necesiten.",
    ),
    RiskTemplate(
        "stress",
        R.PEOPLE,
        "Participants under stress from a recent real incident",
        "Participantes afectados por un incidente real reciente",
        "Talk to the managers concerned beforehand, avoid replaying the real event and allow "
        "anyone to step out.",
        "Hablar antes con los responsables afectados, evitar reproducir el suceso real y "
        "permitir que cualquiera se ausente.",
    ),
)


def default_risks(locale: str) -> tuple[tuple[str, str], ...]:
    """The (risk, mitigation) pairs a new form starts with, in `locale`."""
    spanish = locale == "es"
    return tuple(
        (r.risk_es, r.mitigation_es) if spanish else (r.risk_en, r.mitigation_en)
        for r in RISK_CATALOG
        if r.default
    )
