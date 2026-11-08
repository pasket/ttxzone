"""What needs fixing in an exercise's documents, counted for the Creator
menu: the validation issues that keep each one from moving on (to review,
approval or READY), whatever their origin. Reads only documents that
exist: opening one is its page's job."""

from sqlmodel import Session

from app.models import TTX
from app.schemas.ttx import TTXAttentionRead
from app.services.ttx_conduct_prep_service import find_prep, prep_read
from app.services.ttx_msel_service import find_msel, msel_read
from app.services.ttx_needs_form_service import form_read, get_form


def _blocking(report) -> int:
    return len(report.ready) + len(report.approved)


def attention(session: Session, ttx: TTX) -> TTXAttentionRead:
    needs = form_read(session, ttx, get_form(session, ttx.id))
    msel = find_msel(session, ttx.id)
    prep = find_prep(session, ttx.id)
    return TTXAttentionRead(
        needs_analysis=_blocking(needs.validation),
        msel=_blocking(msel_read(session, ttx, msel).validation) if msel else None,
        session_plan=_blocking(prep_read(session, ttx, prep).validation) if prep else None,
    )
