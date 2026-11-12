from fastapi import APIRouter, Depends
from fastapi.routing import APIRoute

from app.api.exposure import PUBLIC
from app.api.v1.endpoints import (
    access_requests,
    actor_library,
    after_action,
    auth,
    auth_oidc,
    auth_tokens,
    email_invitations,
    health,
    inject_library,
    instance,
    instance_assistant,
    instance_email,
    instance_oidc,
    invitation_tokens,
    legal,
    mcp,
    organizations,
    role_invitations,
    scenario_library,
    threat_actor_library,
    ttx,
    ttx_assistant,
    ttx_conduct_prep,
    ttx_evaluation,
    ttx_msel,
    ttx_needs_form,
    ttx_people,
    ttx_players,
    ttx_rooms,
    ttx_run,
    ttx_tags,
)

# Every router of the API, in the order they're included.
ROUTERS: list[APIRouter] = [
    actor_library.router,
    inject_library.router,
    threat_actor_library.router,
    scenario_library.router,
    health.router,
    auth.router,
    auth_oidc.router,
    auth_tokens.router,
    organizations.router,
    role_invitations.router,
    role_invitations.me_router,
    instance.router,
    instance_email.router,
    instance_oidc.router,
    instance_assistant.router,
    legal.router,
    mcp.router,
    legal.accept_router,
    legal.admin_router,
    ttx.router,
    ttx_assistant.router,
    invitation_tokens.router,
    email_invitations.router,
    email_invitations.public_router,
    access_requests.router,
    ttx_tags.router,
    ttx_needs_form.router,
    ttx_evaluation.router,
    ttx_people.router,
    ttx_players.router,
    ttx_players.me_router,
    ttx_rooms.router,
    ttx_msel.router,
    ttx_conduct_prep.router,
    ttx_run.router,
    after_action.router,
]

api_router = APIRouter()
for _router in ROUTERS:
    api_router.include_router(_router)


def route_keys(route: APIRoute) -> list[tuple[str, str]]:
    """How app/api/exposure.py names a route: (method, path), per method."""
    return [(method, route.path) for method in sorted(route.methods)]


def build_public_router() -> APIRouter:
    """The API of the public face: only the routes app/api/exposure.py
    lists as PUBLIC, each behind public_surface_guard."""
    from app.core.security import public_surface_guard

    public = APIRouter()
    for router in ROUTERS:
        kept = APIRouter()
        kept.routes = [
            route
            for route in router.routes
            if isinstance(route, APIRoute) and all(k in PUBLIC for k in route_keys(route))
        ]
        if kept.routes:
            public.include_router(kept, dependencies=[Depends(public_surface_guard)])
    return public
