---
title: Scaling
description: Process roles, and how many Players an instance holds.
sidebar:
  order: 13
---

## Process roles

One image runs as different processes, chosen by `APP_ROLE`.

| `APP_ROLE` | Runs | Health check |
|---|---|---|
| `all` (default) | The API and the background work | `GET /api/v1/health` |
| `api-internal` | The API only | `GET /api/v1/health` |
| `worker` | Background work only: email, SIEM forwarding, retention | A heartbeat file, in the image's `HEALTHCHECK` |
| `api-public` | The Players' face only | `GET /api/v1/health` |

`deploy/` runs `api-internal` and `worker`. Run background work once: either a single `all`, or `api-internal` plus `worker`.

Every container migrates before starting unless `RUN_MIGRATIONS=false`. With several containers, run a one-shot `migrate` service and set that on the rest, as `deploy/` does.

## A public face for the Players

`api-public` serves only what a Player needs, for Players who connect from the Internet. When to use it and how to lay it out: [Deployment models](/instance/deployment-models/#model-2-exercise-with-external-players). Size it with the figures below.

## How many Players

Measured with the load test in `backend/scripts/load_test/`, on one development machine with the database and the load generator unconstrained. Treat the figures as orders of magnitude.

| Public face | Players | A released inject reaches everyone (p95) |
|---|---|---|
| 2 vCPU, 1 worker | 300 | About 2.6 s |
| 4 vCPU, `WEB_CONCURRENCY=4` | 1000 | About 5.5 s |

With 1000 Players, a few connections dropped and reconnected.

## Settings that matter

- `WEB_CONCURRENCY`: uvicorn workers per container, one per vCPU. Above 1, also [set `LOG_FILE_MAX_MB=0`](/instance/logs-and-activity/#with-logrotate).
- `DB_POOL_SIZE` and `DB_MAX_OVERFLOW`, default 10 and 30, and `MAX_CONCURRENT_REQUESTS`, default 30. They apply per uvicorn worker. Keep the limit below the pool, and every process's pool together under PostgreSQL's `max_connections`, 100 by default.

For example, 4 workers with 5 + 15 connections, `MAX_CONCURRENT_REQUESTS=15`, plus the internal face's 40 and the worker's few, stay under 100.
