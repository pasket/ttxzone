"""Print the API's OpenAPI description, for the documentation site.

    docker compose exec -T backend python -m scripts.export_openapi > docs/site/schemas/openapi.json

The site's API reference is built from that file. CI compares this output with
it, so a route that changes without regenerating the file fails there. It only
reads the routes: no database, and the same output in every environment.

On top of what FastAPI generates it adds what readers need: titles in words,
the groups' names, and how each operation authenticates, read from its
dependencies.
"""

import copy
import json
import re
from collections.abc import Iterator
from typing import Any

from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.api.v1.api import api_router
from app.core.config import settings
from app.main import app

INTRODUCTION = """\
The HTTP API behind TTX-Zone's web application. Every path is under `/api/v1`.

It may change between versions while TTX-Zone is 0.x: there is no compatibility promise yet.

## Authentication

The API uses the web application's session: `POST /auth/login` sets a session cookie and a
CSRF cookie. Requests that change something must repeat the CSRF cookie's value in the
`X-CSRF-Token` header. Sessions expire, and sensitive operations need a recent authentication
(`POST /auth/step-up`), answering 403 `REAUTHENTICATION_REQUIRED` otherwise.

The AI assistant's `/mcp` endpoint is the exception: it takes a personal access token as a
bearer token.

## Context

Requests name their organization or exercise in the path or the body. The server never infers
them.
"""

TAGS = {
    "auth": ("Account and sign-in", "Sessions, second factors, tokens and the caller's account."),
    "organizations": ("Organizations", "Organizations, their members and allowed domains."),
    "ttx": ("Exercises", "Exercises, their planning team and how Players join."),
    "ttx-people": ("Exercise team", "Who is on an exercise's team and what each person does."),
    "ttx-players": ("Players", "An exercise's Players and their requests to leave."),
    "ttx-evaluation": ("Evaluation", "Evaluators, Observers and the exercise's EEG."),
    "ttx-needs-form": ("Needs analysis", "The needs analysis, its approvals and its catalogs."),
    "ttx-msel": ("MSEL", "The Master Scenario Events List, its injects and files."),
    "ttx-conduct-prep": ("Session plan", "The evaluation plan and the session's preparation."),
    "ttx-rooms": ("Rooms", "Playing an exercise in several rooms at once."),
    "ttx-run": ("Live session", "Conducting a session: Control, the Playground and exports."),
    "after-action": ("After-action report", "The report and its improvement plan."),
    "scenario-library": ("Scenarios", "Whole exercises packaged for reuse."),
    "inject-library": ("Inject library", "Reusable injects."),
    "actor-library": ("Simulated actors", "Reusable simulated actors."),
    "threat-actor-library": ("Threat actors", "Reusable threat actors."),
    "tag-library": ("Tags", "Tags of an organization and an exercise."),
    "invitation-tokens": ("Invitation tokens", "Tokens that let Players join an exercise."),
    "email-invitations": ("Email invitations", "Personal invitations to join by email."),
    "role-invitations": (
        "Role invitations",
        "Organization roles offered to people outside it, and their answers.",
    ),
    "access-requests": ("Access requests", "Requests to join an exercise."),
    "assistant": ("AI assistant", "The MCP endpoint and the assistant's proposals."),
    "instance": ("Instance administration", "The operator's workspace above the organizations."),
    "legal": ("Legal documents", "Terms of service and privacy policy."),
    "health": ("Health", "Health checks."),
}

# Function names that don't read as a title, whatever is done to them.
TITLES = {
    ("GET", "/auth/me"): "Current account",
    ("POST", "/organizations"): "Sign up with an organization",
    ("POST", "/organizations/mine"): "Found an organization",
    ("GET", "/attack"): "ATT&CK releases",
    ("POST", "/auth/oidc/step-up"): "Step up with single sign-on",
    ("POST", "/mcp"): "MCP request",
}

WORDS = {
    "ttx": "exercise",
    "org": "organization",
    "aar": "report",
    "db": "database",
    "msel": "MSEL",
    "eeg": "EEG",
    "endex": "ENDEX",
    "totp": "TOTP",
    "mfa": "MFA",
    "oidc": "OIDC",
    "mcp": "MCP",
    "pdf": "PDF",
    "csv": "CSV",
    "md": "Markdown",
}

# The routes one function serves for several roles, named after their path.
ROLE_ROUTES = re.compile(r"/(planners|observers|evaluators)(/|$)")

API_PREFIX = "/api/v1"
COOKIE = {"sessionCookie": []}
SESSION_WITH_CSRF = {"sessionCookie": [], "csrfToken": []}


def _routes(router: Any, prefix: str = "") -> Iterator[tuple[str, APIRoute]]:
    for route in router.routes:
        if isinstance(route, APIRoute):
            yield prefix + route.path, route
        elif sub := getattr(route, "router", None) or getattr(route, "original_router", None):
            yield from _routes(sub, prefix + getattr(route, "prefix", ""))


def _dependencies(dependant: Dependant) -> Iterator[str]:
    for dependency in dependant.dependencies:
        yield getattr(dependency.call, "__name__", "")
        yield from _dependencies(dependency)


def _title(method: str, path: str, generated: str) -> str:
    if title := TITLES.get((method, path)):
        return title
    words = generated.removesuffix(" Endpoint").removesuffix(" By Id").split()
    words = [WORDS.get(word.lower(), word.lower()) for word in words]
    if match := ROLE_ROUTES.search(path):
        role = match.group(1).removesuffix("s")
        words = [role if word in ("member", "assignee") else word for word in words]
        words = [role + "s" if word in ("members", "assignees") else word for word in words]
    title = " ".join(words)
    return title[0].upper() + title[1:]


def _security(path: str, route: APIRoute) -> list[dict[str, list[str]]]:
    dependencies = set(_dependencies(route.dependant))
    if path.startswith("/mcp"):
        return [{"accessToken": []}]
    if "verify_csrf" in dependencies:
        return [SESSION_WITH_CSRF]
    if "get_current_user" in dependencies:
        return [COOKIE]
    return []


def build() -> dict[str, Any]:
    description = copy.deepcopy(app.openapi())  # FastAPI keeps and reuses its own
    description["info"]["title"] = "TTX-Zone API"
    description["info"]["description"] = INTRODUCTION
    description["tags"] = [
        {"name": title, "description": summary} for title, summary in TAGS.values()
    ]
    description["components"]["securitySchemes"] = {
        "sessionCookie": {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.ACCESS_TOKEN_COOKIE_NAME,
            "description": "The session cookie `POST /auth/login` sets.",
        },
        "csrfToken": {
            "type": "apiKey",
            "in": "header",
            "name": settings.CSRF_HEADER_NAME,
            "description": "The value of the CSRF cookie, on requests that change something.",
        },
        "accessToken": {
            "type": "http",
            "scheme": "bearer",
            "description": "A personal access token, for the AI assistant's `/mcp` endpoint.",
        },
    }
    security = {
        (method, path): _security(path, route)
        for path, route in _routes(api_router)
        for method in route.methods
    }
    for path, operations in description["paths"].items():
        short = path.removeprefix(API_PREFIX)
        for method, operation in operations.items():
            operation["summary"] = _title(method.upper(), short, operation["summary"])
            operation["tags"] = [TAGS[tag][0] for tag in operation["tags"]]
            operation["security"] = security[(method.upper(), short)]
    return description


def main() -> None:
    print(json.dumps(build(), indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
