# Verify article references against current consolidated texts before use in audits.
"""Regulatory requirements an exercise objective can evidence (needs form,
section 5). A platform-wide, read-only, code-level catalog -- not per
organization and not a table: objectives store these ids directly
(TTXObjective.regulatory_requirement_ids). Descriptions are carried in
both supported locales so the API can serve them as-is.

Sector-specific frameworks (NCCS applies to the electricity sector only)
are offered, never imposed: TTX-Zone serves every sector.

`framework` is the id of a REGULATORY_FRAMEWORKS entry when the requirement
belongs to one (clients show that framework's localized label), else a
display name (the ISO standards, which no trigger names)."""

from dataclasses import dataclass
from enum import StrEnum


@dataclass(frozen=True)
class RegulatoryRequirement:
    id: str
    framework: str
    reference: str
    description_en: str
    description_es: str


REGULATORY_CATALOG: tuple[RegulatoryRequirement, ...] = (
    RegulatoryRequirement(
        "NIS2-21-2-C",
        "NIS2",
        "Art. 21.2.c",
        "Business continuity and crisis management",
        "Continuidad de negocio y gestión de crisis",
    ),
    RegulatoryRequirement(
        "NIS2-21-2-F",
        "NIS2",
        "Art. 21.2.f",
        "Assessing the effectiveness of cybersecurity measures",
        "Evaluación de la eficacia de las medidas",
    ),
    RegulatoryRequirement(
        "NIS2-23",
        "NIS2",
        "Art. 23",
        "Incident reporting (24 h early warning, 72 h notification, final report)",
        "Notificación de incidentes (alerta temprana 24 h, notificación 72 h, informe final)",
    ),
    RegulatoryRequirement(
        "NCCS-CRISIS",
        "NCCS",
        "Reg. (EU) 2024/1366",
        "Cybersecurity crisis management and exercises (electricity sector)",
        "Gestión de crisis de ciberseguridad y ejercicios (sector eléctrico)",
    ),
    RegulatoryRequirement(
        "DORA-11",
        "DORA",
        "Art. 11",
        "ICT business continuity and crisis communication",
        "Continuidad TIC y comunicación de crisis",
    ),
    RegulatoryRequirement(
        "DORA-19",
        "DORA",
        "Art. 19",
        "Reporting of major ICT-related incidents (initial, intermediate and final reports)",
        "Notificación de incidentes graves relacionados con las TIC (informes inicial, "
        "intermedio y final)",
    ),
    RegulatoryRequirement(
        "DORA-24",
        "DORA",
        "Arts. 24–26",
        "Digital operational resilience testing programme",
        "Programa de pruebas de resiliencia operativa digital",
    ),
    RegulatoryRequirement(
        "ENS-OP-CONT-3",
        "ENS",
        "op.cont.3",
        "Periodic continuity testing",
        "Pruebas periódicas de continuidad",
    ),
    RegulatoryRequirement(
        "ENS-OP-EXP-7",
        "ENS",
        "op.exp.7",
        "Incident management",
        "Gestión de incidentes",
    ),
    RegulatoryRequirement(
        "ISO22301-8-5",
        "ISO 22301",
        "Cl. 8.5",
        "Exercise programme",
        "Programa de ejercicios",
    ),
    RegulatoryRequirement(
        "ISO27001-A5-24",
        "ISO/IEC 27001:2022",
        "A.5.24–A.5.30",
        "Incident preparedness and ICT continuity",
        "Preparación ante incidentes y continuidad TIC",
    ),
    RegulatoryRequirement(
        "ISO27035-2",
        "ISO/IEC 27035-2:2023",
        "—",
        "Testing and exercising the incident management plan",
        "Pruebas y ejercicios del plan de gestión de incidentes",
    ),
    RegulatoryRequirement(
        "GDPR-32-1-D",
        "GDPR",
        "Art. 32.1.d",
        "Regularly testing the effectiveness of security measures",
        "Pruebas periódicas de la eficacia de las medidas de seguridad",
    ),
    RegulatoryRequirement(
        "GDPR-33-34",
        "GDPR",
        "Arts. 33–34",
        "Personal data breach notification (72 h) and communication to data subjects",
        "Notificación de brechas de datos personales (72 h) y comunicación a los afectados",
    ),
    RegulatoryRequirement(
        "CER-13",
        "CER",
        "Art. 13",
        "Resilience measures, including staff training and exercises",
        "Medidas de resiliencia, incluidos la formación y los ejercicios del personal",
    ),
    RegulatoryRequirement(
        "CER-15",
        "CER",
        "Art. 15",
        "Incident notification (24 h)",
        "Notificación de incidentes (24 h)",
    ),
    RegulatoryRequirement(
        "UK-NIS-11",
        "UK_NIS",
        "Reg. 11",
        "Incident notification to the competent authority (72 h)",
        "Notificación de incidentes a la autoridad competente (72 h)",
    ),
    RegulatoryRequirement(
        "UK-NIS-CAF-D1",
        "UK_NIS",
        "NCSC CAF D1",
        "Response and recovery planning, tested and exercised",
        "Planificación de respuesta y recuperación, probada con ejercicios",
    ),
    RegulatoryRequirement(
        "UK-OPRES-SYSC-15A",
        "UK_OPRES",
        "SYSC 15A.5",
        "Scenario testing of important business services against impact tolerances",
        "Pruebas de escenario de los servicios de negocio importantes frente a sus "
        "tolerancias de impacto",
    ),
    RegulatoryRequirement(
        "SEC-8K-105",
        "SEC",
        "Form 8-K Item 1.05",
        "Disclosure of material cybersecurity incidents (4 business days)",
        "Divulgación de incidentes de ciberseguridad materiales (4 días hábiles)",
    ),
    RegulatoryRequirement(
        "SEC-SK-106",
        "SEC",
        "Reg. S-K Item 106",
        "Cybersecurity risk management and governance disclosure",
        "Divulgación de la gestión de riesgos y la gobernanza de ciberseguridad",
    ),
    RegulatoryRequirement(
        "NYDFS-500-16",
        "NYDFS_500",
        "§ 500.16",
        "Incident response and business continuity plans, tested at least annually",
        "Planes de respuesta a incidentes y de continuidad, probados al menos una vez al año",
    ),
    RegulatoryRequirement(
        "NYDFS-500-17",
        "NYDFS_500",
        "§ 500.17",
        "Notification of cybersecurity events (72 h) and ransom payments (24 h)",
        "Notificación de eventos de ciberseguridad (72 h) y de pagos de rescate (24 h)",
    ),
    RegulatoryRequirement(
        "HIPAA-308-A6",
        "HIPAA",
        "§ 164.308(a)(6)",
        "Security incident procedures",
        "Procedimientos ante incidentes de seguridad",
    ),
    RegulatoryRequirement(
        "HIPAA-308-A7",
        "HIPAA",
        "§ 164.308(a)(7)",
        "Contingency plan, including its testing and revision",
        "Plan de contingencia, incluidas su prueba y revisión",
    ),
    RegulatoryRequirement(
        "PCI-DSS-12-10-2",
        "PCI_DSS",
        "Req. 12.10.2",
        "Incident response plan reviewed and tested at least every 12 months",
        "Plan de respuesta a incidentes revisado y probado al menos cada 12 meses",
    ),
)

REGULATORY_REQUIREMENT_IDS: frozenset[str] = frozenset(r.id for r in REGULATORY_CATALOG)


@dataclass(frozen=True)
class NotificationMilestone:
    """One report a notification requirement demands: to whom, by when,
    and from what moment the clock runs. In a tabletop the clock is
    simulated: observers check that the team recognises each of these, not
    that it meets them."""

    recipient_en: str
    recipient_es: str
    stage_en: str
    stage_es: str
    deadline_en: str
    deadline_es: str
    clock_en: str
    clock_es: str


def _m(*fields: str) -> NotificationMilestone:
    return NotificationMilestone(*fields)


_AWARE_SIGNIFICANT = (
    "Awareness of the significant incident",
    "Conocimiento del incidente significativo",
)
_AWARE_BREACH = ("Awareness of the breach", "Conocimiento de la brecha")
_AWARE_INCIDENT = ("Awareness of the incident", "Conocimiento del incidente")

# The reports each notification requirement demands, in the order they
# fall due. Only the requirements listed here are notification
# requirements: an objective citing one gets the observers' notification
# reference and an observation point per requirement.
NOTIFICATION_MILESTONES: dict[str, tuple[NotificationMilestone, ...]] = {
    "NIS2-23": (
        _m(
            "CSIRT or competent authority",
            "CSIRT o autoridad competente",
            "Early warning",
            "Alerta temprana",
            "24 h",
            "24 h",
            *_AWARE_SIGNIFICANT,
        ),
        _m(
            "CSIRT or competent authority",
            "CSIRT o autoridad competente",
            "Incident notification",
            "Notificación del incidente",
            "72 h",
            "72 h",
            *_AWARE_SIGNIFICANT,
        ),
        _m(
            "CSIRT or competent authority",
            "CSIRT o autoridad competente",
            "Final report",
            "Informe final",
            "1 month",
            "1 mes",
            "The incident notification",
            "La notificación del incidente",
        ),
        _m(
            "Affected service recipients",
            "Destinatarios de los servicios afectados",
            "Information to recipients",
            "Información a los destinatarios",
            "Without undue delay",
            "Sin dilación indebida",
            *_AWARE_SIGNIFICANT,
        ),
    ),
    "DORA-19": (
        _m(
            "Financial competent authority",
            "Autoridad financiera competente",
            "Initial notification",
            "Notificación inicial",
            "4 h (24 h at most from awareness)",
            "4 h (24 h como máximo desde el conocimiento)",
            "Classification as major",
            "Clasificación como grave",
        ),
        _m(
            "Financial competent authority",
            "Autoridad financiera competente",
            "Intermediate report",
            "Informe intermedio",
            "72 h",
            "72 h",
            "The initial notification",
            "La notificación inicial",
        ),
        _m(
            "Financial competent authority",
            "Autoridad financiera competente",
            "Final report",
            "Informe final",
            "1 month",
            "1 mes",
            "The latest intermediate report",
            "El último informe intermedio",
        ),
    ),
    "GDPR-33-34": (
        _m(
            "Data protection authority",
            "Autoridad de protección de datos",
            "Breach notification",
            "Notificación de la brecha",
            "72 h",
            "72 h",
            *_AWARE_BREACH,
        ),
        _m(
            "Data subjects (if high risk)",
            "Interesados (si hay alto riesgo)",
            "Communication to data subjects",
            "Comunicación a los interesados",
            "Without undue delay",
            "Sin dilación indebida",
            *_AWARE_BREACH,
        ),
    ),
    "CER-15": (
        _m(
            "Competent authority",
            "Autoridad competente",
            "Initial notification",
            "Notificación inicial",
            "24 h",
            "24 h",
            *_AWARE_INCIDENT,
        ),
        _m(
            "Competent authority",
            "Autoridad competente",
            "Detailed report",
            "Informe detallado",
            "1 month",
            "1 mes",
            "The initial notification",
            "La notificación inicial",
        ),
    ),
    "UK-NIS-11": (
        _m(
            "Designated competent authority",
            "Autoridad competente designada",
            "Incident notification",
            "Notificación del incidente",
            "72 h",
            "72 h",
            *_AWARE_INCIDENT,
        ),
    ),
    "SEC-8K-105": (
        _m(
            "SEC (Form 8-K)",
            "SEC (Form 8-K)",
            "Material incident disclosure",
            "Divulgación del incidente material",
            "4 business days",
            "4 días hábiles",
            "Determination that it is material",
            "Determinación de su materialidad",
        ),
    ),
    "NYDFS-500-17": (
        _m(
            "NYDFS Superintendent",
            "Superintendente del NYDFS",
            "Cybersecurity incident notice",
            "Aviso del incidente de ciberseguridad",
            "72 h",
            "72 h",
            "Determination that an incident occurred",
            "Determinación de que hubo incidente",
        ),
        _m(
            "NYDFS Superintendent",
            "Superintendente del NYDFS",
            "Ransom payment notice",
            "Aviso del pago de rescate",
            "24 h",
            "24 h",
            "The payment",
            "El pago",
        ),
        _m(
            "NYDFS Superintendent",
            "Superintendente del NYDFS",
            "Payment justification",
            "Justificación del pago",
            "30 days",
            "30 días",
            "The payment",
            "El pago",
        ),
    ),
}


class Jurisdiction(StrEnum):
    EU = "EU"
    ES = "ES"
    UK = "UK"
    US = "US"
    GLOBAL = "GLOBAL"


@dataclass(frozen=True)
class RegulatoryFramework:
    """An external obligation a REGULATORY trigger can name (section 2):
    binding law, except where `binding` is False (PCI DSS, a contractual
    industry standard). `requires_exercises` marks the frameworks that
    explicitly demand exercises or tests, so a tabletop directly evidences
    compliance; the others set response obligations (deadlines, decisions
    under pressure) a tabletop trains. `rationale_*` says why a tabletop is
    worth running for it, with `rationale_reference` as its source."""

    id: str
    label_en: str
    label_es: str
    jurisdiction: Jurisdiction
    name_en: str
    name_es: str
    scope_en: str
    scope_es: str
    requires_exercises: bool
    binding: bool
    rationale_en: str
    rationale_es: str
    rationale_reference: str


FRAMEWORK_OTHER = "OTHER"

# Ordered for display: grouped by jurisdiction, cross-sector before sector.
FRAMEWORK_CATALOG: tuple[RegulatoryFramework, ...] = (
    RegulatoryFramework(
        "NIS2",
        "NIS2",
        "NIS2",
        Jurisdiction.EU,
        "Directive (EU) 2022/2555",
        "Directiva (UE) 2022/2555",
        "Essential and important entities",
        "Entidades esenciales e importantes",
        requires_exercises=False,
        binding=True,
        rationale_en="Crisis management and the 24 h / 72 h / final-report notification clock.",
        rationale_es=("Gestión de crisis y el reloj de notificación: 24 h, 72 h e informe final."),
        rationale_reference="Arts. 21.2.c, 23",
    ),
    RegulatoryFramework(
        "GDPR",
        "GDPR / UK GDPR",
        "RGPD / UK GDPR",
        Jurisdiction.EU,
        "Regulation (EU) 2016/679 and the UK GDPR",
        "Reglamento (UE) 2016/679 y el UK GDPR",
        "Anyone processing personal data",
        "Quien trate datos personales",
        requires_exercises=False,
        binding=True,
        rationale_en=(
            "Deciding within 72 h whether to notify a breach to the supervisory authority "
            "(the ICO in the UK) and to data subjects; regularly testing security measures."
        ),
        rationale_es=(
            "Decidir en 72 h si se notifica una brecha a la autoridad de control (el ICO en "
            "Reino Unido) y a los afectados; probar periódicamente las medidas de seguridad."
        ),
        rationale_reference="Arts. 32.1.d, 33–34",
    ),
    RegulatoryFramework(
        "CER",
        "CER",
        "CER",
        Jurisdiction.EU,
        "Directive (EU) 2022/2557 on the resilience of critical entities",
        "Directiva (UE) 2022/2557 de resiliencia de las entidades críticas",
        "Designated critical entities",
        "Entidades críticas designadas",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Resilience measures include training staff through exercises; incidents are "
            "notified within 24 h."
        ),
        rationale_es=(
            "Las medidas de resiliencia incluyen formar al personal con ejercicios; los "
            "incidentes se notifican en 24 h."
        ),
        rationale_reference="Arts. 13.1, 15",
    ),
    RegulatoryFramework(
        "DORA",
        "DORA",
        "DORA",
        Jurisdiction.EU,
        "Regulation (EU) 2022/2554",
        "Reglamento (UE) 2022/2554",
        "Financial entities",
        "Entidades financieras",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Test the ICT business continuity plans at least yearly, crisis communication "
            "included, within a resilience testing programme."
        ),
        rationale_es=(
            "Probar los planes de continuidad TIC al menos una vez al año, incluida la "
            "comunicación de crisis, dentro de un programa de pruebas de resiliencia."
        ),
        rationale_reference="Arts. 11.6, 14, 24–26",
    ),
    RegulatoryFramework(
        "NCCS",
        "NCCS",
        "NCCS",
        Jurisdiction.EU,
        "Regulation (EU) 2024/1366, Network Code on Cybersecurity",
        "Reglamento (UE) 2024/1366, Network Code on Cybersecurity",
        "Electricity sector",
        "Sector eléctrico",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Cybersecurity crisis management and cybersecurity exercises for cross-border "
            "electricity flows."
        ),
        rationale_es=(
            "Gestión de crisis de ciberseguridad y ejercicios de ciberseguridad para los "
            "flujos eléctricos transfronterizos."
        ),
        rationale_reference="Reg. (EU) 2024/1366",
    ),
    RegulatoryFramework(
        "ENS",
        "ENS",
        "ENS",
        Jurisdiction.ES,
        "Royal Decree 311/2022, Esquema Nacional de Seguridad",
        "Real Decreto 311/2022, Esquema Nacional de Seguridad",
        "Spanish public sector and its suppliers",
        "Sector público español y sus proveedores",
        requires_exercises=True,
        binding=True,
        rationale_en="Periodic continuity testing and incident management.",
        rationale_es="Pruebas periódicas de continuidad y gestión de incidentes.",
        rationale_reference="op.cont.3, op.exp.7",
    ),
    RegulatoryFramework(
        "UK_NIS",
        "UK NIS",
        "UK NIS",
        Jurisdiction.UK,
        "Network and Information Systems Regulations 2018",
        "Network and Information Systems Regulations 2018",
        "Operators of essential services and relevant digital service providers",
        "Operadores de servicios esenciales y proveedores de servicios digitales relevantes",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Notify the competent authority within 72 h; the NCSC Cyber Assessment Framework "
            "expects response plans to be tested and exercised."
        ),
        rationale_es=(
            "Notificar a la autoridad competente en 72 h; el Cyber Assessment Framework del "
            "NCSC espera que los planes de respuesta se prueben con ejercicios."
        ),
        rationale_reference="Reg. 11; NCSC CAF D1",
    ),
    RegulatoryFramework(
        "UK_OPRES",
        "FCA/PRA OpRes",
        "FCA/PRA OpRes",
        Jurisdiction.UK,
        "FCA and PRA operational resilience rules",
        "Normas de resiliencia operativa de la FCA y la PRA",
        "Banks, insurers, major investment firms and payment institutions",
        "Bancos, aseguradoras, grandes empresas de inversión y entidades de pago",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Scenario-test that important business services stay within their impact "
            "tolerances under severe but plausible disruption."
        ),
        rationale_es=(
            "Probar con escenarios que los servicios de negocio importantes se mantienen "
            "dentro de sus tolerancias de impacto ante disrupciones graves pero plausibles."
        ),
        rationale_reference="FCA SYSC 15A.5",
    ),
    RegulatoryFramework(
        "SEC",
        "SEC",
        "SEC",
        Jurisdiction.US,
        "SEC cybersecurity disclosure rules (2023)",
        "Normas de la SEC sobre divulgación de ciberseguridad (2023)",
        "Companies listed in the US",
        "Empresas cotizadas en EE. UU.",
        requires_exercises=False,
        binding=True,
        rationale_en=(
            "Decide whether an incident is material and disclose it within 4 business days: "
            "a classic exercise for the executive team."
        ),
        rationale_es=(
            "Decidir si un incidente es material y comunicarlo en 4 días hábiles: un "
            "ejercicio clásico para la dirección."
        ),
        rationale_reference="Form 8-K Item 1.05; Reg. S-K Item 106",
    ),
    RegulatoryFramework(
        "NYDFS_500",
        "NYDFS 500",
        "NYDFS 500",
        Jurisdiction.US,
        "23 NYCRR Part 500, NYDFS Cybersecurity Regulation",
        "23 NYCRR Part 500, reglamento de ciberseguridad del NYDFS",
        "Banks, insurers and financial services licensed in New York",
        "Banca, seguros y servicios financieros con licencia en Nueva York",
        requires_exercises=True,
        binding=True,
        rationale_en=(
            "Test the incident response and continuity plans at least yearly with senior "
            "officers; notify within 72 h, and any ransom payment within 24 h."
        ),
        rationale_es=(
            "Probar los planes de respuesta y continuidad al menos una vez al año con la alta "
            "dirección; notificar en 72 h, y el pago de un rescate en 24 h."
        ),
        rationale_reference="§§ 500.16, 500.17",
    ),
    RegulatoryFramework(
        "HIPAA",
        "HIPAA",
        "HIPAA",
        Jurisdiction.US,
        "HIPAA Security Rule, 45 CFR Part 164",
        "HIPAA Security Rule, 45 CFR Part 164",
        "Healthcare providers, health plans and their business associates",
        "Proveedores sanitarios, aseguradoras de salud y sus socios comerciales",
        requires_exercises=True,
        binding=True,
        rationale_en="Security incident procedures and periodic testing of the contingency plan.",
        rationale_es=(
            "Procedimientos ante incidentes de seguridad y prueba periódica del plan de "
            "contingencia."
        ),
        rationale_reference="§ 164.308(a)(6), (a)(7)(ii)(D)",
    ),
    RegulatoryFramework(
        "PCI_DSS",
        "PCI DSS",
        "PCI DSS",
        Jurisdiction.GLOBAL,
        "Payment Card Industry Data Security Standard v4.0.1",
        "Payment Card Industry Data Security Standard v4.0.1",
        "Anyone that stores, processes or transmits cardholder data",
        "Quien almacene, procese o transmita datos de tarjetas",
        requires_exercises=True,
        binding=False,
        rationale_en="Test the incident response plan at least once every 12 months.",
        rationale_es="Probar el plan de respuesta a incidentes al menos una vez cada 12 meses.",
        rationale_reference="Req. 12.10.2",
    ),
)

# Every value a form's `regulatory_frameworks` may hold, OTHER last (it
# comes with free text, `regulatory_framework_other`).
REGULATORY_FRAMEWORKS: tuple[str, ...] = (
    *(framework.id for framework in FRAMEWORK_CATALOG),
    FRAMEWORK_OTHER,
)
