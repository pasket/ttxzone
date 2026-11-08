"""TTX-Zone's SMART objective templates and exercise risk library: every
template obeys the needs form's own rules, so picking one adds no warning."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.data.objective_catalog import OBJECTIVE_CATALOG
from app.data.regulatory_catalog import REGULATORY_REQUIREMENT_IDS
from app.data.risk_catalog import RISK_CATALOG, default_risks
from app.models.ttx_needs_form import Capability
from app.services.objective_text import is_rating_level
from app.services.ttx_needs_form_service import _VAGUE_PATTERN
from tests.test_ttx_needs_form import _manager


def test_every_capability_has_templates() -> None:
    covered = {template.capability for template in OBJECTIVE_CATALOG}
    assert covered == set(Capability)


def test_templates_follow_the_form_rules() -> None:
    ids = [template.id for template in OBJECTIVE_CATALOG]
    assert len(ids) == len(set(ids))
    for template in OBJECTIVE_CATALOG:
        for title in (template.title_en, template.title_es):
            assert 0 < len(title) <= 80, template.id
        assert template.statement_en and template.statement_es
        assert len(template.criterion_en) == len(template.criterion_es), template.id
        assert len(template.evidence_en) == len(template.evidence_es), template.id
        assert template.criterion_en, template.id
        for line in (*template.criterion_en, *template.criterion_es):
            assert "\n" not in line
            assert not _VAGUE_PATTERN.search(line), (template.id, line)
            assert not is_rating_level(line), (template.id, line)
        for requirement in template.regulatory_requirement_ids:
            assert requirement in REGULATORY_REQUIREMENT_IDS, (template.id, requirement)


def test_risk_library_and_defaults() -> None:
    ids = [risk.id for risk in RISK_CATALOG]
    assert len(ids) == len(set(ids))
    assert len(default_risks("en")) == 3
    assert default_risks("es")[0][0] == "Filtración del escenario"
    for risk in RISK_CATALOG:
        assert risk.risk_en and risk.risk_es and risk.mitigation_en and risk.mitigation_es


def test_catalogs_are_served(client: TestClient, db_session: Session) -> None:
    assert client.get("/api/v1/objective-catalog").status_code == 401
    _manager(client, db_session, "owner@acme.com", "Acme")

    objectives = client.get("/api/v1/objective-catalog").json()["items"]
    assert len(objectives) == len(OBJECTIVE_CATALOG)
    first = objectives[0]
    assert first["capability"] == OBJECTIVE_CATALOG[0].capability.value
    assert first["criterion_es"] == list(OBJECTIVE_CATALOG[0].criterion_es)

    risks = client.get("/api/v1/risk-catalog").json()["items"]
    assert [r["id"] for r in risks] == [r.id for r in RISK_CATALOG]
    assert sum(r["default"] for r in risks) == 3
