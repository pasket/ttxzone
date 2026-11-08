# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`ttx-zone` (Cybersecurity Tabletop Zone) is a web app for organizing, executing, and managing Cybersecurity Tabletop Exercises (TTX), aimed at cybersecurity teams and incident response managers. Stack: TypeScript/React/TailwindCSS frontend, Python/FastAPI/PostgreSQL backend, API-first, Dockerized, dark/light theme (dark prioritized for the execution "command center" dashboard), fully i18n-ready from inception.

All code, comments, and commit messages must be written in technical English, regardless of the language used in conversation.

## Commands

### Docker (full stack)
```bash
cp .env.example .env        # first time only; then set SECRET_KEY and DATA_ENCRYPTION_KEY (a Fernet key)
docker compose up --build   # backend :8000, frontend :5173, postgres :5432
```
Each Dockerfile has a `dev` target (what Compose builds: source bind-mounted, `--reload`, Vite dev server) and a `prod` target, the default (non-root backend without reload; static frontend on Nginx `:8080`) — `docs/deployment.md`. The backend container runs `alembic upgrade head` before starting uvicorn (`backend/start.sh`, both targets' `CMD`; skipped with `RUN_MIGRATIONS=false`), so every environment built from that image migrates itself on start — a failed migration keeps the API down rather than serving an older schema. Only a pure-Python run outside Docker (`uvicorn app.main:app`) needs a manual `alembic upgrade head`; the Dockerfile `CMD` change itself only applies after `docker compose up -d --build backend`.

### Backend (`backend/`)
```bash
docker compose exec backend alembic revision --autogenerate -m "message"  # after model changes
docker compose exec -T -e POSTGRES_DB=ttx_zone_test backend pytest tests/test_health.py::test_health_ok -q  # single test
docker compose exec backend python -m scripts.seed_demo [--reset|--codes|--extras]  # demo org + exercise ready to conduct (--extras: also polls, rooms and an instance administrator)
```

### Frontend (`frontend/`)
```bash
npm install
npx vitest run tests/App.test.tsx   # single test file (npm run test runs all)
npm run e2e                         # browser tests, on their own stack (docs/features/e2e-tests.md); npm run e2e:down stops it
```

CI (`.github/workflows/ci.yml`, GitHub Actions) runs on every push to `main`, on every PR, and on demand (`gh workflow run ci.yml`); a newer push cancels the run still in progress on the same branch. Five jobs: **backend** — `ruff check .`, `ruff format --check .`, the API description against `docs/site/schemas/openapi.json`, then against a real Postgres 16 service: `alembic upgrade head` on an empty database + `alembic check` (the only place migrations are exercised, since the test suite builds its schema with `SQLModel.create_all`; `alembic check` fails if a model changed without a migration), then `pytest` with coverage; **frontend** — `npm run lint`, `npm run format:check`, `npm run build` (includes `tsc -b`), `npm test` with coverage (both totals in the run's summary, to read: no threshold); **docs** — builds the documentation site with its link and page checks, kept as a run artifact (publishing is `.github/workflows/docs.yml`, on release tags of a public repository only); **security** — `pip-audit` (runtime and dev requirements), `bandit`, `npm audit --audit-level=high` (frontend and `docs/site/`), blocking (a new upstream advisory turns CI red: fix it, usually `npm audit fix` or a pin bump, don't mute the job); **images** — `docker build --target prod` for both apps, a blocking trivy scan (no fixable HIGH/CRITICAL), then each must start healthy as non-root, the frontend image must pass `npm run e2e:build` in a browser (`docs/features/e2e-tests.md`), and the Compose files in `deploy/` (and `deploy/public-host/`) must be valid (nothing pushed; publishing is `.github/workflows/images.yml`, on release tags only, after CI and the browser tests, then `latest` and the GitHub Release (`docs/deployment.md` §7; `gh workflow run images.yml` is a dry run that pushes nothing); those run only there and on demand, `gh workflow run e2e.yml`). Commits go straight to `main` and CI reports after the push (~15 minutes) — run the same checks locally before committing. For local backend tests inside the container always pass `-e POSTGRES_DB=ttx_zone_test` (`docker compose exec -T -e POSTGRES_DB=ttx_zone_test backend pytest -q`), or `conftest.py`'s `drop_all` wipes the dev DB.

## Architecture

### Monorepo layout
Two independently-Dockerized apps under one repo, connected only through the HTTP API — no shared code between `backend/` and `frontend/`:
```
backend/app/{api,core,middlewares,models,schemas,services}/
backend/logs/                 # runtime log files (app.log/access.log/auth.log), git-ignored, auto-created at startup
frontend/src/{assets,components,hooks,lib,locales}/
frontend/public/              # static assets served as-is (favicon bundle, site.webmanifest)
deploy/                       # production Compose file, reverse proxy template, its .env.example (no application code)
```
Keep new code inside these existing folders rather than inventing new top-level ones. Frontend features live under `frontend/src/components/<area>/` (`admin`, `creator`, `playground`, `aar`, `platform`, `account`, …), one folder per module or workspace.

### Roles and terminology (read this first)
Role names and exercise terminology (EEG, MSEL, SitMan, P/S/M/U, …) come from an external exercise doctrine the product deliberately **never names** — no mention of it in UI copy, glossary, PDFs, README, code comments, tests or migrations. Internal values and UI labels:

| Role | Internal value | UI (EN / ES) | Scope |
|---|---|---|---|
| Exercise Program Manager (EPM) | `program_manager` (`OrgRoleEnum.PROGRAM_MANAGER`) | Exercise Program Manager / Responsable del Programa de Ejercicios (a column of Admin → Users and roles, headed "Exercise Program Manager (EPM)", like the EPT column -- both acronyms are in the glossary and marked up there; role labels -- `roles.*`: ContextBar Role selector, role badges, pickers -- are the short "Program Manager" / "Responsable del Programa"; **descriptive copy uses the long names**, never EPT/EPM on their own). The organization's founder is also an Exercise Planner. Oversees the org's exercises (reads, may delete) but designs only from a seat on an exercise's team, with the Planner grant | organization |
| Exercise Planning Team (EPT) member | `planner` (`OrgRoleEnum`/`RoleEnum.PLANNER`) | Exercise Planner / Planificador (role label: Planner); the group is the **Exercise Planning Team (EPT)** (Users and roles column "Exercise Planning Team (EPT)"); an exercise's **planning and control team** (Equipo de planificación y control) is drawn from it. On an exercise a `PLANNER` row is a team member whose flags say what they do: `plans` (Planner, Creator module) | org + exercise |
| Controller | `controls` flag on a `PLANNER` row (`TTXContextRole.CONTROLLER`) | Controller / Controlador -- runs the exercise (delivers the MSEL injects, keeps the Players in scope) in the **Control** module (`/control`). The exercise's creator plans and controls it | exercise |
| Facilitator | `facilitates` flag (needs `controls`; `TTXContextRole.FACILITATOR`) | Facilitator / Facilitador -- moderates with the Players, keeps the focus on the objectives; acts on the Player landing, identified (`RoleBadge`) | exercise |
| Observer | `observer` (`OrgRoleEnum`/`RoleEnum.OBSERVER`), or `observes` on a `PLANNER` row | Observer / Observador -- org grant by a Program Manager, assigned per exercise by its team; acts on the Player landing, identified; no design. A team member can also be one (`observes`, from the same org grant) | org + exercise |
| Evaluator | `evaluator` (`OrgRoleEnum`/`RoleEnum.EVALUATOR`), or `evaluates` on a `PLANNER` row | Evaluator / Evaluador -- takes notes during the session and rates it with the EEG (Playground → Evaluation); distinct from the Observer, who only watches (one or the other per person and exercise); no design. A team member (Planner/Controller) can also be one (`evaluates`, from the same org grant), Lead Evaluator included | org + exercise |
| Player | `player` (`RoleEnum.PLAYER`) | Player / Jugador | exercise |

The **Admin** module (`/admin`) is the Program Manager's workspace. Someone on an exercise's planning and control team can't be its Player (one `TTXAccess` row per exercise), but can also be its Evaluator and/or Observer (flags on that row; in the Playground the Role selector picks which they act as, `AuthContext.executionRole`). Needs-analysis fields about participation are named for participants, not Players (`participating_areas`, `key_participants_availability`). In code and docs "Program Manager" is short for Exercise Program Manager.

## Invariants (apply to every task)
- **Every change targets the context selected in the `ContextBar`** — active organization, exercise and role. Requests carry it explicitly (`/organizations/{id}/...`, `/ttx/{id}/...`, `organization_id` in bodies); never add a route where the server infers the org or exercise. Detail: `docs/architecture/rbac-and-multi-org.md`.
- **Timestamps are timezone-aware UTC** (`datetime.now(UTC)`; never naive, never `utcnow()`). Detail: `backend/CLAUDE.md`.
- **Never name the external exercise doctrine** (UI, docs, code comments, tests, migrations). Descriptive copy spells out long role names (role labels are short: Program Manager, Planner); EPT/EPM only in the Users and roles column headers.
- **Container tests always run against the test DB**: `docker compose exec -T -e POSTGRES_DB=ttx_zone_test backend pytest -q` — otherwise `conftest.py`'s `drop_all` wipes the dev DB.
- **Passwords**: 8-char floor via `StrongPassword` (`app/core/password_policy.py`) and `lib/passwordPolicy.ts`; the instance's own rules (Platform → Sign-in security) via `security_policy_service.check_new_password`, and every password is stored through its `set_password` — never assign `hashed_password` directly.
- **Sessions and security**: issue sessions only through `core/security.start_session`; account-credential and Platform endpoints get `RequireRecentAuthentication`, organization and exercise work records an activity-log event instead (`docs/architecture/session-policy.md`); background polling sends `X-Background-Request: 1`. Detail: `docs/architecture/session-policy.md`.
- **New design (Planner-only) endpoint** → add it to `DESIGN_ENDPOINTS` in `backend/tests/test_ttx_evaluation.py` (also checked against a Controller who doesn't plan).
- **Every new endpoint** is classified in `backend/app/api/exposure.py` as `PUBLIC` (a Player needs it on the Internet-facing face) or `INTERNAL_ONLY` (everything else; the default answer) — `tests/test_exposure.py` fails otherwise.
- **CSP**: no inline `<script>`/`<style>` in the SPA; any new external origin goes in `vite.config.ts`'s `contentSecurityPolicy()`.
- **Downloads** go through `apiDownload`/`useApiDownload`, never a bare link.
- **Coded rows** (needs, objectives, phases, injects, actors, techniques…) render via `CodeRef`/`codeRefText`/`CodeRefList` (`pdf_common.code_ref` in PDFs), never as a bare code or `.join(', ')`.
- **i18n**: every string in both `en.json` and `es.json` together; Spanish uses *tú*.
- **User guide**: a change users can see updates its page under `docs/site/src/content/docs/guide/` in the same commit. A changed route regenerates `docs/site/schemas/openapi.json` (`docker compose exec -T backend python -m scripts.export_openapi > docs/site/schemas/openapi.json`).
- **Commits go straight to `main`** and CI only reports after the push — run the CI checks locally first.

## Where the detail lives
Nested `CLAUDE.md` files load automatically when working in their directory. Files under `docs/` are read on demand — open the one for the area you're touching (they are plain references, never `@`-imported, so they cost nothing until read). `docs/` holds documentation only, plus the tooling of its site in `docs/site/`; the "keep new code inside existing folders" rule above is about code.

| Task touches | Read |
|---|---|
| Anything in `backend/` | `backend/CLAUDE.md` (auto) |
| Anything in `frontend/` | `frontend/CLAUDE.md` (auto) |
| An endpoint's path, guard or purpose | `docs/architecture/api-endpoints.md` |
| Roles, guards, `TTXAccess`/`OrganizationMembership`, active org/exercise | `docs/architecture/rbac-and-multi-org.md` |
| Sessions, timeouts, step-up, TOTP hardening | `docs/architecture/session-policy.md` |
| Log files, authentication events, activity-log retention, logrotate | `docs/architecture/logging.md` |
| Backup and restore (what to copy, `pg_dump`/`pg_restore`, left to the infrastructure owner) | `docs/architecture/backup-and-restore.md` |
| Deploying on a server (`deploy/`, `deploy/public-host/` for the public face in a DMZ, publishing images and releases, volumes, first instance admin, reverse proxy/TLS, upload limits, process roles `APP_ROLE` and the worker, the public face for Players, Player capacity and the load test) | `docs/deployment.md` |
| Turning on the repository's security settings and the documentation site (GitHub Pages) when it goes public | `docs/repository-settings.md` |
| Outgoing email (SMTP, Platform → Email, outbox, templates, `DATA_ENCRYPTION_KEY`) | `docs/architecture/email.md` |
| Single sign-on (OIDC, Entra ID, Platform → Single sign-on, linked accounts, provider MFA, `PUBLIC_BASE_URL`) | `docs/architecture/sso.md` |
| Invitation tokens, access requests, Enrollments | `docs/features/invitations-and-enrollment.md` |
| Admin → Organization / Users and roles / Allowed Domains, dashboards | `docs/features/admin.md` |
| Preferences, logout | `docs/features/preferences.md` |
| Creator → Exercise, exercise team matrix, Lead Planner | `docs/features/creator-exercise.md` |
| Rooms (several teams at once, main room, inject targeting, moving Players) | `docs/features/rooms.md` |
| Creator → Needs analysis, glossary, needs PDF | `docs/features/needs-analysis.md` |
| Creator → MSEL, injects, storyline map, MSEL PDFs | `docs/features/msel.md` |
| Creator → Session plan, definitive EEGs, session documents | `docs/features/conduct-prep.md` |
| Playground / Control center (live session) | `docs/features/playground.md` |
| After-action report and improvement plan | `docs/features/after-action.md` |
| Library (simulated actors, threat actors, injects, tags, scenarios) | `docs/features/library.md` |
| Library → Scenarios, `.ttx.md` import/export, scenario format versions | `docs/features/scenarios.md` |
| Tenancy rules (open / single / managed), instance administrator, Platform, account suspension | `docs/features/instance-tenancy.md` |
| Terms of service and privacy policy (Platform drafts and publishes, signup checkbox, acceptance screen) | `docs/features/legal-documents.md` |
| MITRE ATT&CK data, releases, conversion | `docs/architecture/attack.md` |
| Writing or extending the TTX-Zone inject catalog | `docs/features/inject-catalog-authoring.md` |
| Knowledge base for the AI assistant (`.kb.md` format, authoring and anonymization rules) | `docs/features/knowledge-base.md` |
| AI assistant (Platform switch, personal access tokens, the MCP endpoint, its tools and search, proposals, the after-action report) | `docs/features/ai-assistant.md` |
| Browser tests (Playwright, their stack, when they run) | `docs/features/e2e-tests.md` |
| The documentation site (`docs/site/`: where documentation lives, format, publishing, what the first release needs) | `docs/documentation-strategy.md` |
| What's planned / not built yet | `docs/roadmap.md` |
