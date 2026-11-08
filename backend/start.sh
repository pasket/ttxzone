#!/bin/sh
# The image's start command for every role (APP_ROLE, docs/deployment.md).
# Arguments are passed to uvicorn (the dev target adds --reload).
set -e

case "${APP_ROLE:-all}" in
  worker)
    # The background loops only: no port, no migrations (the API or a
    # one-shot migrate service runs them).
    exec python -m app.worker
    ;;
esac

# Apply pending migrations before serving, so no process runs against an
# older schema; a failed migration stops the container. A deployment with
# a one-shot `migrate` service sets RUN_MIGRATIONS=false here.
case "$(echo "${RUN_MIGRATIONS:-true}" | tr '[:upper:]' '[:lower:]')" in
  false|0|no|off) ;;
  *) alembic upgrade head ;;
esac

# exec hands PID 1 to uvicorn for signals.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
