"""The participant feedback form: the same questions on paper (the session
plan's PDF) and in the Playground once the session is over. Statements are
rated 1 (strongly disagree) to 5 (strongly agree); one more per objective
of the exercise; then four open questions. Keys are stable: answers are
stored under them."""

INTRO = {
    "en": (
        "Your view helps improve the plans and the next exercise. Rate each statement "
        "from 1 (strongly disagree) to 5 (strongly agree)."
    ),
    "es": (
        "Tu opinión ayuda a mejorar los planes y el próximo ejercicio. Valora cada afirmación "
        "de 1 (muy en desacuerdo) a 5 (muy de acuerdo)."
    ),
}

STATEMENTS: tuple[tuple[str, dict[str, str]], ...] = (
    (
        "objectives_clear",
        {
            "en": "The objectives of the exercise were clear.",
            "es": "Los objetivos del ejercicio estaban claros.",
        },
    ),
    (
        "scenario_realistic",
        {
            "en": "The scenario was realistic for our organization.",
            "es": "El escenario era realista para nuestra organización.",
        },
    ),
    (
        "time_adequate",
        {
            "en": "The session time was adequate for the discussion.",
            "es": "El tiempo de la sesión fue adecuado para el debate.",
        },
    ),
    (
        "facilitation_focused",
        {
            "en": "The facilitation kept the discussion focused.",
            "es": "La facilitación mantuvo el debate centrado.",
        },
    ),
    (
        "materials_useful",
        {
            "en": "The documents and materials were useful.",
            "es": "Los documentos y materiales fueron útiles.",
        },
    ),
    (
        "logistics_worked",
        {
            "en": "The venue and logistics worked well.",
            "es": "La sede y la logística funcionaron bien.",
        },
    ),
    (
        "area_improvement_known",
        {
            "en": "I know what my area should improve.",
            "es": "Sé qué debe mejorar mi área.",
        },
    ),
)

# One more statement per objective, keyed by the objective's code.
OBJECTIVE_STATEMENT = {
    "en": "We met this objective: {objective}",
    "es": "Cumplimos este objetivo: {objective}",
}

OPEN_QUESTIONS: tuple[tuple[str, dict[str, str]], ...] = (
    ("strengths", {"en": "Strengths you observed", "es": "Fortalezas que observaste"}),
    ("improvements", {"en": "Areas for improvement", "es": "Áreas de mejora"}),
    (
        "plans",
        {
            "en": "What would you change in your plans or procedures?",
            "es": "¿Qué cambiarías en tus planes o procedimientos?",
        },
    ),
    (
        "comments",
        {
            "en": "Comments on the conduct and logistics",
            "es": "Comentarios sobre la conducción y la logística",
        },
    ),
)


def text(entry: dict[str, str], locale: str) -> str:
    return entry.get(locale) or entry["en"]
