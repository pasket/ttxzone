"""TTX-Zone's own tags: the read-only first level of the tag library (then
each organization's own, then each exercise's). A code-level catalog like
the actor and inject ones, in both supported locales.

Nothing is ever tagged with these directly: using one copies it into the
organization's library (OrganizationTag, origin "system" + this id) or
into an exercise's (TTXTag). Ids are stable slugs; an entry is never
removed (copies keep naming it as their origin). Names fit the 24
characters every tag allows.

Each group has one colour, so a copied set reads as a family at a glance;
the colours are the curated TagColor swatches, never severity hues."""

from dataclasses import dataclass
from enum import StrEnum

from app.models.tag_color import TagColor


class SystemTagGroup(StrEnum):
    THREAT = "threat"  # what the scenario is about (the inject families)
    AUDIENCE = "audience"  # who plays
    REGULATION = "regulation"  # what the exercise gives evidence for
    PROGRAMME = "programme"  # where it sits in the exercise programme
    PEOPLE = "people"  # people, invitations and domains


GROUP_COLORS: dict[SystemTagGroup, TagColor] = {
    SystemTagGroup.THREAT: TagColor.ROSE,
    SystemTagGroup.AUDIENCE: TagColor.INDIGO,
    SystemTagGroup.REGULATION: TagColor.SLATE,
    SystemTagGroup.PROGRAMME: TagColor.MOSS,
    SystemTagGroup.PEOPLE: TagColor.SAND,
}


@dataclass(frozen=True)
class SystemTag:
    id: str
    group: SystemTagGroup
    name_en: str
    name_es: str
    description_en: str
    description_es: str

    @property
    def color(self) -> TagColor:
        return GROUP_COLORS[self.group]

    def name(self, locale: str) -> str:
        return self.name_es if locale == "es" else self.name_en


_T = SystemTagGroup.THREAT
_A = SystemTagGroup.AUDIENCE
_R = SystemTagGroup.REGULATION
_P = SystemTagGroup.PROGRAMME
_W = SystemTagGroup.PEOPLE

TAG_CATALOG: tuple[SystemTag, ...] = (
    # Threats -- one per inject family, so exercises and injects share words.
    SystemTag(
        "ransomware",
        _T,
        "Ransomware",
        "Ransomware",
        "Encryption, extortion and double extortion.",
        "Cifrado, extorsión y doble extorsión.",
    ),
    SystemTag(
        "data-breach",
        _T,
        "Data breach",
        "Fuga de datos",
        "Personal or confidential data exposed or stolen.",
        "Datos personales o confidenciales expuestos o robados.",
    ),
    SystemTag(
        "bec",
        _T,
        "BEC / CEO fraud",
        "BEC / Fraude del CEO",
        "Business email compromise and payment fraud.",
        "Compromiso de correo corporativo y fraude en pagos.",
    ),
    SystemTag(
        "phishing",
        _T,
        "Phishing",
        "Phishing",
        "Credential theft and malicious email campaigns.",
        "Robo de credenciales y campañas de correo malicioso.",
    ),
    SystemTag(
        "supply-chain",
        _T,
        "Supply chain",
        "Cadena de suministro",
        "An attack that comes in through a supplier or provider.",
        "Un ataque que entra a través de un proveedor.",
    ),
    SystemTag(
        "cloud",
        _T,
        "Cloud",
        "Cloud",
        "Cloud tenant, identity or SaaS compromise.",
        "Compromiso de un tenant cloud, de la identidad o de un SaaS.",
    ),
    SystemTag(
        "ddos",
        _T,
        "DDoS",
        "DDoS",
        "Denial of service against online services.",
        "Denegación de servicio contra los servicios en línea.",
    ),
    SystemTag(
        "insider",
        _T,
        "Insider threat",
        "Amenaza interna",
        "An employee or contractor misusing their access.",
        "Un empleado o contratista que abusa de su acceso.",
    ),
    SystemTag(
        "wiper",
        _T,
        "Wiper",
        "Wiper",
        "Destructive malware: data and systems erased.",
        "Malware destructivo: datos y sistemas borrados.",
    ),
    SystemTag(
        "ot-ics",
        _T,
        "OT / ICS",
        "OT / ICS",
        "Industrial control systems and operational technology.",
        "Sistemas de control industrial y tecnología operacional.",
    ),
    SystemTag(
        "hybrid",
        _T,
        "Hybrid threat",
        "Amenaza híbrida",
        "Cyber attack combined with disinformation or physical action.",
        "Ciberataque combinado con desinformación o acciones físicas.",
    ),
    # Audience.
    SystemTag(
        "executive",
        _A,
        "Executive",
        "Directivo",
        "Played by senior management: decisions, not technique.",
        "Lo juega la alta dirección: decisiones, no técnica.",
    ),
    SystemTag(
        "crisis-committee",
        _A,
        "Crisis committee",
        "Comité de crisis",
        "Played by the crisis management committee.",
        "Lo juega el comité de gestión de crisis.",
    ),
    SystemTag(
        "technical",
        _A,
        "Technical",
        "Técnico",
        "Played by IT, security and incident response teams.",
        "Lo juegan los equipos de TI, seguridad y respuesta a incidentes.",
    ),
    SystemTag(
        "mixed",
        _A,
        "Mixed audience",
        "Público mixto",
        "Executives and technical teams in the same session.",
        "Dirección y equipos técnicos en la misma sesión.",
    ),
    SystemTag(
        "communications",
        _A,
        "Communications",
        "Comunicación",
        "Press, internal communications and social media.",
        "Prensa, comunicación interna y redes sociales.",
    ),
    SystemTag(
        "legal-compliance",
        _A,
        "Legal & compliance",
        "Legal y cumplimiento",
        "Legal counsel, compliance and the data protection officer.",
        "Asesoría jurídica, cumplimiento y delegado de protección de datos.",
    ),
    # Regulation -- what the exercise gives evidence for.
    SystemTag(
        "nis2",
        _R,
        "NIS2",
        "NIS2",
        "Evidence for the NIS2 directive.",
        "Evidencia para la directiva NIS2.",
    ),
    SystemTag(
        "dora",
        _R,
        "DORA",
        "DORA",
        "Evidence for the Digital Operational Resilience Act.",
        "Evidencia para el Reglamento de resiliencia operativa digital.",
    ),
    SystemTag(
        "gdpr",
        _R,
        "GDPR",
        "RGPD",
        "Personal data breach handling and notification.",
        "Gestión y notificación de brechas de datos personales.",
    ),
    SystemTag(
        "ens",
        _R,
        "ENS",
        "ENS",
        "Evidence for Spain's National Security Framework.",
        "Evidencia para el Esquema Nacional de Seguridad.",
    ),
    SystemTag(
        "iso-27001",
        _R,
        "ISO 27001",
        "ISO 27001",
        "Evidence for the information security management system.",
        "Evidencia para el sistema de gestión de seguridad de la información.",
    ),
    SystemTag(
        "iso-22301",
        _R,
        "ISO 22301",
        "ISO 22301",
        "Evidence for the business continuity management system.",
        "Evidencia para el sistema de gestión de continuidad de negocio.",
    ),
    SystemTag(
        "nccs",
        _R,
        "NCCS",
        "NCCS",
        "Network code on cybersecurity for the electricity sector.",
        "Código de red de ciberseguridad del sector eléctrico.",
    ),
    # Where the exercise sits in the programme.
    SystemTag(
        "first-exercise",
        _P,
        "First exercise",
        "Primer ejercicio",
        "The team's first exercise: a baseline to measure from.",
        "El primer ejercicio del equipo: la referencia desde la que medir.",
    ),
    SystemTag(
        "annual-programme",
        _P,
        "Annual programme",
        "Programa anual",
        "Part of the yearly exercise programme.",
        "Parte del programa anual de ejercicios.",
    ),
    SystemTag(
        "post-incident",
        _P,
        "Post-incident",
        "Tras incidente real",
        "Built on a real incident, to check the lessons learned.",
        "Basado en un incidente real, para comprobar las lecciones aprendidas.",
    ),
    SystemTag(
        "plan-validation",
        _P,
        "Plan validation",
        "Validación de plan",
        "Tests a new or updated response plan or playbook.",
        "Pone a prueba un plan de respuesta o un playbook nuevo o actualizado.",
    ),
    SystemTag(
        "training",
        _P,
        "Training",
        "Formación",
        "Mainly for learning; findings aren't formally tracked.",
        "Sobre todo para aprender; los hallazgos no se siguen formalmente.",
    ),
    SystemTag(
        "audit-evidence",
        _P,
        "Audit evidence",
        "Evidencia de auditoría",
        "Its report will be shown to an auditor or supervisor.",
        "Su informe se enseñará a un auditor o a un supervisor.",
    ),
    # People, invitations and domains.
    SystemTag(
        "external",
        _W,
        "External",
        "Externo",
        "Someone from outside the organization.",
        "Alguien de fuera de la organización.",
    ),
    SystemTag(
        "supplier",
        _W,
        "Supplier",
        "Proveedor",
        "Someone who takes part on behalf of a supplier.",
        "Alguien que participa en nombre de un proveedor.",
    ),
    SystemTag(
        "subsidiary",
        _W,
        "Subsidiary",
        "Filial",
        "Someone from, or a domain of, a subsidiary.",
        "Alguien de una filial, o un dominio suyo.",
    ),
    SystemTag(
        "observer",
        _W,
        "Observer",
        "Observador",
        "Watches the session without playing.",
        "Asiste a la sesión sin jugar.",
    ),
    SystemTag(
        "backup",
        _W,
        "Backup",
        "Suplente",
        "Stands in if the usual person can't attend.",
        "Sustituye a la persona habitual si no puede asistir.",
    ),
)

TAG_CATALOG_BY_ID: dict[str, SystemTag] = {tag.id: tag for tag in TAG_CATALOG}
