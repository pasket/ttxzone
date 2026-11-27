"""The AI assistant's proposals to an organization: a new exercise for
its Planner to create, an inject for its Library. Kept as the fields of
the form that takes them, validated when proposed against that form's own
save; the person accepts one into the form and its save creates the row."""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from sqlmodel import Session, col, delete, select

from app.core.exceptions import AppException
from app.models import AssistantOrgProposal, Organization, User
from app.schemas.inject_library import OrganizationInjectFields
from app.schemas.ttx import TTXCreateRequest
from app.services import inject_library_service, platform_audit_service
from app.services.assistant.proposals import DECIDED_RETENTION_DAYS, PENDING_RETENTION_DAYS

logger = logging.getLogger(__name__)

NEW_EXERCISE = "new_exercise"
LIBRARY_INJECT = "library_inject"
TARGETS = (NEW_EXERCISE, LIBRARY_INJECT)
MAX_PENDING_PER_ORGANIZATION = 20

# What the assistant writes of a Library inject; the rest (ATT&CK
# techniques, where it was copied from, a TTX-Zone actor) the person sets
# in the form.
_INJECT_FIELDS = (
    "language",
    "title",
    "content",
    "kind",
    "trigger_condition",
    "contingent_purpose",
    "actor_name",
    "actor_type",
    "delivery_method",
    "recipients",
    "expected_actions",
    "attachment_notes",
    "key_question",
    "facilitator_notes",
    "families",
    "stage",
    "audience",
    "capabilities",
    "variable_defaults",
)
LibraryInjectItem: type[BaseModel] = create_model(  # type: ignore[call-overload]
    "LibraryInjectItem",
    __config__=ConfigDict(extra="forbid"),
    **{
        name: (info.annotation, info)
        for name, info in OrganizationInjectFields.model_fields.items()
        if name in _INJECT_FIELDS
    },
)


class NewExerciseItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255, description="The exercise's name.")
    description: str = Field(
        default="",
        max_length=10000,
        description="What it's for and what it will test, in a few paragraphs (plain text "
        "or simple Markdown).",
    )
    content_language: str | None = Field(
        default=None, description='The language its content will be written in: "en" or "es".'
    )


def _refused(code: str, message: str, params: dict | None = None) -> AppException:
    return AppException(code, message, 422, log_level=logging.WARNING, params=params)


def _first_error(exc: ValidationError) -> str:
    error = exc.errors()[0]
    return f"{'.'.join(str(p) for p in error['loc'])}: {error['msg']}"


def _pending(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> list[AssistantOrgProposal]:
    return list(
        session.exec(
            select(AssistantOrgProposal).where(
                AssistantOrgProposal.organization_id == organization_id,
                AssistantOrgProposal.user_id == user_id,
                AssistantOrgProposal.status == "pending",
            )
        )
    )


def _keep(
    session: Session,
    organization: Organization,
    user: User,
    target: str,
    patches: list[dict[str, Any]],
    summary: str,
) -> list[AssistantOrgProposal]:
    if len(_pending(session, organization.id, user.id)) + len(patches) > (
        MAX_PENDING_PER_ORGANIZATION
    ):
        raise AppException(
            "ASSISTANT_PROPOSAL_LIMIT",
            "Too many proposals wait for a decision in this organization ({limit} at most): "
            "ask the person to review them first.",
            409,
            log_level=logging.WARNING,
            params={"limit": MAX_PENDING_PER_ORGANIZATION},
        )
    kept = [
        AssistantOrgProposal(
            organization_id=organization.id,
            user_id=user.id,
            target=target,
            patch=patch,
            summary=summary.strip()[:500],
        )
        for patch in patches
    ]
    session.add_all(kept)
    session.commit()
    return kept


def propose_new_exercise(
    session: Session, organization: Organization, user: User, item: NewExerciseItem, summary: str
) -> AssistantOrgProposal:
    try:
        checked = TTXCreateRequest(
            name=item.name.strip(),
            description=item.description.strip() or None,
            organization_id=organization.id,
            content_language=item.content_language,
        )
    except ValidationError as exc:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The proposal doesn't fit the form: {detail}",
            {"detail": _first_error(exc)},
        ) from exc
    patch = checked.model_dump(mode="json", exclude={"organization_id"})
    return _keep(session, organization, user, NEW_EXERCISE, [patch], summary)[0]


def propose_library_injects(
    session: Session, organization: Organization, user: User, items: list[BaseModel], summary: str
) -> list[AssistantOrgProposal]:
    patches = []
    for item in items:
        try:
            checked = OrganizationInjectFields.model_validate(
                item.model_dump(mode="json", exclude_unset=True)
            )
        except ValidationError as exc:
            raise _refused(
                "ASSISTANT_PROPOSAL_INVALID",
                "The proposal doesn't fit the form: {detail}",
                {"detail": _first_error(exc)},
            ) from exc
        inject_library_service.check_fields(checked)
        patches.append(checked.model_dump(mode="json"))
    return _keep(session, organization, user, LIBRARY_INJECT, patches, summary)


def list_for_author(
    session: Session,
    organization_id: uuid.UUID,
    user: User,
    *,
    status: str | None = "pending",
    target: str | None = None,
) -> list[AssistantOrgProposal]:
    query = select(AssistantOrgProposal).where(
        AssistantOrgProposal.organization_id == organization_id,
        AssistantOrgProposal.user_id == user.id,
    )
    if status:
        query = query.where(AssistantOrgProposal.status == status)
    if target:
        query = query.where(AssistantOrgProposal.target == target)
    return list(session.exec(query.order_by(col(AssistantOrgProposal.created_at))))


def _get(
    session: Session, organization: Organization, user: User, proposal_id: uuid.UUID
) -> AssistantOrgProposal:
    proposal = session.get(AssistantOrgProposal, proposal_id)
    if (
        proposal is None
        or proposal.organization_id != organization.id
        or proposal.user_id != user.id
    ):
        raise AppException("ASSISTANT_PROPOSAL_NOT_FOUND", "Proposal not found.", 404)
    if proposal.status != "pending":
        raise AppException(
            "ASSISTANT_PROPOSAL_DECIDED",
            "This proposal was already accepted or discarded.",
            409,
            log_level=logging.WARNING,
        )
    return proposal


def _decide(
    session: Session,
    organization: Organization,
    user: User,
    proposal: AssistantOrgProposal,
    status: str,
) -> None:
    proposal.status = status
    proposal.decided_at = datetime.now(UTC)
    session.add(proposal)
    # Who decided what kind of proposal, never what it said.
    platform_audit_service.record(
        session,
        user,
        "assistant.proposal_accepted" if status == "accepted" else "assistant.proposal_discarded",
        "organization",
        organization.id,
        target_label=organization.name[:255],
        details={"target": proposal.target, "proposal_id": str(proposal.id)},
    )


def mark_applied(
    session: Session,
    organization: Organization,
    user: User,
    proposal_id: uuid.UUID,
    row_id: uuid.UUID,
) -> AssistantOrgProposal:
    """The form saved what the proposal became: recorded as accepted."""
    proposal = _get(session, organization, user, proposal_id)
    proposal.applied_id = row_id
    _decide(session, organization, user, proposal, "accepted")
    session.refresh(proposal)
    return proposal


def discard(
    session: Session,
    organization: Organization,
    user: User,
    proposal_id: uuid.UUID,
    *,
    reason: str | None = None,
    note: str = "",
) -> AssistantOrgProposal:
    proposal = _get(session, organization, user, proposal_id)
    proposal.decision_reason = reason
    proposal.decision_note = note.strip() or None
    _decide(session, organization, user, proposal, "discarded")
    session.refresh(proposal)
    return proposal


def delete_for_organization(session: Session, organization_id: uuid.UUID) -> None:
    session.exec(
        delete(AssistantOrgProposal).where(
            col(AssistantOrgProposal.organization_id) == organization_id
        )
    )


def prune_expired(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = session.exec(
        delete(AssistantOrgProposal).where(
            (
                (col(AssistantOrgProposal.status) == "pending")
                & (
                    col(AssistantOrgProposal.created_at)
                    < now - timedelta(days=PENDING_RETENTION_DAYS)
                )
            )
            | (
                (col(AssistantOrgProposal.status) != "pending")
                & (
                    col(AssistantOrgProposal.decided_at)
                    < now - timedelta(days=DECIDED_RETENTION_DAYS)
                )
            )
        )
    )
    session.commit()
    return result.rowcount or 0
