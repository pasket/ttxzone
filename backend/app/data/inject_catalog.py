"""TTX-Zone's own injects: the read-only first level of the inject library
(then each organization's own, then each exercise's MSEL). A code-level
catalog like the actor and ATT&CK ones: the data lives in
app/data/injects/catalog.json, in both supported locales, and is validated
here when first loaded -- a broken catalog fails the tests, never a request.

Every entry has a stable code, INJ-<FAM>-NN (INJ-<FAM>-CNN for contingent
injects): <FAM> is its first family's code, the number follows the
scenario's order when written and is never reused or renumbered. Anonymized
and generic: organization-specific details are variables -- system ones
(`SYSTEM_VARIABLES`, filled from the organization and the needs analysis)
and scenario ones, which carry a default value (`variable_defaults`).

What only makes sense inside one exercise -- its MSEL code, offset, phase,
objectives, review status -- is not here: it is chosen when an inject is
copied into an MSEL. The template carries the stage (which proposes the
phase) and the capabilities (which propose the objectives) instead."""

import json
import re
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, Field, model_validator

from app.data.actor_catalog import ACTOR_CATALOG_BY_ID
from app.data.attack_catalog import is_selectable
from app.data.regulatory_catalog import FRAMEWORK_CATALOG
from app.models.inject import DeliveryMethod, InjectKind
from app.models.ttx_needs_form import Capability

_FILE = Path(__file__).resolve().parent / "injects" / "catalog.json"
# Illustrative images some injects carry (a console, a ransom note...):
# fictitious, PNG, one file per language. Their sources (HTML mock-ups)
# live in images/src and are rendered by scripts/render_inject_images.py.
IMAGE_DIR = _FILE.parent / "images"
_IMAGE_FILE = re.compile(r"[a-z0-9][a-z0-9-]*\.png")
MAX_CATALOG_IMAGE_BYTES = 2 * 1024 * 1024


class InjectFamily(StrEnum):
    """The kind of threat an inject belongs to; `regulatory` and `generic`
    are transversal (they serve any scenario)."""

    RANSOMWARE = "ransomware"
    DATA_BREACH = "data_breach"
    BEC_FRAUD = "bec_fraud"
    PHISHING_ACCOUNT_TAKEOVER = "phishing_account_takeover"
    SUPPLY_CHAIN = "supply_chain"
    CLOUD_COMPROMISE = "cloud_compromise"
    DDOS = "ddos"
    INSIDER = "insider"
    WIPER_DESTRUCTIVE = "wiper_destructive"
    OT_ICS = "ot_ics"
    PHYSICAL_HYBRID = "physical_hybrid"
    REGULATORY = "regulatory"
    GENERIC = "generic"


# The <FAM> part of an inject's code, in catalog order.
FAMILY_CODES: dict[InjectFamily, str] = {
    InjectFamily.RANSOMWARE: "RAN",
    InjectFamily.DATA_BREACH: "DBR",
    InjectFamily.BEC_FRAUD: "BEC",
    InjectFamily.PHISHING_ACCOUNT_TAKEOVER: "PHI",
    InjectFamily.SUPPLY_CHAIN: "SUP",
    InjectFamily.CLOUD_COMPROMISE: "CLD",
    InjectFamily.DDOS: "DOS",
    InjectFamily.INSIDER: "INS",
    InjectFamily.WIPER_DESTRUCTIVE: "WIP",
    InjectFamily.OT_ICS: "ICS",
    InjectFamily.PHYSICAL_HYBRID: "HYB",
    InjectFamily.REGULATORY: "REG",
    InjectFamily.GENERIC: "GEN",
}


class InjectStage(StrEnum):
    """Where in the incident an inject sits -- the MSEL's suggested phases."""

    DETECTION = "detection"
    ESCALATION = "escalation"
    RESPONSE = "response"
    RECOVERY = "recovery"


class InjectAudience(StrEnum):
    EXECUTIVE = "executive"
    TECHNICAL = "technical"
    MIXED = "mixed"


# Anonymize the organization; no default value, filled per exercise.
SYSTEM_VARIABLES: frozenset[str] = frozenset(
    {
        "organization",
        "organization_short",
        "sector",
        "country",
        "critical_service",
        "critical_system",
        "data_type",
        "supplier",
        "customer",
        "product",
        "location",
    }
)

_CODE = re.compile(r"INJ-(?P<family>[A-Z]{3})-(?P<contingent>C?)\d{2}")
_VARIABLE = re.compile(r"\{(\w+)\}")
_SCENARIO_VARIABLE = re.compile(r"[a-z][a-z0-9_]{1,31}")


class Localized(BaseModel):
    es: Annotated[str, Field(min_length=1)]
    en: Annotated[str, Field(min_length=1)]

    def texts(self) -> tuple[str, str]:
        return self.es, self.en


class CatalogAction(BaseModel):
    description: Localized
    responsible_role: Localized
    # Scenario minutes after the inject is delivered, not session minutes.
    within_minutes: Annotated[int, Field(gt=0)] | None


class CatalogAttack(BaseModel):
    domain: str
    tactic: str
    technique: str


class InjectTemplateFields(BaseModel):
    """What an inject template is, without its ATT&CK references (the
    catalog stores ids; the API also sends names)."""

    id: str
    title: Localized
    content: Localized
    kind: InjectKind
    contingent_for: str | None
    trigger: Localized | None
    purpose: Localized | None
    actor: str
    delivery_method: DeliveryMethod
    recipients: Annotated[list[Localized], Field(min_length=1, max_length=5)]
    expected_actions: Annotated[list[CatalogAction], Field(min_length=1, max_length=8)]
    attachments: list[Localized]
    key_question: Localized | None
    facilitator_notes: Localized | None
    families: Annotated[list[InjectFamily], Field(min_length=1)]
    stage: InjectStage
    capabilities: Annotated[list[Capability], Field(min_length=1, max_length=2)]
    audience: InjectAudience
    frameworks: list[str]
    variables: list[str]
    variable_defaults: dict[str, Localized]

    def texts(self) -> list[str]:
        """Every text a variable may appear in, both languages."""
        parts: list[Localized | None] = [
            self.title,
            self.content,
            self.trigger,
            self.purpose,
            self.key_question,
            self.facilitator_notes,
            *self.recipients,
            *self.attachments,
        ]
        for action in self.expected_actions:
            parts += [action.description, action.responsible_role]
        return [text for part in parts if part for text in part.texts() if text]


class CatalogImage(BaseModel):
    """An image shown with the inject once copied into an exercise, in the
    exercise's language: a file under IMAGE_DIR per language (the same
    file twice when it carries no text) and a caption that says it's
    fictitious."""

    file: Localized
    caption: Localized

    @model_validator(mode="after")
    def _check(self) -> "CatalogImage":
        for name in self.file.texts():
            if not _IMAGE_FILE.fullmatch(name):
                raise ValueError(f"{name}: an image is a lowercase .png file name")
            path = IMAGE_DIR / name
            if not path.is_file():
                raise ValueError(f"{name}: no such image in {IMAGE_DIR.name}/")
            if path.stat().st_size > MAX_CATALOG_IMAGE_BYTES:
                raise ValueError(f"{name}: larger than {MAX_CATALOG_IMAGE_BYTES} bytes")
        return self

    def path(self, language: str) -> Path:
        return IMAGE_DIR / (self.file.es if language == "es" else self.file.en)


class SystemInject(InjectTemplateFields):
    attack: list[CatalogAttack]
    # Illustrations, for a few injects only (a demo of what images add).
    images: Annotated[list[CatalogImage], Field(max_length=3)] = []

    @model_validator(mode="before")
    @classmethod
    def _empty_notes_are_none(cls, data: dict) -> dict:
        notes = data.get("facilitator_notes")
        if isinstance(notes, dict) and not any(notes.values()):
            data = {**data, "facilitator_notes": None}
        return data

    @model_validator(mode="after")
    def _check(self) -> "SystemInject":
        code = _CODE.fullmatch(self.id)
        if not code:
            raise ValueError(f"{self.id}: not an INJ-<FAM>-NN code")
        if code["family"] != FAMILY_CODES[self.families[0]]:
            raise ValueError(f"{self.id}: code doesn't match its first family")
        contingent = self.kind == InjectKind.CONTINGENT
        if bool(code["contingent"]) != contingent:
            raise ValueError(f"{self.id}: only contingent injects are INJ-<FAM>-CNN")
        if contingent != all((self.contingent_for, self.trigger, self.purpose)):
            raise ValueError(f"{self.id}: trigger, purpose and contingent_for go together")
        if contingent is False and any((self.contingent_for, self.trigger, self.purpose)):
            raise ValueError(f"{self.id}: a mandatory inject has no trigger")
        if self.actor not in ACTOR_CATALOG_BY_ID:
            raise ValueError(f"{self.id}: unknown actor {self.actor}")
        unknown = set(self.frameworks) - {f.id for f in FRAMEWORK_CATALOG}
        if unknown:
            raise ValueError(f"{self.id}: unknown frameworks {sorted(unknown)}")
        used = {name for text in self.texts() for name in _VARIABLE.findall(text)}
        if used != set(self.variables):
            raise ValueError(f"{self.id}: `variables` doesn't list what the texts use")
        scenario = used - SYSTEM_VARIABLES
        if set(self.variable_defaults) != scenario:
            raise ValueError(f"{self.id}: scenario variables need exactly one default each")
        if any(not _SCENARIO_VARIABLE.fullmatch(name) for name in scenario):
            raise ValueError(f"{self.id}: scenario variables are snake_case")
        return self


class InjectCatalog(BaseModel):
    attack_version: str
    injects: list[SystemInject]

    @model_validator(mode="after")
    def _check(self) -> "InjectCatalog":
        by_id = {inject.id: inject for inject in self.injects}
        if len(by_id) != len(self.injects):
            raise ValueError("duplicate inject codes")
        for inject in self.injects:
            for ref in inject.attack:
                if not is_selectable(self.attack_version, ref.domain, ref.tactic, ref.technique):
                    raise ValueError(f"{inject.id}: {ref.technique} isn't under {ref.tactic}")
            if inject.contingent_for:
                parent = by_id.get(inject.contingent_for)
                if parent is None or parent.kind != InjectKind.MANDATORY:
                    raise ValueError(f"{inject.id}: contingent on a missing mandatory inject")
                if parent.families != inject.families:
                    raise ValueError(f"{inject.id}: a contingent keeps its parent's families")
        return self


@lru_cache
def load_inject_catalog() -> InjectCatalog:
    return InjectCatalog.model_validate(json.loads(_FILE.read_text()))


def catalog_inject(inject_id: str | None) -> SystemInject | None:
    if inject_id is None:
        return None
    return next((i for i in load_inject_catalog().injects if i.id == inject_id), None)
