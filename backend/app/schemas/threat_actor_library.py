"""The threat actor library: TTX-Zone's catalog (MITRE ATT&CK's groups) and
an organization's own threat actors."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

from app.models import ActorOrigin

ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
GroupId = Annotated[str, Field(pattern=r"^G\d{4}$")]
TechniqueId = Annotated[str, Field(pattern=r"^T\d{4}(\.\d{3})?$")]

# A MITRE group attributes up to ~200 techniques; room to spare.
MAX_THREAT_ACTOR_TECHNIQUES = 400
MAX_ALIASES = 50


class ThreatActorTechnique(BaseModel):
    """A technique a threat actor uses, as MITRE records it: no tactic
    (a technique may serve several)."""

    domain: Literal["enterprise", "ics"]
    technique_id: TechniqueId

    def key(self) -> tuple[str, str]:
        return (self.domain, self.technique_id)


class ThreatActorTechniqueRead(ThreatActorTechnique):
    technique_name: str
    # The technique's tactics in the release, matrix order.
    tactic_ids: list[str]


class SystemThreatActorRead(BaseModel):
    """A MITRE ATT&CK group."""

    id: str
    name: str
    aliases: list[str]
    techniques: list[ThreatActorTechnique]


class SystemThreatActorListResponse(BaseModel):
    attack_version: str
    released: str
    copyright: str
    items: list[SystemThreatActorRead]


class ThreatActorFields(BaseModel):
    """What a threat actor is, at any library level."""

    name: Annotated[str, Field(min_length=1, max_length=255)]
    # The MITRE ATT&CK group it is, if any (an unknown actor has none).
    mitre_group_id: GroupId | None = None
    aliases: list[ShortText] = Field(default_factory=list, max_length=MAX_ALIASES)
    description: LongText = ""
    # The release `techniques` belong to.
    attack_version: Annotated[str, Field(max_length=16)]
    techniques: list[ThreatActorTechnique] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTOR_TECHNIQUES
    )
    origin: ActorOrigin | None = None
    origin_id: Annotated[str, Field(max_length=64)] | None = None
    origin_name: ShortText | None = None

    @field_validator("techniques")
    @classmethod
    def _unique(cls, values: list[ThreatActorTechnique]) -> list[ThreatActorTechnique]:
        seen: dict[tuple[str, str], ThreatActorTechnique] = {}
        for value in values:
            seen.setdefault(value.key(), value)
        return list(seen.values())

    @field_validator("aliases")
    @classmethod
    def _clean_aliases(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(v.strip() for v in values if v.strip()))


class OrganizationThreatActorRead(BaseModel):
    id: uuid.UUID
    name: str
    mitre_group_id: str | None
    aliases: list[str]
    description: str
    attack_version: str
    techniques: list[ThreatActorTechniqueRead]
    origin: ActorOrigin | None
    origin_id: str | None
    origin_name: str | None
    created_at: datetime
    updated_at: datetime
    # Set when deleted while still in use (see library_usage_service).
    disabled_at: datetime | None = None
    # How many uses keep it from being deleted for good (library lists only).
    usage_count: int = 0


class OrganizationThreatActorListResponse(BaseModel):
    items: list[OrganizationThreatActorRead]


class ThreatActorProfile(BaseModel):
    """A threat actor's MITRE group and technique profile, to move onto
    another ATT&CK release (POST /attack/{version}/threat-actor)."""

    mitre_group_id: GroupId | None = None
    techniques: list[ThreatActorTechnique] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTOR_TECHNIQUES
    )
