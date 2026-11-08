"""Copy for the session documents exported from Creator -> Session plan,
in both supported locales -- merged over the MSEL PDF copy
(msel_pdf_labels), which the shared stories still use. Mirrors the
frontend's `creator.conductPrep.*` labels for the same values."""

from app.data.feedback_form import INTRO, OBJECTIVE_STATEMENT, OPEN_QUESTIONS, STATEMENTS

_OPEN = dict(OPEN_QUESTIONS)

LABELS: dict[str, dict] = {
    "en": {
        "titles": {
            "facilitator-guide": "Facilitator and Controller guide",
            "sitman": "Situation Manual (SitMan)",
            "inject-cards": "Inject cards",
            "eeg": "Exercise Evaluation Guide (EEG)",
            "evaluation-plan": "Evaluation plan",
            "feedback-form": "Participant feedback form",
        },
        "plan_not_ready": (
            "Not final: the evaluation plan is version {version} in draft. "
            "Use the version marked ready for the session."
        ),
        "plan_version": "Plan",
        "cp_sections": {
            "session": "Session",
            "team": "Exercise team",
            "evaluation": "Evaluation",
            "evaluators": "Evaluators",
            "data": "Data collection",
            "briefing": "Evaluator briefing",
            "calendar": "Evaluation calendar",
            "non_intervention": "Rules for evaluators",
            "ratings": "Rating scale",
            "participant": "About you",
            "conduct": "The exercise",
            "strengths": _OPEN["strengths"]["en"],
            "improvements": _OPEN["improvements"]["en"],
            "plans": _OPEN["plans"]["en"],
            "comments": _OPEN["comments"]["en"],
        },
        "cp_fields": {
            "date": "Date",
            "start": "Start",
            "timezone": "Time zone",
            "modality": "Modality",
            "venue": "Venue",
            "room": "Room",
            "link": "Meeting link",
            "facilitators": "Facilitators",
            "lead_evaluator": "Lead Evaluator",
            "log_keeper": "Execution log",
            "methods": "Methods",
            "briefing_date": "Date",
            "briefing_covers": "Covers",
            "evaluators": "Evaluators",
            "name": "Name (optional)",
            "area": "Area or role",
        },
        "cp_table": {
            "evaluator": "Evaluator",
            "objectives": "Objectives",
            "areas": "Areas",
            "level": "Level",
            "criterion": "What it looks like",
            "statement": "Statement",
            "score": "1  2  3  4  5",
        },
        "modalities": {"in_person": "In person", "remote": "Remote", "hybrid": "Hybrid"},
        "methods": {
            "direct_observation": "Direct observation",
            "decision_timeline": "Decision timeline",
            "communications_log": "Communications log",
            "observation_notes": "Observation notes",
            "document_review": "Document review",
            "feedback_forms": "Participant feedback forms",
            "interviews": "Interviews",
            "hot_wash": "Hot wash",
            "other": "Other",
        },
        "briefing_items": {
            "objectives": "Objectives and scope",
            "eeg": "The EEGs and the rating scale",
            "msel": "The MSEL and the timeline",
            "non_intervention": "Non-intervention rules",
            "data_collection": "How to collect data",
            "logistics": "Logistics and roles on the day",
        },
        "calendar": {
            "hot_wash_days": "Hot wash",
            "debrief_days": "Controller and evaluator debrief",
            "ratings_due_days": "Rated EEGs due",
            "draft_aar_days": "Draft report and improvement plan",
            "after_action_meeting_days": "After Action Meeting",
            "same_day": "On the session day",
            "days_after": "{days} days after",
            "on_date": "{deadline} ({date})",
        },
        "sitman_rules": (
            "What is said in the session is not attributed to anyone in the report.",
            "Phones on silent; real-world calls are taken outside the room.",
        ),
        "non_intervention": (
            "Observe and record; don't play, facilitate or answer the Players' questions.",
            "Record what is said and decided, with the time, not your opinion of it.",
            "Hand in your rated EEGs and notes by the date in the calendar.",
        ),
        "eeg_intro": (
            "For each objective, tick the observation points you see happen and rate the "
            "performance on the scale below; a point may adjust a level."
        ),
        # The common rating scale: what every level means unless a point
        # adjusts it (frontend: creator.conductPrep.eeg.levelDefinitions).
        "level_definitions": (
            "Done as expected and on time, following plans and procedures, without "
            "harming other activities.",
            "Done and achieved, with room to be more effective or efficient.",
            "Only partly done, late, with help or harming other activities.",
            "Not done, or done in a way that doesn't achieve what was expected.",
        ),
        "feedback_intro": INTRO["en"],
        "feedback_items": tuple(entry["en"] for _, entry in STATEMENTS),
        "objective_item": OBJECTIVE_STATEMENT["en"],
        "evaluated_by": "Evaluated by: {names}",
        "unassigned": "No evaluator assigned",
        "notifications": {
            "title": "Expected notifications",
            "intro": (
                "What the team should recognise when the incident triggers a notification "
                "duty. The clock is simulated: note whether they identify each regime, its "
                "deadline, when the clock starts and who notifies by role -- not whether they "
                "meet it."
            ),
            "legend": (
                "I: identified; D: deadline right; C: clock start right; O: owner named by role."
            ),
            "marks": "I [ ]  D [ ]  C [ ]  O [ ]",
            "cited_by": "Objectives: {codes}",
            "columns": {
                "regime": "Regime",
                "report": "Report and recipient",
                "deadline": "Deadline",
                "clock": "Clock starts",
                "observed": "Observed",
            },
            "notes": "Simulated time and notes",
        },
    },
    "es": {
        "titles": {
            "facilitator-guide": "Guía del Facilitador y del Controlador",
            "sitman": "Manual de situación (SitMan)",
            "inject-cards": "Tarjetas de injects",
            "eeg": "Guía de evaluación del ejercicio (EEG)",
            "evaluation-plan": "Plan de evaluación",
            "feedback-form": "Formulario de feedback de los participantes",
        },
        "plan_not_ready": (
            "No definitivo: el plan de evaluación es la versión {version} en borrador. "
            "Usa la versión marcada como lista para la sesión."
        ),
        "plan_version": "Plan",
        "cp_sections": {
            "session": "Sesión",
            "team": "Equipo del ejercicio",
            "evaluation": "Evaluación",
            "evaluators": "Evaluadores",
            "data": "Recogida de datos",
            "briefing": "Briefing de evaluadores",
            "calendar": "Calendario de evaluación",
            "non_intervention": "Reglas para los evaluadores",
            "ratings": "Escala de valoración",
            "participant": "Sobre ti",
            "conduct": "El ejercicio",
            "strengths": _OPEN["strengths"]["es"],
            "improvements": _OPEN["improvements"]["es"],
            "plans": _OPEN["plans"]["es"],
            "comments": _OPEN["comments"]["es"],
        },
        "cp_fields": {
            "date": "Fecha",
            "start": "Inicio",
            "timezone": "Zona horaria",
            "modality": "Modalidad",
            "venue": "Sede",
            "room": "Sala",
            "link": "Enlace de la reunión",
            "facilitators": "Facilitadores",
            "lead_evaluator": "Lead Evaluator",
            "log_keeper": "Registro de ejecución",
            "methods": "Métodos",
            "briefing_date": "Fecha",
            "briefing_covers": "Cubre",
            "evaluators": "Evaluadores",
            "name": "Nombre (opcional)",
            "area": "Área o cargo",
        },
        "cp_table": {
            "evaluator": "Evaluador",
            "objectives": "Objetivos",
            "areas": "Áreas",
            "level": "Nivel",
            "criterion": "Cómo se reconoce",
            "statement": "Afirmación",
            "score": "1  2  3  4  5",
        },
        "modalities": {"in_person": "Presencial", "remote": "En remoto", "hybrid": "Híbrida"},
        "methods": {
            "direct_observation": "Observación directa",
            "decision_timeline": "Timeline de decisiones",
            "communications_log": "Log de comunicaciones",
            "observation_notes": "Notas de observación",
            "document_review": "Revisión de documentos",
            "feedback_forms": "Formularios de feedback de los participantes",
            "interviews": "Entrevistas",
            "hot_wash": "Hot wash",
            "other": "Otro",
        },
        "briefing_items": {
            "objectives": "Objetivos y alcance",
            "eeg": "Las EEG y la escala de valoración",
            "msel": "El MSEL y la línea temporal",
            "non_intervention": "Reglas de no intervención",
            "data_collection": "Cómo recoger los datos",
            "logistics": "Logística y roles el día de la sesión",
        },
        "calendar": {
            "hot_wash_days": "Hot wash",
            "debrief_days": "Debrief de controladores y evaluadores",
            "ratings_due_days": "Entrega de las EEG valoradas",
            "draft_aar_days": "Borrador del AAR y plan de mejora",
            "after_action_meeting_days": "After Action Meeting",
            "same_day": "El día de la sesión",
            "days_after": "{days} días después",
            "on_date": "{deadline} ({date})",
        },
        "sitman_rules": (
            "Lo que se dice en la sesión no se atribuye a nadie en el informe.",
            "Móviles en silencio; las llamadas reales se atienden fuera de la sala.",
        ),
        "non_intervention": (
            "Observa y registra; no juegues, no facilites ni respondas a las preguntas de los "
            "Jugadores.",
            "Registra lo que se dice y se decide, con la hora, no tu opinión.",
            "Entrega tus EEG valoradas y tus notas en la fecha del calendario.",
        ),
        "eeg_intro": (
            "Para cada objetivo, marca los puntos de observación que veas ocurrir y valora el "
            "desempeño con la escala siguiente; un punto puede ajustar un nivel."
        ),
        "level_definitions": (
            "Se hace como se esperaba y a tiempo, conforme a los planes y procedimientos, "
            "sin perjudicar a otras actividades.",
            "Se hace y se logra, pero con margen de mejora en eficacia o eficiencia.",
            "Se hace solo en parte, tarde, con ayuda o con efectos negativos en otras actividades.",
            "No se hace, o se hace de forma que no logra lo esperado.",
        ),
        "feedback_intro": INTRO["es"],
        "feedback_items": tuple(entry["es"] for _, entry in STATEMENTS),
        "objective_item": OBJECTIVE_STATEMENT["es"],
        "evaluated_by": "Evalúa: {names}",
        "unassigned": "Sin evaluador asignado",
        "notifications": {
            "title": "Notificaciones esperadas",
            "intro": (
                "Lo que el equipo debería reconocer cuando el incidente activa una obligación "
                "de notificar. El reloj es simulado: anota si identifican cada régimen, su "
                "plazo, desde cuándo cuenta y quién notifica por rol, no si lo cumplen."
            ),
            "legend": (
                "I: identificado; P: plazo correcto; C: cómputo correcto; R: responsable por rol."
            ),
            "marks": "I [ ]  P [ ]  C [ ]  R [ ]",
            "cited_by": "Objetivos: {codes}",
            "columns": {
                "regime": "Régimen",
                "report": "Notificación y destinatario",
                "deadline": "Plazo",
                "clock": "Cuenta desde",
                "observed": "Observado",
            },
            "notes": "Hora simulada y notas",
        },
    },
}
