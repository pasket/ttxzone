---
title: Development setup
description: Run TTX-Zone on your machine, and its checks.
sidebar:
  order: 2
---

## With Docker

```bash
cp .env.example .env   # then set SECRET_KEY and DATA_ENCRYPTION_KEY
docker compose up --build
```

The frontend is on `http://localhost:5173`, the API on `http://localhost:8000`, and PostgreSQL on port 5432. Source is mounted, so changes reload. The backend migrates the database when it starts.

To generate the encryption key:

```bash
openssl rand -base64 32 | tr '+/' '-_'
```

## Demo data

This creates a demo organization, with an exercise ready to conduct:

```bash
docker compose exec backend python -m scripts.seed_demo
```

`--reset` rebuilds it, `--codes` prints the current two-factor codes, and `--extras` adds polls, rooms and an instance administrator.

## Without Docker

You need Python 3.12, Node.js 22 and PostgreSQL 16.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

## Checks

These are what CI runs.

```bash
# backend/
ruff check . && ruff format --check .
alembic upgrade head && alembic check
pytest

# frontend/
npm run lint && npm run format:check && npm run build && npm test

# docs/site/
npm run build
```

:::danger
Inside Docker, always run the backend tests against the test database. Without this variable, the tests wipe your development database.

```bash
docker compose exec -T -e POSTGRES_DB=ttx_zone_test backend pytest -q
```
:::

Run one test at a time against that database: concurrent runs deadlock.

Browser tests run on their own stack:

```bash
cd frontend
npm run e2e
npm run e2e:down
```

## Database changes

After changing a model, generate a migration. CI fails if a model changed without one.

```bash
docker compose exec backend alembic revision --autogenerate -m "message"
```

## API changes

A changed route needs the API description regenerated, or CI fails:

```bash
docker compose exec -T backend python -m scripts.export_openapi > docs/site/schemas/openapi.json
```

Every operation needs a docstring, which becomes its description in the [API reference](/api/). A new route must also be classified as `PUBLIC` or `INTERNAL_ONLY` in `backend/app/api/exposure.py`.
