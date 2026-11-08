import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class ApproverKind(StrEnum):
    SPONSOR = "sponsor"
    DESIGN_LEAD = "design_lead"
    COMPLIANCE = "compliance"


class TTXNeedsFormApproval(SQLModel, table=True):
    """An approval of one version of a needs form. The approver (usually
    the sponsor) is rarely a platform user, so a Planner records it on
    their behalf -- `recorded_by_id`/`recorded_at` say who and when. A
    status mark with an audit trail, not an electronic signature. Rows for
    older versions are kept as history."""

    __tablename__ = "ttx_needs_form_approval"
    __table_args__ = (UniqueConstraint("form_id", "version", "approver_kind"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    form_id: uuid.UUID = Field(foreign_key="ttx_needs_form.id", index=True)
    version: int
    approver_kind: ApproverKind
    approver_name: str = Field(max_length=255)
    approver_role: str = Field(default="", max_length=255)
    approved_on: date
    recorded_by_id: uuid.UUID = Field(foreign_key="user.id")
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
