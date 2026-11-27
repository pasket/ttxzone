import uuid
from datetime import UTC, datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

# The roles whose holders reach the organization's data through the AI
# assistant (services/assistant/switch.py), unless it turns them off.
DEFAULT_ASSISTANT_ROLES = ("program_manager", "planner", "evaluator")


class Organization(SQLModel, table=True):
    __tablename__ = "organization"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255)
    # The founding Program Manager's email domain at signup, captured once and
    # never editable -- shown alongside the org name in invite-facing copy
    # so a recipient can judge provenance. Nullable: orgs created before
    # this column existed have no backfilled value.
    domain: str | None = Field(default=None, max_length=255)
    # Program Manager-editable like name (unlike domain) -- shown in parens next to
    # the org name in the header's context bar when set.
    alias: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=50)
    subscription_tier: str = Field(default="free", max_length=50)
    description: str | None = Field(default=None, max_length=2000)
    logo_path: str | None = Field(default=None, max_length=255)
    # What exercises are designed around, in the organization's own words
    # (Admin → Organization): read by its Planners' AI client so proposals
    # fit it. Free text; never personal data.
    sector: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=255)
    regulators: str | None = Field(default=None, max_length=1000)
    technologies: str | None = Field(default=None, max_length=2000)
    critical_assets: str | None = Field(default=None, max_length=2000)
    # The roles the AI assistant is on for here (Admin → Organization),
    # inside the instance's own switch: "program_manager", "planner",
    # "controller" (the Facilitator with it), "evaluator".
    assistant_roles: list[str] = Field(
        default_factory=lambda: list(DEFAULT_ASSISTANT_ROLES),
        sa_column=Column(
            JSONB,
            nullable=False,
            server_default='["program_manager", "planner", "evaluator"]',
        ),
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
