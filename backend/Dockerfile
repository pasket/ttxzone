# Two targets from one file (docs/deployment.md):
#   dev  -- docker-compose.yml's backend: dev dependencies, source
#           bind-mounted, uvicorn --reload.
#   prod -- the image a server runs: runtime dependencies only, code owned by
#           root and read-only for the process, non-root user, no reload.
# prod is the last stage, so a build without --target gets it.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

EXPOSE 8000


FROM base AS dev

# curl backs docker-compose.yml's healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

COPY . .

# start.sh picks what runs from APP_ROLE (the API, or the worker) and
# migrates first unless RUN_MIGRATIONS=false. Alembic is idempotent at head,
# and a failed migration stops the container instead of starting the API on
# a half-migrated database.
CMD ["sh", "start.sh", "--reload"]


FROM base AS prod

ARG APP_UID=10001

# The base image is rebuilt upstream on its own schedule: take the Debian
# security fixes published since, at every build.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid "${APP_UID}" app \
    && useradd --system --uid "${APP_UID}" --gid app --no-create-home \
       --home-dir /nonexistent --shell /usr/sbin/nologin app

# The code stays root-owned: the process can read it, not change it. It only
# writes to logs/ and uploads/ (volumes in a deployment; a named volume
# mounted there inherits this ownership the first time).
COPY . .
# Development tools that need what requirements-dev.txt adds (the demo seed,
# the load test) stay out: they run from the dev image, never on a server.
RUN rm -rf scripts/seed_demo.py scripts/load_test \
    && mkdir -p logs uploads \
    && chown app:app logs uploads

USER app

# Behind a reverse proxy, uvicorn takes the client address from
# X-Forwarded-For / X-Forwarded-Proto only when the connection comes from
# one of these addresses: set it to the proxy's address (or its network,
# CIDR). The default trusts no other host. Never "*" while the proxy appends
# to X-Forwarded-For: uvicorn would then take a client-supplied address.
ENV FORWARDED_ALLOW_IPS=127.0.0.1

# Any role: the API's /api/v1/health, or the worker's heartbeat.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-m", "app.healthcheck"]

# Same start as dev, without --reload. One uvicorn worker per container;
# scale with more containers. With APP_ROLE=api-internal the background
# loops run in a worker container (APP_ROLE=worker) instead.
CMD ["sh", "-c", "exec sh start.sh --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\" --no-server-header"]
