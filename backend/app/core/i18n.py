import json
from functools import cache
from pathlib import Path

from fastapi import Header

from app.core.config import settings

_LOCALES = Path(__file__).resolve().parent.parent / "locales"


def get_locale(accept_language: str | None = Header(None)) -> str:
    if not accept_language:
        return settings.DEFAULT_LOCALE

    preferred = accept_language.split(",")[0].split("-")[0].strip().lower()
    if preferred in settings.SUPPORTED_LOCALES:
        return preferred

    return settings.DEFAULT_LOCALE


@cache
def _error_catalog(locale: str) -> dict[str, str]:
    """English is the source: a message is written in English where it is
    raised, and `locales/<lang>.json`'s `errors` maps that text to the
    language's (tests/test_error_catalog.py keeps it complete)."""
    path = _LOCALES / f"{locale}.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))["errors"]


def translate_error(message: str, params: dict | None, locale: str) -> str:
    """An error message in `locale`, its `{placeholders}` filled from
    `params`; text the catalog doesn't know goes out as it came."""
    text = _error_catalog(locale).get(message, message)
    return text.format(**params) if params else text
