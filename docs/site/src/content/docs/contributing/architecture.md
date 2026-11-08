---
title: Architecture
description: How the code is organized and the rules it follows.
sidebar:
  order: 3
---

TTX-Zone is two independently containerized applications in one repository, connected only through the HTTP API. They share no code.

```
backend/app/{api,core,middlewares,models,schemas,services,data}/
backend/alembic/  backend/tests/  backend/scripts/
frontend/src/{assets,components,hooks,lib,locales}/
frontend/tests/  frontend/e2e/
deploy/           production Compose file and reverse proxy
docs/             internal reference for maintainers
docs/site/        this documentation
```

## Stack

- **Backend:** Python, FastAPI, SQLModel, Alembic and PostgreSQL 16.
- **Frontend:** TypeScript, React and Tailwind CSS, built with Vite.

## Rules that apply everywhere

**Context is explicit.** Every change targets the selected organization, exercise and role. Requests carry them in the path or body, and no route infers them on the server.

**Timestamps are timezone-aware UTC.** Use `datetime.now(UTC)`.

**Sessions go through one path.** Sessions are issued only by `core/security.start_session`, and passwords are stored only through `set_password`. Changes to the account's own credentials and to Instance administration require a recent authentication; organization and exercise work is recorded in the activity log instead. Background polling sends `X-Background-Request: 1`, so an open tab never counts as activity.

**Every endpoint is classified** as `PUBLIC` or `INTERNAL_ONLY` in `backend/app/api/exposure.py`. Only what a Player needs on the Internet-facing side is public.

**Strict Content-Security-Policy.** There are no inline scripts or styles in the application. Any new external origin goes in `contentSecurityPolicy()` in `frontend/vite.config.ts`.

**Downloads** go through `apiDownload` or `useApiDownload`, never a bare link.

**Coded rows** render through `CodeRef`, `codeRefText` or `CodeRefList`, and `pdf_common.code_ref` in PDFs.

**Internationalized from the start.** Every string is in both `en.json` and `es.json`.

## Roles in the code

| Role | Internal value |
|---|---|
| Exercise Program Manager | `program_manager` |
| Exercise Planner | `planner`, with the `plans` flag on an exercise |
| Controller | `controls` flag |
| Facilitator | `facilitates` flag, which needs `controls` |
| Observer | `observer`, or the `observes` flag |
| Evaluator | `evaluator`, or the `evaluates` flag |
| Player | `player` |

The flags are on a team member's `TTXAccess` row. The organization's grants are `OrganizationMembership` rows.

## One image, several processes

The backend image runs as different processes, chosen by `APP_ROLE`. See [Scaling](/instance/scaling/).

## Live session

Controllers' actions are events in the database, so a reload or a late joiner sees the same state. Clients are told something changed over Server-Sent Events, and then fetch the view.
