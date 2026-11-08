"""TTX-Zone's SMART objective templates (needs analysis, section 5,
"Add from the library"). A platform-wide, read-only, code-level catalog in
both supported locales, like the regulatory catalog: an objective picked
from it is a *copy* into the form (the template's id isn't stored), then
edited like any other.

Each template is written for one capability and already follows the form's
rules, so it adds no warning by itself: a short title, a SMART statement,
a success criterion with one observable condition per line and free of the
vague words the validation flags, the evidence to collect, and the
regulatory requirements it can evidence (ids from `regulatory_catalog`,
checked by `tests/test_objective_catalog.py`). The statement's wording uses
placeholders sparingly: times are minutes of scenario time, to be adjusted
to the exercise."""

from dataclasses import dataclass
from functools import lru_cache

from app.models.ttx_needs_form import Capability


@dataclass(frozen=True)
class ObjectiveTemplate:
    id: str
    capability: Capability
    title_en: str
    title_es: str
    statement_en: str
    statement_es: str
    # One observable condition per entry (each becomes an EEG point).
    criterion_en: tuple[str, ...]
    criterion_es: tuple[str, ...]
    evidence_en: tuple[str, ...]
    evidence_es: tuple[str, ...]
    regulatory_requirement_ids: tuple[str, ...] = ()
    time_box_minutes: int | None = None


C = Capability

OBJECTIVE_CATALOG: tuple[ObjectiveTemplate, ...] = (
    # -- detection, triage and escalation ---------------------------------
    ObjectiveTemplate(
        "detect-escalate-first-hour",
        C.DETECTION_TRIAGE_ESCALATION,
        "Escalate the first alert within the hour",
        "Escalar la primera alerta en menos de una hora",
        "Within 60 minutes of the first alert, the security team triages it, opens an incident "
        "record and escalates it to the incident manager following the escalation procedure.",
        "En los 60 minutos siguientes a la primera alerta, el equipo de seguridad la clasifica, "
        "abre un registro de incidente y la escala al responsable del incidente según el "
        "procedimiento de escalado.",
        (
            "The alert is acknowledged and assigned to a named analyst",
            "An incident record is opened with time, source and affected assets",
            "The incident manager is notified through the channel the procedure names",
        ),
        (
            "La alerta se reconoce y se asigna a un analista con nombre",
            "Se abre un registro de incidente con hora, origen y activos afectados",
            "Se avisa al responsable del incidente por el canal que indica el procedimiento",
        ),
        ("Incident record with its timestamps", "Escalation message or call log"),
        (
            "Registro del incidente con sus marcas de tiempo",
            "Mensaje o registro de la llamada de escalado",
        ),
        ("NIS2-21-2-F", "ISO27035-2"),
        60,
    ),
    ObjectiveTemplate(
        "detect-scope-compromise",
        C.DETECTION_TRIAGE_ESCALATION,
        "Scope the compromise before containing it",
        "Acotar el compromiso antes de contener",
        "Before the first containment action, the technical team states which systems, accounts "
        "and data are known or suspected to be affected, and what is still unknown.",
        "Antes de la primera acción de contención, el equipo técnico enumera qué sistemas, "
        "cuentas y datos se sabe o se sospecha que están afectados, y qué se desconoce aún.",
        (
            "A list of affected systems and accounts is written down",
            "Known facts and open questions are stated separately",
            "The scope is shared with the incident manager before containment starts",
        ),
        (
            "Se anota la lista de sistemas y cuentas afectados",
            "Se separan los hechos conocidos de las preguntas abiertas",
            "El alcance se comparte con el responsable del incidente antes de contener",
        ),
        ("Scoping notes or whiteboard capture", "Decision log entry for containment"),
        (
            "Notas de alcance o captura de la pizarra",
            "Entrada del registro de decisiones sobre la contención",
        ),
        ("ISO27035-2",),
    ),
    # -- incident classification -----------------------------------------
    ObjectiveTemplate(
        "classify-severity",
        C.INCIDENT_CLASSIFICATION,
        "Classify the incident against the severity scale",
        "Clasificar el incidente con la escala de gravedad",
        "Within 30 minutes of escalation, the incident manager assigns a severity level using the "
        "organization's scale and records the criteria that justified it.",
        "En los 30 minutos siguientes al escalado, el responsable del incidente asigna un nivel "
        "de gravedad con la escala de la organización y anota los criterios que lo justifican.",
        (
            "A severity level from the organization's scale is assigned",
            "The criteria used (impact, scope, data) are recorded",
            "The level is reviewed when a new inject changes the impact",
        ),
        (
            "Se asigna un nivel de la escala de gravedad de la organización",
            "Se anotan los criterios usados (impacto, alcance, datos)",
            "El nivel se revisa cuando un nuevo inject cambia el impacto",
        ),
        ("Severity recorded in the incident record", "Decision log"),
        ("Gravedad anotada en el registro del incidente", "Registro de decisiones"),
        ("ISO27035-2",),
        30,
    ),
    ObjectiveTemplate(
        "classify-reportable",
        C.INCIDENT_CLASSIFICATION,
        "Decide whether the incident is reportable",
        "Decidir si el incidente es notificable",
        "Once the impact is known, the team decides whether the incident meets the thresholds of "
        "each applicable regulation and records who took the decision and why.",
        "Una vez conocido el impacto, el equipo decide si el incidente supera los umbrales de "
        "cada normativa aplicable y anota quién tomó la decisión y por qué.",
        (
            "Each applicable regulation is checked against its thresholds",
            "The decision (reportable or not) is recorded with its reasons",
            "The person accountable for the decision is named",
        ),
        (
            "Se comprueba cada normativa aplicable frente a sus umbrales",
            "Se anota la decisión (notificable o no) con sus motivos",
            "Se nombra a la persona responsable de la decisión",
        ),
        ("Threshold checklist", "Decision log entry"),
        ("Lista de comprobación de umbrales", "Entrada del registro de decisiones"),
        ("NIS2-23", "GDPR-33-34", "DORA-19"),
    ),
    # -- crisis decision-making --------------------------------------------
    ObjectiveTemplate(
        "crisis-convene",
        C.CRISIS_DECISION_MAKING,
        "Convene the crisis committee",
        "Convocar el comité de crisis",
        "Within 45 minutes of the severity reaching the crisis threshold, the crisis committee "
        "meets with its chair or deputy and agrees its first priorities.",
        "En los 45 minutos siguientes a que la gravedad alcance el umbral de crisis, el comité de "
        "crisis se reúne con su presidente o suplente y acuerda sus primeras prioridades.",
        (
            "The committee is convened by the person the crisis plan names",
            "The chair or a named deputy leads the meeting",
            "At least three priorities are agreed and written down",
        ),
        (
            "Convoca el comité la persona que indica el plan de crisis",
            "Dirige la reunión el presidente o un suplente designado",
            "Se acuerdan y anotan al menos tres prioridades",
        ),
        ("Convocation message", "Minutes with the agreed priorities"),
        ("Mensaje de convocatoria", "Acta con las prioridades acordadas"),
        ("NIS2-21-2-C", "ISO22301-8-5"),
        45,
    ),
    ObjectiveTemplate(
        "crisis-ransom-decision",
        C.CRISIS_DECISION_MAKING,
        "Take a reasoned position on the ransom demand",
        "Adoptar una postura razonada ante el rescate",
        "Faced with an extortion demand, the crisis committee takes a position, states the "
        "options it weighed and the legal, insurance and law-enforcement input it relied on.",
        "Ante una demanda de extorsión, el comité de crisis adopta una postura, enumera las "
        "opciones valoradas y las aportaciones legales, del seguro y de las fuerzas de seguridad "
        "en las que se apoyó.",
        (
            "At least two options are compared with their consequences",
            "Legal counsel's view is requested before deciding",
            "The insurer and law enforcement are considered as contacts",
            "The decision and its owner are recorded",
        ),
        (
            "Se comparan al menos dos opciones con sus consecuencias",
            "Se pide la opinión del asesor jurídico antes de decidir",
            "Se valora contactar con la aseguradora y con las fuerzas de seguridad",
            "Se anota la decisión y su responsable",
        ),
        ("Decision log entry", "Options summary"),
        ("Entrada del registro de decisiones", "Resumen de opciones"),
        ("NIS2-21-2-C",),
    ),
    # -- regulatory notification ---------------------------------------------
    ObjectiveTemplate(
        "notify-early-warning",
        C.REGULATORY_NOTIFICATION,
        "Prepare the early warning in time",
        "Preparar la alerta temprana a tiempo",
        "Within the 24-hour early-warning window, the team drafts the notification to the "
        "competent authority with the content the regulation requires, approved by the "
        "accountable person.",
        "Dentro del plazo de alerta temprana de 24 horas, el equipo redacta la notificación a la "
        "autoridad competente con el contenido que exige la normativa, aprobada por la persona "
        "responsable.",
        (
            "The recipient authority is identified",
            "The draft states whether malicious action or cross-border impact is suspected",
            "The draft is approved by the person accountable for notifications",
            "The scenario clock shows it ready before the deadline",
        ),
        (
            "Se identifica la autoridad destinataria",
            "El borrador indica si se sospecha acción maliciosa o impacto transfronterizo",
            "Aprueba el borrador la persona responsable de las notificaciones",
            "El reloj del escenario la muestra lista antes del plazo",
        ),
        ("Draft notification", "Approval record"),
        ("Borrador de la notificación", "Registro de la aprobación"),
        ("NIS2-23",),
    ),
    ObjectiveTemplate(
        "notify-personal-data",
        C.REGULATORY_NOTIFICATION,
        "Assess a personal data breach",
        "Evaluar una brecha de datos personales",
        "Once personal data is known to be affected, the data protection officer leads an "
        "assessment of the risk to individuals and decides on notifying the supervisory "
        "authority within 72 hours and the data subjects.",
        "Una vez se sabe que hay datos personales afectados, el delegado de protección de datos "
        "dirige la evaluación del riesgo para las personas y decide la notificación a la "
        "autoridad de control en 72 horas y a los interesados.",
        (
            "The data protection officer is involved",
            "Categories and approximate number of affected people are stated",
            "The risk to individuals is assessed and recorded",
            "A decision on notifying the authority and data subjects is recorded",
        ),
        (
            "Se implica al delegado de protección de datos",
            "Se indican las categorías y el número aproximado de personas afectadas",
            "Se evalúa y anota el riesgo para las personas",
            "Se anota la decisión sobre notificar a la autoridad y a los interesados",
        ),
        ("Breach assessment", "Breach register entry"),
        ("Evaluación de la brecha", "Entrada del registro de brechas"),
        ("GDPR-33-34",),
    ),
    # -- internal and external communication ----------------------------------
    ObjectiveTemplate(
        "comms-holding-statement",
        C.INTERNAL_EXTERNAL_COMMS,
        "Issue a holding statement",
        "Emitir un comunicado de espera",
        "Within 90 minutes of media or customer attention, communications publishes an approved "
        "holding statement that is consistent with the facts the incident team confirmed.",
        "En los 90 minutos siguientes a la atención de medios o clientes, comunicación publica "
        "un comunicado de espera aprobado y coherente con los hechos que confirmó el equipo del "
        "incidente.",
        (
            "A holding statement is drafted from a prepared template or from scratch",
            "Legal and the incident manager approve it before release",
            "It contains no fact the incident team hasn't confirmed",
        ),
        (
            "Se redacta un comunicado de espera a partir de una plantilla o desde cero",
            "Lo aprueban el área legal y el responsable del incidente antes de publicarlo",
            "No contiene ningún hecho que el equipo del incidente no haya confirmado",
        ),
        ("Approved statement", "Approval trail"),
        ("Comunicado aprobado", "Rastro de aprobaciones"),
        ("DORA-11",),
        90,
    ),
    ObjectiveTemplate(
        "comms-staff",
        C.INTERNAL_EXTERNAL_COMMS,
        "Tell staff what to do",
        "Decir a la plantilla qué hacer",
        "Before the start of the next working shift, staff receive an internal message through a "
        "channel that still works, saying what happened and what they must and mustn't do.",
        "Antes del siguiente turno, la plantilla recibe un mensaje interno por un canal que siga "
        "funcionando, con lo ocurrido y lo que debe y no debe hacer.",
        (
            "A channel that doesn't depend on the affected systems is chosen",
            "The message gives at least one instruction and one prohibition",
            "It names whom to contact with questions",
        ),
        (
            "Se elige un canal que no dependa de los sistemas afectados",
            "El mensaje da al menos una instrucción y una prohibición",
            "Indica a quién dirigirse con dudas",
        ),
        ("Internal message", "Channel used"),
        ("Mensaje interno", "Canal utilizado"),
    ),
    # -- cross-unit coordination -------------------------------------------------
    ObjectiveTemplate(
        "coord-roles",
        C.CROSS_UNIT_COORDINATION,
        "Assign incident roles across units",
        "Asignar los roles del incidente entre áreas",
        "Within the first hour of the response, each unit taking part names who acts for it and "
        "the incident manager shares one list of roles and contacts with every unit.",
        "En la primera hora de respuesta, cada área participante designa quién actúa por ella y "
        "el responsable del incidente comparte una lista única de roles y contactos con todas.",
        (
            "Each participating unit names a representative",
            "One list of roles and contacts is shared",
            "Nobody holds two roles that conflict",
        ),
        (
            "Cada área participante designa a un representante",
            "Se comparte una única lista de roles y contactos",
            "Nadie ocupa dos roles en conflicto",
        ),
        ("Roles and contacts list",),
        ("Lista de roles y contactos",),
        ("ISO27035-2",),
        60,
    ),
    ObjectiveTemplate(
        "coord-sitrep",
        C.CROSS_UNIT_COORDINATION,
        "Keep a regular situation report",
        "Mantener un informe de situación periódico",
        "During the session, the incident manager issues a situation report at an agreed "
        "interval, with status, actions under way, decisions needed and the next update time.",
        "Durante la sesión, el responsable del incidente emite un informe de situación con una "
        "periodicidad acordada, con estado, acciones en curso, decisiones pendientes y hora de "
        "la próxima actualización.",
        (
            "An update interval is agreed",
            "Each report states status, actions, decisions needed and next update",
            "No interval is missed by more than 15 minutes of scenario time",
        ),
        (
            "Se acuerda una periodicidad de actualización",
            "Cada informe indica estado, acciones, decisiones pendientes y próxima actualización",
            "Ningún informe se retrasa más de 15 minutos de tiempo de escenario",
        ),
        ("Situation reports",),
        ("Informes de situación",),
    ),
    # -- third parties and supply chain ---------------------------------------------
    ObjectiveTemplate(
        "supplier-contact",
        C.THIRD_PARTY_SUPPLY_CHAIN,
        "Engage the affected supplier",
        "Implicar al proveedor afectado",
        "Once a supplier is suspected as the entry point or is affected itself, the team reaches "
        "its security contact through the agreed channel and requests the information the "
        "contract entitles it to.",
        "Cuando se sospecha que un proveedor es la vía de entrada o está afectado, el equipo "
        "contacta con su responsable de seguridad por el canal acordado y le pide la información "
        "a la que da derecho el contrato.",
        (
            "The supplier's security contact is found in the contract or register",
            "The request lists the information needed and a response time",
            "The supplier's access is reviewed while waiting",
        ),
        (
            "Se localiza el contacto de seguridad del proveedor en el contrato o el registro",
            "La petición enumera la información necesaria y un plazo de respuesta",
            "Se revisa el acceso del proveedor mientras se espera",
        ),
        ("Supplier request", "Access review notes"),
        ("Petición al proveedor", "Notas de la revisión de accesos"),
        ("DORA-11",),
    ),
    ObjectiveTemplate(
        "supplier-isolate",
        C.THIRD_PARTY_SUPPLY_CHAIN,
        "Decide on cutting a supplier's connection",
        "Decidir si cortar la conexión de un proveedor",
        "Faced with a compromised supplier, the team decides whether to suspend its connections "
        "and accounts, weighing the operational impact, and records the decision and its owner.",
        "Ante un proveedor comprometido, el equipo decide si suspender sus conexiones y cuentas, "
        "valorando el impacto operativo, y anota la decisión y su responsable.",
        (
            "The supplier's connections and accounts are listed",
            "The operational impact of cutting them is stated",
            "The decision and its owner are recorded",
        ),
        (
            "Se enumeran las conexiones y cuentas del proveedor",
            "Se indica el impacto operativo de cortarlas",
            "Se anota la decisión y su responsable",
        ),
        ("Decision log entry",),
        ("Entrada del registro de decisiones",),
    ),
    # -- continuity and recovery ---------------------------------------------------
    ObjectiveTemplate(
        "continuity-activate",
        C.CONTINUITY_RECOVERY,
        "Activate the continuity plan for a critical process",
        "Activar el plan de continuidad de un proceso crítico",
        "When a critical process stops, its owner activates the continuity plan's workaround "
        "within the maximum tolerable downtime and confirms the process runs in degraded mode.",
        "Cuando un proceso crítico se detiene, su responsable activa la alternativa del plan de "
        "continuidad dentro del tiempo máximo de interrupción tolerable y confirma que el "
        "proceso funciona en modo degradado.",
        (
            "The affected critical process and its owner are identified",
            "The plan's workaround is activated by its owner",
            "Degraded operation is confirmed before the tolerable downtime ends",
        ),
        (
            "Se identifican el proceso crítico afectado y su responsable",
            "Su responsable activa la alternativa del plan",
            "Se confirma el funcionamiento degradado antes de agotar el tiempo tolerable",
        ),
        ("Plan activation record", "Confirmation of degraded operation"),
        ("Registro de activación del plan", "Confirmación del modo degradado"),
        ("ISO22301-8-5", "NIS2-21-2-C", "DORA-11"),
    ),
    ObjectiveTemplate(
        "recovery-restore-order",
        C.CONTINUITY_RECOVERY,
        "Agree the restore order",
        "Acordar el orden de restauración",
        "Before restoring, the technical and business owners agree the order in which systems "
        "come back, confirm the backups are clean and set the criteria to declare each one "
        "restored.",
        "Antes de restaurar, los responsables técnicos y de negocio acuerdan el orden en que "
        "vuelven los sistemas, confirman que las copias están limpias y fijan los criterios para "
        "dar cada uno por restaurado.",
        (
            "A restore order based on business priority is written down",
            "The integrity of the backups is checked before use",
            "Each system has a criterion to declare it restored",
        ),
        (
            "Se anota un orden de restauración basado en la prioridad de negocio",
            "Se comprueba la integridad de las copias antes de usarlas",
            "Cada sistema tiene un criterio para darlo por restaurado",
        ),
        ("Restore plan", "Backup integrity check"),
        ("Plan de restauración", "Comprobación de integridad de las copias"),
        ("ISO22301-8-5",),
    ),
    # -- legal and forensics --------------------------------------------------------
    ObjectiveTemplate(
        "forensics-preserve",
        C.LEGAL_FORENSICS,
        "Preserve evidence before acting",
        "Preservar las evidencias antes de actuar",
        "Before wiping or rebuilding an affected system, the team preserves the evidence a "
        "later investigation needs and keeps a chain of custody.",
        "Antes de borrar o reconstruir un sistema afectado, el equipo preserva las evidencias "
        "que necesitará una investigación posterior y mantiene la cadena de custodia.",
        (
            "Memory, disk or log captures are requested before rebuilding",
            "A chain-of-custody record is started",
            "Legal counsel is told before evidence is shared outside",
        ),
        (
            "Se piden capturas de memoria, disco o registros antes de reconstruir",
            "Se abre un registro de cadena de custodia",
            "Se avisa al asesor jurídico antes de compartir evidencias fuera",
        ),
        ("Chain-of-custody record", "Capture list"),
        ("Registro de cadena de custodia", "Lista de capturas"),
        ("ISO27035-2",),
    ),
    ObjectiveTemplate(
        "legal-law-enforcement",
        C.LEGAL_FORENSICS,
        "Decide on reporting to law enforcement",
        "Decidir la denuncia a las fuerzas de seguridad",
        "Once a crime is suspected, legal counsel and the crisis committee decide whether and "
        "when to report it to law enforcement, and who is the single point of contact.",
        "Cuando se sospecha un delito, el asesor jurídico y el comité de crisis deciden si "
        "denunciarlo a las fuerzas de seguridad, cuándo, y quién es el interlocutor único.",
        (
            "Legal counsel gives a view on reporting",
            "The decision and its timing are recorded",
            "A single point of contact with law enforcement is named",
        ),
        (
            "El asesor jurídico da su opinión sobre la denuncia",
            "Se anotan la decisión y el momento",
            "Se designa un interlocutor único con las fuerzas de seguridad",
        ),
        ("Decision log entry",),
        ("Entrada del registro de decisiones",),
    ),
)


@lru_cache(maxsize=1)
def objective_catalog_by_id() -> dict[str, ObjectiveTemplate]:
    return {template.id: template for template in OBJECTIVE_CATALOG}
