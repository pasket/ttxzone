from fastapi import APIRouter, Depends
from sqlmodel import Session, text

from app.core.config import settings
from app.core.db import get_session

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict:
    """Whether the API is up."""
    return {"status": "ok", "service": f"{settings.PROJECT_NAME}-backend"}


@router.get("/db")
def health_db(session: Session = Depends(get_session)) -> dict:
    """Whether the API reaches its database."""
    session.exec(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
