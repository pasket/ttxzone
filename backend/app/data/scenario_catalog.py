"""TTX-Zone's own scenarios: whole exercises shipped with the product,
read-only, copied into an organization's library or onto an exercise.

One `.ttx.md` file per scenario and language under `app/data/scenarios/`,
named `<id>.<language>.ttx.md` (`ransomware.en.ttx.md`): the same format an
export writes, read by the same parser, so the catalog is also the format's
reference. Loaded once; a broken file fails `test_scenario_catalog.py`,
never a request."""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.schemas.scenario import ScenarioDocument
from app.services.scenario_document import FILE_SUFFIX, parse

SCENARIO_DIR = Path(__file__).resolve().parent / "scenarios"


@dataclass(frozen=True)
class SystemScenario:
    id: str
    # language -> document
    documents: dict[str, ScenarioDocument]

    @property
    def languages(self) -> list[str]:
        """The languages it can be read and copied in."""
        return sorted(self.documents)

    def document(self, locale: str) -> ScenarioDocument:
        """In the reader's language, else English, else any."""
        language = "es" if locale.lower().startswith("es") else "en"
        return (
            self.documents.get(language)
            or self.documents.get("en")
            or next(iter(self.documents.values()))
        )


@lru_cache
def scenario_catalog() -> dict[str, SystemScenario]:
    documents: dict[str, dict[str, ScenarioDocument]] = {}
    for path in sorted(SCENARIO_DIR.glob(f"*{FILE_SUFFIX}")):
        scenario_id, _, language = path.name.removesuffix(FILE_SUFFIX).rpartition(".")
        doc = parse(path.read_text(encoding="utf-8"))
        if not scenario_id or doc.language != language:
            raise ValueError(f"{path.name}: name it <id>.{doc.language}{FILE_SUFFIX}")
        documents.setdefault(scenario_id, {})[language] = doc
    return {
        scenario_id: SystemScenario(id=scenario_id, documents=by_language)
        for scenario_id, by_language in documents.items()
    }
