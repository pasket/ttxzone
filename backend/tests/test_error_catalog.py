"""Every error message the API can send has its translation.

The catalog (`app/locales/<lang>.json`, `errors`) is keyed by the English
message as written at the raise site, so this walks the source: each
`AppException(code, message)` and `ScenarioIssue(message=...)` (a scenario
check's issues), each helper that passes a `message` parameter on to one,
each `("CODE", "message")` pair in a table, each `HTTPException` detail and
each text handed to `translate_error`."""

import ast
import json
import re
import string
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.i18n import translate_error

APP = Path(__file__).resolve().parent.parent / "app"
LOCALES = APP / "locales"
_CODE = re.compile(r"^[A-Z][A-Z0-9_]+$")


def _trees() -> list[tuple[str, ast.Module]]:
    return [(path.name, ast.parse(path.read_text())) for path in sorted(APP.rglob("*.py"))]


def _callee(node: ast.Call) -> str | None:
    return node.func.id if isinstance(node.func, ast.Name) else None


def _message_arg(call: ast.Call, index: int | None, name: str) -> ast.expr | None:
    if index is not None and len(call.args) > index:
        return call.args[index]
    return next((k.value for k in call.keywords if k.arg == name), None)


# Where a message ends up: name -> (position, keyword) of its message.
_SINKS: dict[str, tuple[int | None, str]] = {
    "AppException": (1, "message"),
    "ScenarioIssue": (None, "message"),
}


def _helpers(trees: list[tuple[str, ast.Module]]) -> dict[str, tuple[int | None, str]]:
    """The sinks, plus every function that hands one of its parameters on
    to one of them (or to such a function) as the message."""
    found = dict(_SINKS)
    changed = True
    while changed:
        changed = False
        for _, tree in trees:
            for func in ast.walk(tree):
                if not isinstance(func, ast.FunctionDef) or func.name in found:
                    continue
                params = [a.arg for a in func.args.args]
                for call in ast.walk(func):
                    if isinstance(call, ast.Call) and _callee(call) in found:
                        message = _message_arg(call, *found[_callee(call)])
                        if isinstance(message, ast.Name) and message.id in params:
                            found[func.name] = (params.index(message.id), message.id)
                            changed = True
                            break
    return found


def _strings(node: ast.expr | None, where: str) -> list[tuple[str, str]]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [(node.value, where)]
    if isinstance(node, ast.IfExp):
        return _strings(node.body, where) + _strings(node.orelse, where)
    if isinstance(node, ast.JoinedStr):
        pytest.fail(f"{where}: an f-string message can't be translated; pass params instead")
    return []


def raised_messages() -> dict[str, str]:
    """English message -> one place it is raised."""
    trees = _trees()
    helpers = _helpers(trees)
    messages: dict[str, str] = {}
    for name, tree in trees:
        for node in ast.walk(tree):
            where = f"{name}:{getattr(node, 'lineno', '?')}"
            if isinstance(node, ast.Call) and _callee(node) in ("HTTPException", "translate_error"):
                text = (
                    _message_arg(node, 1, "detail")
                    if _callee(node) == "HTTPException"
                    else _message_arg(node, 0, "message")
                )
                for found, at in _strings(text, where):
                    messages.setdefault(found, at)
            elif isinstance(node, ast.Call) and _callee(node) in helpers:
                for text, at in _strings(_message_arg(node, *helpers[_callee(node)]), where):
                    messages.setdefault(text, at)
            elif (
                isinstance(node, ast.Tuple)
                and len(node.elts) == 2
                and isinstance(node.elts[0], ast.Constant)
                and isinstance(node.elts[0].value, str)
                and _CODE.match(node.elts[0].value)
                and isinstance(node.elts[1], ast.Constant)
                and " " in str(node.elts[1].value)
            ):
                for text, at in _strings(node.elts[1], where):
                    messages.setdefault(text, at)
    return messages


def _fields(template: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(template) if name}


def _catalog(locale: str) -> dict[str, str]:
    return json.loads((LOCALES / f"{locale}.json").read_text())["errors"]


TRANSLATED = [locale for locale in settings.SUPPORTED_LOCALES if locale != "en"]


@pytest.mark.parametrize("locale", TRANSLATED)
def test_every_error_message_is_translated(locale: str) -> None:
    catalog = _catalog(locale)
    missing = {text: at for text, at in raised_messages().items() if text not in catalog}
    assert not missing, f"untranslated in {locale}.json: {missing}"


@pytest.mark.parametrize("locale", TRANSLATED)
def test_the_catalog_holds_no_message_nobody_raises(locale: str) -> None:
    stale = set(_catalog(locale)) - set(raised_messages())
    assert not stale, f"stale in {locale}.json: {sorted(stale)}"


@pytest.mark.parametrize("locale", TRANSLATED)
def test_each_translation_keeps_the_placeholders(locale: str) -> None:
    wrong = {
        text: translated
        for text, translated in _catalog(locale).items()
        if _fields(text) != _fields(translated)
    }
    assert not wrong


def test_a_message_is_translated_with_its_values() -> None:
    template = "Image exceeds the maximum allowed size ({max_mb} MB)."
    assert translate_error(template, {"max_mb": 5}, "es") == (
        "La imagen supera el tamaño máximo permitido (5 MB)."
    )
    assert translate_error(template, {"max_mb": 5}, "en") == (
        "Image exceeds the maximum allowed size (5 MB)."
    )
    # Unknown text (a framework's own detail) goes out as it came.
    assert translate_error("Not Found", None, "es") == "Not Found"


def test_the_api_answers_errors_in_the_clients_language(client: TestClient) -> None:
    wrong = {"email": "nobody@acme.com", "password": "Wrongpass123!"}
    spanish = {"Accept-Language": "es"}

    english = client.post("/api/v1/auth/login", json=wrong).json()["error"]
    translated = client.post("/api/v1/auth/login", json=wrong, headers=spanish).json()["error"]
    invalid = client.post("/api/v1/auth/login", json={}, headers=spanish).json()["error"]

    assert english["message"] == "Invalid email or password."
    assert translated == {**english, "message": "Email o contraseña incorrectos."}
    assert invalid["message"] == "Los datos de la solicitud no son válidos."
