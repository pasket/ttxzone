"""Grant or revoke instance administrator -- the deployment's operator,
who sets its tenancy rules and creates organizations from Platform. An
instance administrator can also grant and revoke it from the web
(Platform), unless INSTANCE_ADMIN_WEB_GRANTS=false leaves it to this
console; this script works either way, as the way back when nobody can
sign in. Run it where the backend runs.

    docker compose exec backend python -m scripts.instance_admin grant ops@acme.com
    docker compose exec backend python -m scripts.instance_admin revoke ops@acme.com
    docker compose exec backend python -m scripts.instance_admin list

The account must exist already (any registration path) and must enroll
TOTP before Platform opens for it.

Also suspends or reactivates any account, as Platform -> Accounts does --
for when no instance administrator can sign in:

    docker compose exec backend python -m scripts.instance_admin suspend someone@acme.com
    docker compose exec backend python -m scripts.instance_admin unsuspend someone@acme.com

Every change goes into Platform's activity log as made from the console.
Revoking never leaves the deployment without an active administrator:
grant another one first."""

import argparse
import sys

from sqlmodel import Session, select

from app.core.db import engine
from app.core.exceptions import AppException
from app.models import User
from app.services import platform_audit_service
from app.services.account_suspension_service import reactivate_account, suspend_account
from app.services.instance_admin_service import grant_instance_admin, revoke_instance_admin


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("action", choices=("grant", "revoke", "list", "suspend", "unsuspend"))
    parser.add_argument("email", nargs="?")
    args = parser.parse_args()

    with Session(engine) as session:
        if args.action == "list":
            for user in session.exec(
                select(User).where(User.is_instance_admin.is_(True), User.is_active.is_(True))
            ):
                print(f"{user.email} (suspended)" if user.suspended_at else user.email)
            return
        if not args.email:
            sys.exit("An email is required.")
        user = session.exec(select(User).where(User.email == args.email.lower())).first()
        if user is None or not user.is_active:
            sys.exit(f"No active account for {args.email}.")
        if args.action in ("suspend", "unsuspend"):
            was_suspended = user.suspended_at is not None
            try:
                if args.action == "suspend":
                    suspend_account(session, user, None)
                else:
                    reactivate_account(session, user, None)
            except AppException as exc:
                sys.exit(exc.message)
            # Recorded only when the state changed.
            if was_suspended != (user.suspended_at is not None):
                platform_audit_service.record(
                    session,
                    None,
                    "account.suspend" if args.action == "suspend" else "account.reactivate",
                    "account",
                    user.id,
                    user.email,
                )
            outcome = "suspended" if user.suspended_at else "active"
            print(f"{user.email}: {outcome}.")
            return
        try:
            if args.action == "grant":
                grant_instance_admin(session, user, None)
            else:
                revoke_instance_admin(session, user, None)
        except AppException as exc:
            sys.exit(exc.message)
        outcome = "granted" if user.is_instance_admin else "revoked"
        print(f"{user.email}: instance administrator {outcome}.")


if __name__ == "__main__":
    main()
