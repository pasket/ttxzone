"""Seed a demo organization with an exercise ready to conduct, for walking
the whole cycle by hand: session, feedback, after-action report and
improvement plan.

    docker compose exec backend python -m scripts.seed_demo           # seed
    docker compose exec backend python -m scripts.seed_demo --reset   # drop and seed again
    docker compose exec backend python -m scripts.seed_demo --codes   # current TOTP codes
    docker compose exec backend python -m scripts.seed_demo --reset --extras  # also polls and rooms

Everything goes through the API in-process (FastAPI's TestClient), so the
same validation and readiness rules as the UI apply; only the accounts and
the Players' seats are written straight to the database. It writes to the
database the backend is configured for (the dev one inside the container).

What it leaves:
- the organization "Demo TTX-Zone" (domain demo.example.com) and its people:
  a Program Manager (the founder, also an Exercise Planner), a Controller
  who created and plans the exercise, a Facilitator on its team, a Lead
  Evaluator, an Observer and three Players -- one password for all;
- the exercise, from TTX-Zone's ransomware scenario, with the needs
  analysis APPROVED, the MSEL READY and the session plan READY dated today:
  the Controller can press Start;
- with --extras, more exercises left the same way: one with polls, and
  four played in rooms, with player1 in the first room, player2 in the
  second and player3 without one (the browser tests use them, one each,
  docs/features/e2e-tests.md), and the "platform" account made an instance
  administrator, with no organization.

Every account but the Players' has TOTP enrolled (it's mandatory for them):
add each printed secret to an authenticator app, or ask this script for
the current codes with --codes. A second run keeps the secrets.

Development only: it reuses the test suite's payload builders, so it needs
the dev requirements (pytest, pyotp, pypdf)."""

import argparse
import os
import sys
import uuid
from datetime import UTC, date, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.core.security import hash_password
from app.main import app
from app.models import Organization, RoleEnum, TTXAccess, TTXRoom, User
from app.services import totp_service
from app.services.instance_admin_service import grant_instance_admin
from app.services.organization_service import delete_organization
from tests.test_ttx_conduct_prep import ALL_DOCUMENTS
from tests.test_ttx_conduct_prep import _payload as conduct_prep_payload
from tests.test_ttx_msel import _payload_from as msel_payload
from tests.test_ttx_needs_form import _payload_from as needs_form_payload

ORG_NAME = "Demo TTX-Zone"
DOMAIN = "demo.example.com"
PASSWORD = "DemoTTX-2026!"
EXERCISE_NAME = (
    "Double-extortion ransomware (demo)"
    if os.environ.get("SEED_DEMO_LOCALE") == "en"
    else "Ransomware con doble extorsión (demo)"
)
SCENARIO_ID = "ransomware"
SPONSOR = "Dirección General (demo)"
# key -> (scenario, name of its exercise). A session played can't be played
# again, so each browser test has its own.
EXTRA_EXERCISES = {
    "poisoned-package": ("poisoned-package", "Paquete envenenado, con votaciones (demo)"),
    "connected-plant": ("connected-plant", "Planta conectada, en salas (demo)"),
    "rooms-polls": ("connected-plant", "Planta conectada, votaciones en salas (demo)"),
    "rooms-seats": ("connected-plant", "Planta conectada, mover y sentar (demo)"),
    "rooms-evaluation": ("connected-plant", "Planta conectada, evaluar por salas (demo)"),
    "accessibility": ("poisoned-package", "Paquete envenenado, accesibilidad (demo)"),
    "after-action": ("ransomware", "Ransomware, informe con IA (demo)"),
    "assistant-msel": ("ransomware", "Ransomware, MSEL con IA (demo)"),
}
# Who sits in which room of an exercise played in rooms.
ROOM_SEATS = {"player1": "RM-01", "player2": "RM-02"}
# SEED_DEMO_LOCALE=en: the English catalog, for the documentation's screenshots.
LOCALE = os.environ.get("SEED_DEMO_LOCALE", "es")
APP_URL = "http://localhost:5173"

# key -> (local part, full name, role on the exercise, TOTP mandatory)
PEOPLE = {
    "manager": ("manager", "Paula Méndez", "Program Manager (no seat on the exercise)", True),
    "controller": ("controller", "Carlos Ortega", "Planner + Controller (created it)", True),
    "facilitator": ("facilitator", "Fátima Ruiz", "Controller + Facilitator", True),
    "evaluator": ("evaluator", "Elena Vidal", "Lead Evaluator", True),
    "observer": ("observer", "Óscar Navarro", "Observer", True),
    "player1": ("player1", "Julia Serrano", "Player", False),
    "player2": ("player2", "Javier Molina", "Player", False),
    "player3": ("player3", "Inés Castro", "Player", False),
    "platform": ("platform", "Pilar Soto", "Instance administrator (with --extras)", True),
}


def _email(key: str) -> str:
    return f"{PEOPLE[key][0]}@{DOMAIN}"


class Api:
    """One signed-in browser: a TestClient with its own cookies."""

    def __init__(self, email: str) -> None:
        self.client = TestClient(app, headers={"Accept-Language": LOCALE})
        signed_in = self.client.post(
            "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
        )
        _check(signed_in, f"sign in as {email}")

    def _csrf(self) -> dict:
        return {settings.CSRF_HEADER_NAME: self.client.cookies[settings.CSRF_COOKIE_NAME]}

    def get(self, path: str, **kwargs) -> dict:
        return _check(self.client.get(f"/api/v1{path}", **kwargs), f"GET {path}")

    def send(self, method: str, path: str, body: dict | None = None, **kwargs) -> dict | None:
        response = self.client.request(
            method, f"/api/v1{path}", json=body, headers=self._csrf(), **kwargs
        )
        return _check(response, f"{method} {path}")


def _check(response, what: str) -> dict | None:
    if response.status_code >= 400:
        sys.exit(f"Failed to {what}: {response.status_code} {response.text}")
    return response.json() if response.content else None


def _demo_org(session: Session) -> Organization | None:
    return session.exec(select(Organization).where(Organization.name == ORG_NAME)).first()


def _accounts(session: Session) -> dict[str, User]:
    """Create the demo accounts, or reset the password of existing ones.
    TOTP stays off until everyone is signed in: the password login can't
    answer a second factor."""
    users = {}
    for key, (_, name, _, _) in PEOPLE.items():
        email = _email(key)
        user = session.exec(select(User).where(User.email == email)).first()
        if user is None:
            user = User(email=email, full_name=name)
        user.hashed_password = hash_password(PASSWORD)
        user.totp_enabled = False
        user.is_active = True
        session.add(user)
        users[key] = user
    session.commit()
    for user in users.values():
        session.refresh(user)
    return users


def _enroll_totp(session: Session, users: dict[str, User]) -> None:
    # The sessions are already issued; the mandate only checks the flag.
    for key, user in users.items():
        if not PEOPLE[key][3]:
            continue
        totp_service.store_secret(user, totp_service.stored_secret(user) or pyotp.random_base32())
        user.totp_enabled = True
        user.totp_last_step = None
        session.add(user)
    session.commit()


def _needs_form(api: Api, ttx_id: str) -> None:
    """Add what a scenario leaves out (people, dates), then approve it."""
    today = date.today()
    form = api.get(f"/ttx/{ttx_id}/needs-form")
    payload = needs_form_payload(
        form,
        document_date=today.isoformat(),
        design_lead=PEOPLE["controller"][1],
        sponsor_name=SPONSOR,
        sponsor_role="Directora General",
        sponsor_motivation="Comprobar que el comité de crisis decide a tiempo ante un ransomware.",
        findings_closure_commitment=True,
        findings_owner="Responsable de Seguridad",
        aar_recipient="crisis_committee",
        date_window_start=today.isoformat(),
        date_window_end=(today + timedelta(days=14)).isoformat(),
        key_participants_availability="Comité confirmado para la fecha de la sesión.",
    )
    api.send("PUT", f"/ttx/{ttx_id}/needs-form", payload)
    api.send("POST", f"/ttx/{ttx_id}/needs-form/transitions", {"to": "ready_for_approval"})
    for kind, name in (("sponsor", SPONSOR), ("design_lead", PEOPLE["controller"][1])):
        api.send(
            "POST",
            f"/ttx/{ttx_id}/needs-form/approvals",
            {
                "approver_kind": kind,
                "approver_name": name,
                "approver_role": "",
                "approved_on": today.isoformat(),
            },
        )
    api.send("POST", f"/ttx/{ttx_id}/needs-form/transitions", {"to": "approved"})


def _msel(api: Api, ttx_id: str) -> None:
    msel = api.get(f"/ttx/{ttx_id}/msel")
    payload = msel_payload(msel)
    for inject in payload["injects"]:
        inject["review_status"] = "validated"
    api.send("PUT", f"/ttx/{ttx_id}/msel", payload)
    api.send("POST", f"/ttx/{ttx_id}/msel/transitions", {"to": "in_review"})
    api.send("POST", f"/ttx/{ttx_id}/msel/transitions", {"to": "ready"})


def _session_plan(api: Api, ttx_id: str, users: dict[str, User]) -> None:
    read = api.get(f"/ttx/{ttx_id}/conduct-prep")
    today = date.today()
    payload = conduct_prep_payload(
        read,
        evaluators=[
            {
                "user_id": str(users["evaluator"].id),
                "areas": [],
                "briefed": True,
                "objective_ids": [o["id"] for o in read["eeg"]],
            }
        ],
        data_collection_methods=["direct_observation", "decision_timeline", "communications_log"],
        log_keeper_id=str(users["controller"].id),
        briefing_date=today.isoformat(),
        briefing_checklist=[
            "objectives",
            "eeg",
            "msel",
            "non_intervention",
            "data_collection",
            "logistics",
        ],
        session_date=today.isoformat(),
        session_time="10:00:00",
        timezone="Europe/Madrid",
        modality="in_person",
        venue="Sede central, sala de crisis",
        fpm_date=today.isoformat(),
        fpm_done=True,
        dry_run_date=today.isoformat(),
        dry_run_done=True,
        invitation_sent_on=today.isoformat(),
        logistics_checklist=[
            "room_booked",
            "av_equipment",
            "connectivity_tested",
            "materials_printed",
            "real_vs_simulated",
            "attendance_list",
        ],
        attendees=[
            {"name": PEOPLE[key][1], "role": PEOPLE[key][2], "confirmed": True}
            for key in ("player1", "player2", "player3")
        ],
        documents_reviewed=ALL_DOCUMENTS,
    )
    api.send("PUT", f"/ttx/{ttx_id}/conduct-prep", payload)
    api.send("POST", f"/ttx/{ttx_id}/conduct-prep/transitions", {"to": "ready"})


def seed(reset: bool, extras: bool) -> None:
    # The founder's domain is a placeholder: no DNS check for it.
    settings.ORG_CREATION_DOMAIN_POLICY_ENABLED = False
    # The demo founds its organization itself, whatever the deployment's
    # tenancy rules.
    settings.TENANCY_MODE = "open"
    settings.TENANCY_MAX_ORGANIZATIONS = None
    with Session(engine) as session:
        existing = _demo_org(session)
        if existing is not None:
            if not reset:
                sys.exit(f'"{ORG_NAME}" already exists: run again with --reset to rebuild it.')
            manager = session.exec(select(User).where(User.email == _email("manager"))).first()
            delete_organization(session, existing.id, manager.id if manager else uuid.uuid4())
            session.commit()
        users = _accounts(session)
        apis = {key: Api(_email(key)) for key in ("manager", "controller")}
        _enroll_totp(session, users)
        if extras and not users["platform"].is_instance_admin:
            grant_instance_admin(session, users["platform"], None)

        manager = apis["manager"]
        org = manager.send("POST", "/organizations/mine", {"name": ORG_NAME})
        org_id = org["id"]
        for role, keys in (
            ("planners", ("controller", "facilitator")),
            ("evaluators", ("evaluator",)),
            ("observers", ("observer",)),
        ):
            for key in keys:
                manager.send("POST", f"/organizations/{org_id}/{role}", {"email": _email(key)})

        controller = apis["controller"]
        ttx = _exercise(session, controller, users, org_id, SCENARIO_ID, EXERCISE_NAME)
        exercises = {SCENARIO_ID: ttx["id"]}
        if extras:
            for key, (scenario, name) in EXTRA_EXERCISES.items():
                exercises[key] = _exercise(session, controller, users, org_id, scenario, name)["id"]
        _report(session, ttx["code"], exercises)


def _exercise(
    session: Session, controller: Api, users: dict[str, User], org_id: str, scenario: str, name: str
) -> dict:
    """An exercise from a TTX-Zone scenario, ready to start, with the demo's
    people on it."""
    ttx = controller.send("POST", "/ttx", {"name": name, "organization_id": org_id})
    ttx_id = ttx["id"]

    check = controller.send(
        "POST",
        f"/ttx/{ttx_id}/scenario/apply",
        {"source": "system", "id": scenario},
        params={"dry_run": "false"},
    )
    if not check["ok"]:
        sys.exit(f"The scenario didn't apply: {check['errors']}")
    # The scenario renames the exercise; keep it recognizable as the demo.
    controller.send("PATCH", f"/ttx/{ttx_id}", {"name": name})

    _needs_form(controller, ttx_id)
    _msel(controller, ttx_id)

    controller.send(
        "POST",
        f"/ttx/{ttx_id}/planning-team",
        {"email": _email("facilitator"), "plans": False, "controls": True, "facilitates": True},
    )
    controller.send("POST", f"/ttx/{ttx_id}/evaluators", {"email": _email("evaluator")})
    controller.send(
        "PUT", f"/ttx/{ttx_id}/evaluators/lead", {"user_id": str(users["evaluator"].id)}
    )
    controller.send("POST", f"/ttx/{ttx_id}/observers", {"email": _email("observer")})
    rooms = {
        room.code: room.id
        for room in session.exec(select(TTXRoom).where(TTXRoom.ttx_id == uuid.UUID(ttx_id)))
    }
    for key in ("player1", "player2", "player3"):
        session.add(
            TTXAccess(
                user_id=users[key].id,
                ttx_id=uuid.UUID(ttx_id),
                role=RoleEnum.PLAYER,
                room_id=rooms.get(ROOM_SEATS.get(key, "")),
            )
        )
    session.commit()

    _session_plan(controller, ttx_id, users)
    return ttx


def _report(session: Session, code: str, exercises: dict[str, str]) -> None:
    print(f"\nDemo ready: {ORG_NAME}, exercise {code} ({EXERCISE_NAME}).")
    print(f"Open {APP_URL} -- every account's password: {PASSWORD}\n")
    for key, (_, _, role, mandatory) in PEOPLE.items():
        user = session.exec(select(User).where(User.email == _email(key))).one()
        secret = (totp_service.stored_secret(user) if mandatory else None) or "-"
        print(f"  {_email(key):32} {role:42} TOTP {secret}")
    print()
    for key, ttx_id in exercises.items():
        print(f"  exercise {key:30} {ttx_id}")
    print(
        "\nAdd each secret to an authenticator app, or get the current codes with:"
        "\n  docker compose exec backend python -m scripts.seed_demo --codes"
    )


def codes() -> None:
    with Session(engine) as session:
        left = 30 - int(datetime.now(UTC).timestamp()) % 30
        print(f"Codes valid for {left} more seconds (each one works once):")
        for key, (_, _, role, mandatory) in PEOPLE.items():
            user = session.exec(select(User).where(User.email == _email(key))).first()
            secret = totp_service.stored_secret(user) if mandatory and user is not None else None
            if secret:
                print(f"  {_email(key):32} {pyotp.TOTP(secret).now()}  {role}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="drop the demo organization first")
    parser.add_argument("--codes", action="store_true", help="print the current TOTP codes")
    parser.add_argument(
        "--extras",
        action="store_true",
        help="add exercises with polls and rooms, and an instance administrator",
    )
    args = parser.parse_args()
    if args.codes:
        codes()
    else:
        seed(args.reset, args.extras)


if __name__ == "__main__":
    main()
