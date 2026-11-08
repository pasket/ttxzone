"""TTX-Zone's own simulated actors: the read-only first level of the actor
library (then each organization's own, then each exercise's cast). A
code-level catalog like the regulatory and ATT&CK ones, in both supported
locales. Generic roles only -- never a real organization.

An exercise never points at these: using one copies it into the MSEL's
cast (MselSimulatedActor, origin "system" + this id), and duplicating one
into an organization's library copies it there. Ids are stable slugs; an
entry is never removed (copies keep naming it as their origin).

`default` entries seed every new MSEL; `frameworks` entries are suggested
when the needs analysis names one of those regulations (NCCS keeps the
electricity-sector actors out of other sectors' exercises)."""

from dataclasses import dataclass

from app.models.inject import DeliveryMethod
from app.models.ttx_msel import ActorType


@dataclass(frozen=True)
class SystemActor:
    id: str
    type: ActorType
    name_en: str
    name_es: str
    description_en: str
    description_es: str
    channel: DeliveryMethod
    default: bool = False
    frameworks: tuple[str, ...] = ()

    def name(self, locale: str) -> str:
        return self.name_es if locale == "es" else self.name_en

    def description(self, locale: str) -> str:
        return self.description_es if locale == "es" else self.description_en


# Order: the seeded defaults first (in the order a new MSEL lists them),
# then the rest by kind.
ACTOR_CATALOG: tuple[SystemActor, ...] = (
    SystemActor(
        "soc",
        ActorType.SOC,
        "SOC",
        "SOC",
        "The security operations centre: alerts, findings and requests for decisions.",
        "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
        DeliveryMethod.TICKET,
        default=True,
    ),
    SystemActor(
        "national-csirt",
        ActorType.CSIRT,
        "National CSIRT",
        "CSIRT nacional",
        "The national incident response team: asks for reports and shares indicators.",
        "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
        DeliveryMethod.EMAIL,
        default=True,
    ),
    SystemActor(
        "competent-authority",
        ActorType.AUTHORITY,
        "Competent authority",
        "Autoridad competente",
        "The cybersecurity authority the organization reports incidents to.",
        "La autoridad de ciberseguridad a la que la organización notifica los incidentes.",
        DeliveryMethod.EMAIL,
        default=True,
    ),
    SystemActor(
        "media",
        ActorType.MEDIA,
        "Media",
        "Medios de comunicación",
        "Journalists asking questions or publishing about the incident.",
        "Periodistas que preguntan o publican sobre el incidente.",
        DeliveryMethod.MEDIA,
        default=True,
    ),
    SystemActor(
        "critical-supplier",
        ActorType.SUPPLIER,
        "Critical supplier",
        "Proveedor crítico",
        "A supplier the business depends on, affected by or involved in the incident.",
        "Un proveedor del que depende el negocio, afectado o implicado en el incidente.",
        DeliveryMethod.PHONE,
        default=True,
    ),
    SystemActor(
        "customer",
        ActorType.CUSTOMER,
        "Customer",
        "Cliente",
        "A customer noticing the impact and asking for explanations.",
        "Un cliente que nota el impacto y pide explicaciones.",
        DeliveryMethod.EMAIL,
        default=True,
    ),
    SystemActor(
        "threat-actor",
        ActorType.THREAT_ACTOR,
        "Attacker (sender)",
        "Atacante (remitente)",
        "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the "
        "attacker is, and its techniques, are the scenario's threat actors.",
        "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, "
        "plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
        DeliveryMethod.DOCUMENT,
        default=True,
    ),
    # Other security operations and response teams. Simulated actors are
    # who is *not* playing: an internal team only belongs here when it
    # isn't in the room.
    SystemActor(
        "soc-local",
        ActorType.SOC,
        "Local SOC",
        "SOC local",
        "A site's or country's SOC, with a restricted scope: escalates what it sees locally.",
        "El SOC de una sede o un país, de ámbito restringido: escala lo que ve en local.",
        DeliveryMethod.TICKET,
    ),
    SystemActor(
        "soc-global",
        ActorType.SOC,
        "Global SOC",
        "SOC global",
        "The group-wide SOC coordinating the local ones: correlates alerts and asks for decisions.",
        ("El SOC de todo el grupo, que coordina a los locales: correla alertas y pide decisiones."),
        DeliveryMethod.TICKET,
    ),
    SystemActor(
        "soc-business-unit",
        ActorType.SOC,
        "Business-unit SOC",
        "SOC de negocio",
        "A subsidiary's or business line's own SOC: reports what affects its part of the business.",
        (
            "El SOC propio de una filial o línea de negocio: informa de lo que afecta a su parte "
            "del negocio."
        ),
        DeliveryMethod.TICKET,
    ),
    SystemActor(
        "csirt-global",
        ActorType.CSIRT,
        "Group CSIRT",
        "CSIRT global",
        (
            "The group's incident response team: coordinates the response across companies and "
            "countries."
        ),
        (
            "El equipo de respuesta a incidentes del grupo: coordina la respuesta entre empresas "
            "y países."
        ),
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "csirt-local",
        ActorType.CSIRT,
        "Local CSIRT",
        "CSIRT local",
        (
            "A site's or country's incident response team, with a restricted scope: handles "
            "the incident locally and reports to the group CSIRT."
        ),
        (
            "El equipo de respuesta a incidentes de una sede o un país, de ámbito restringido: "
            "gestiona el incidente en local e informa al CSIRT global."
        ),
        DeliveryMethod.TICKET,
    ),
    SystemActor(
        "cybersecurity-team-member",
        ActorType.INTERNAL,
        "Cybersecurity team member",
        "Miembro del equipo de ciberseguridad",
        (
            "An analyst or engineer reporting what a security tool shows, when the cybersecurity "
            "team isn't playing."
        ),
        (
            "Un analista o ingeniero que informa de lo que muestra una herramienta de seguridad, "
            "cuando el equipo de ciberseguridad no juega."
        ),
        DeliveryMethod.SECURITY_TOOL,
    ),
    SystemActor(
        "electricity-operator",
        ActorType.OTHER,
        "Electricity system operator",
        "Operador del sistema eléctrico",
        "The transmission system operator coordinating the grid during the incident.",
        "El operador del sistema de transporte que coordina la red durante el incidente.",
        DeliveryMethod.PHONE,
        frameworks=("NCCS",),
    ),
    SystemActor(
        "nccs-authority",
        ActorType.AUTHORITY,
        "NCCS competent authority",
        "Autoridad competente NCCS",
        "The authority overseeing cybersecurity of cross-border electricity flows.",
        "La autoridad que supervisa la ciberseguridad de los flujos eléctricos transfronterizos.",
        DeliveryMethod.EMAIL,
        frameworks=("NCCS",),
    ),
    SystemActor(
        "data-protection-authority",
        ActorType.AUTHORITY,
        "Data protection authority",
        "Autoridad de protección de datos",
        "The supervisory authority for personal data breaches.",
        "La autoridad de control ante brechas de datos personales.",
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "financial-supervisor",
        ActorType.AUTHORITY,
        "Financial supervisor",
        "Supervisor financiero",
        "The financial-sector supervisor receiving major ICT incident reports.",
        "El supervisor del sector financiero que recibe las notificaciones de incidentes "
        "TIC graves.",
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "police-cybercrime",
        ActorType.AUTHORITY,
        "Police cybercrime unit",
        "Unidad de delitos informáticos",
        "Law enforcement investigating the attack and asking for evidence.",
        "Las fuerzas de seguridad que investigan el ataque y piden evidencias.",
        DeliveryMethod.PHONE,
    ),
    SystemActor(
        "managed-service-provider",
        ActorType.SUPPLIER,
        "Managed service provider",
        "Proveedor de servicios gestionados",
        "The MSP running part of the infrastructure, possibly the way in.",
        "El proveedor que gestiona parte de la infraestructura, quizá la vía de entrada.",
        DeliveryMethod.PHONE,
    ),
    SystemActor(
        "cloud-provider",
        ActorType.SUPPLIER,
        "Cloud provider",
        "Proveedor cloud",
        "The cloud platform the affected services run on.",
        "La plataforma cloud en la que corren los servicios afectados.",
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "cyber-insurer",
        ActorType.OTHER,
        "Cyber insurer",
        "Aseguradora de ciberriesgo",
        "The insurer: policy conditions, approved responders and notification deadlines.",
        "La aseguradora: condiciones de la póliza, proveedores aprobados y plazos de aviso.",
        DeliveryMethod.PHONE,
    ),
    SystemActor(
        "external-counsel",
        ActorType.OTHER,
        "External legal counsel",
        "Asesoría legal externa",
        "Outside lawyers advising on notifications, liability and communications.",
        "Abogados externos que asesoran sobre notificaciones, responsabilidad y comunicación.",
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "insider",
        ActorType.INTERNAL,
        "Employee",
        "Empleado",
        "An employee reporting something odd -- or the insider behind it.",
        "Un empleado que avisa de algo extraño, o el insider que está detrás.",
        DeliveryMethod.IN_PERSON,
    ),
    SystemActor(
        "dfir-provider",
        ActorType.SUPPLIER,
        "Incident response provider (retainer)",
        "Proveedor de respuesta a incidentes (retainer)",
        (
            "The external response and forensics team, usually under a retainer activated "
            "during the incident: findings, reports and containment advice."
        ),
        (
            "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) "
            "que se activa durante el incidente: hallazgos, informes y recomendaciones de "
            "contención."
        ),
        DeliveryMethod.BRIEFING,
    ),
    SystemActor(
        "threat-intel-provider",
        ActorType.SUPPLIER,
        "Threat intelligence provider",
        "Proveedor de inteligencia de amenazas",
        "Monitors forums, leak sites and social media: reports exposed data and attacker activity.",
        (
            "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la "
            "actividad del atacante."
        ),
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "bank",
        ActorType.OTHER,
        "The organisation's bank",
        "Banco de la organización",
        "The bank: suspicious transfers, fund recalls and recovery deadlines.",
        (
            "La entidad bancaria: transferencias sospechosas, retención de fondos y plazos para "
            "recuperarlos."
        ),
        DeliveryMethod.PHONE,
    ),
    SystemActor(
        "security-researcher",
        ActorType.OTHER,
        "Security researcher",
        "Investigador de seguridad",
        (
            "An external researcher reporting a vulnerability or exposure, sometimes asking for a"
            " reward."
        ),
        (
            "Un investigador externo que comunica una vulnerabilidad o una exposición, a veces "
            "pidiendo recompensa."
        ),
        DeliveryMethod.EMAIL,
    ),
    SystemActor(
        "board-chair",
        ActorType.INTERNAL,
        "Board chair",
        "Presidencia del consejo",
        "The chair of the board when the board isn't playing: demands answers and calls meetings.",
        (
            "La presidencia del consejo de administración cuando el consejo no juega: pide "
            "explicaciones y convoca sesiones."
        ),
        DeliveryMethod.PHONE,
    ),
)

ACTOR_CATALOG_BY_ID: dict[str, SystemActor] = {a.id: a for a in ACTOR_CATALOG}


def seed_actors(frameworks: list[str]) -> list[SystemActor]:
    """What a new MSEL's cast starts with: the defaults, plus the actors of
    the regulations its needs analysis names."""
    return [a for a in ACTOR_CATALOG if a.default or set(a.frameworks) & set(frameworks)]
