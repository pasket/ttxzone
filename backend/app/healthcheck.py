"""The image's health check, for any role (Dockerfile HEALTHCHECK):

    python -m app.healthcheck

An API process answers GET /api/v1/health on its port; the worker, which
has no port, keeps a recent heartbeat file (app.worker)."""

import sys
import urllib.request

from app.core.config import settings


def main() -> int:
    if settings.APP_ROLE == "worker":
        from app.worker import check

        return 0 if check() else 1
    url = f"http://127.0.0.1:8000{settings.API_V1_PREFIX}/health"
    try:
        with urllib.request.urlopen(url, timeout=4) as response:  # nosec B310 -- fixed local URL
            return 0 if response.status == 200 else 1
    except OSError:
        return 1


if __name__ == "__main__":
    sys.exit(main())
