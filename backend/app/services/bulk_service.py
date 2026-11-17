"""One action on several rows at once (approve these requests, remove
these Players, archive these exercises): each row goes through the same
service as on its own, so the rules and what is recorded don't change,
and one that fails doesn't stop the rest -- the answer says which were
done and, for the others, why not, in the caller's language."""

import uuid
from collections.abc import Callable, Iterable

from fastapi import HTTPException
from sqlmodel import Session

from app.core.exceptions import AppException
from app.core.i18n import translate_error
from app.schemas.bulk import BulkFailure, BulkResult


def each(
    session: Session, ids: Iterable[uuid.UUID], action: Callable[[uuid.UUID], object], locale: str
) -> BulkResult:
    done: list[uuid.UUID] = []
    failed: list[BulkFailure] = []
    # The same id twice is one row.
    for row_id in dict.fromkeys(ids):
        try:
            action(row_id)
            done.append(row_id)
        except AppException as error:
            session.rollback()
            failed.append(
                BulkFailure(
                    id=row_id,
                    code=error.code,
                    message=translate_error(error.template, error.params, locale),
                )
            )
        except HTTPException as error:
            session.rollback()
            failed.append(BulkFailure(id=row_id, code="NOT_FOUND", message=str(error.detail)))
    return BulkResult(done=done, failed=failed)
