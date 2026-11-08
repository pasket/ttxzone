# Deployment guide

What an operator needs to put TTX-Zone on a server of their own: what has to persist, how the first instance administrator is created, how the reverse proxy must be set up, and the limits to keep in step. It complements the README's Quick Start, which is for trying the app on a workstation.

**Images.** Each Dockerfile has two targets. `dev` is what `docker-compose.yml` runs on a workstation (source bind-mounted, `uvicorn --reload`, the Vite dev server). `prod` — the default when no target is given — is what a server runs:

| Image | Built from | What it does |
|---|---|---|
| backend | `docker build --target prod -t ttxzone-backend backend` | runtime dependencies only; code owned by root, the process runs as `app` (uid 10001) and writes only to `/app/logs` and `/app/uploads`; migrates then serves on `:8000` with one uvicorn worker, no reload; `HEALTHCHECK` on `/api/v1/health`; takes the client address from the proxy's `X-Forwarded-For` (`FORWARDED_ALLOW_IPS`, §4) |
| frontend | `docker build --target prod --build-arg VITE_COMMIT_SHA=$(git rev-parse HEAD) --build-arg VITE_COMMIT_DATE=$(git log -1 --format=%cI) -t ttxzone-frontend frontend` | the static `npm run build` served by Nginx as a non-root user on `:8080` (`frontend/nginx.conf`): client-side routes fall back to `index.html` (never cached), hashed `/assets/` cached for a year, `frame-ancestors 'none'` and `X-Frame-Options` sent as headers; `/healthz` for the health check. The build args fill About's commit and date (there is no repository in the build context); a modified build adds `--build-arg VITE_SOURCE_URL=…` |

Each release is published to GHCR as `ghcr.io/pasket/ttxzone-backend` and `ghcr.io/pasket/ttxzone-frontend` (`.github/workflows/images.yml`), for `linux/amd64` and `linux/arm64`, under its version (`0.1.0`) and `latest`; commits on `main` publish nothing. Both packages are public: pulling needs no login. CI builds both on every run and checks that they start healthy as non-root.

## On one server

`deploy/` is a complete deployment for one Docker host: `docker-compose.yml` (Postgres, a one-shot `migrate`, `api`, `worker`, `frontend` and the reverse proxy, with TLS, the only service that publishes a port), `nginx/ttxzone.conf.template` and `.env.example`. Copy the folder to the server, or use a clone.

1. `cp .env.example .env`, then fill it in: the version, the hostname and the secrets, each placeholder replaced (the API refuses to start with them; section 2 explains them, and the installation page of the documentation site gives the commands that generate them). The Compose file sets `ENVIRONMENT=production`, `BACKEND_CORS_ORIGINS`, `PUBLIC_BASE_URL`, `FORWARDED_ALLOW_IPS` and `RUN_MIGRATIONS` from it.
2. Put the certificate in `certs/` as `fullchain.pem` and `privkey.pem`, readable by uid 101, the proxy's user: on Linux `chown 101:101` and mode `600` for the key; with Docker Desktop ownership doesn't carry into the container, so keep the files yours with mode `644` (a trial on a workstation only). The proxy checks both files before it starts (`deploy/nginx/05-certificates.sh`, run by the image's entrypoint) and says what to run when it can't read them. Getting and renewing it is the operator's (an internal CA, Let's Encrypt; the documentation site's Reverse proxy and TLS → Certificates has the commands, a renewal hook included); after a renewal, `docker compose exec proxy nginx -s reload`.
3. `docker compose pull` (or `docker compose build` from a clone), then `docker compose up -d`.
4. Create the first instance administrator (section 3).

If it doesn't start: `docker compose ps -a`, then `docker compose logs migrate` (a placeholder or a missing value in `.env`) or `docker compose logs proxy` (the certificate missing or unreadable).

`docker compose --profile public up -d` adds the Players' public face (section 9). The network's subnet, `172.30.0.0/24`, is fixed in the Compose file so each API trusts only its proxy's address: change it there if it clashes with a local network.

The sections below explain what that file does, for adapting it or deploying some other way.

## 1. What has to persist

Three things live outside the containers. Lose one and the deployment loses data or can't read what it kept.

| What | In the container | Today's Compose file | What a production deployment needs |
|---|---|---|---|
| **Database** | Postgres data directory, `/var/lib/postgresql/data` | named volume `postgres_data` | a named volume (or a managed Postgres 16) |
| **Uploaded files** | `/app/uploads` (avatars, organization logos, exercise and MSEL images, inject files, needs-analysis evidence) | inside the `./backend` bind mount | a volume of its own mounted at `/app/uploads`, so it survives an image upgrade and can be backed up apart from the code (the `prod` image creates the directory owned by its user, and a new named volume inherits that; a host directory must be writable by uid 10001) |
| **Configuration and keys** | environment (`.env`, or `*_FILE` secrets) | `.env` next to `docker-compose.yml` | a `.env` readable only by the operator, or Docker/Kubernetes secrets through the `*_FILE` variables |

Optional: the log files under `/app/logs` (a volume if you want them to outlive the container; the activity log itself is in the database).

`deploy/docker-compose.yml` declares these volumes. Only the reverse proxy publishes a port.

The upload directories are relative to the backend's working directory (`AVATAR_UPLOAD_DIR`, `ORG_LOGO_UPLOAD_DIR`, `TTX_IMAGE_UPLOAD_DIR`, `NEEDS_EVIDENCE_UPLOAD_DIR`, `MSEL_IMAGE_UPLOAD_DIR`, `MSEL_FILE_UPLOAD_DIR`, all under `uploads/` by default). Keep them under one mount point.

Backups — what to copy, `pg_dump` and the uploaded files, restoring and testing: `docs/architecture/backup-and-restore.md`. Keep `DATA_ENCRYPTION_KEY` apart from the backups.

## 2. Configuration before the first start

Start from `.env.example`. Required or strongly advised for a server:

- `SECRET_KEY` (or `SECRET_KEY_FILE`) — long and random. Changing it signs everyone out. Outside `ENVIRONMENT=development` the backend refuses to start with one under 32 characters or with `.env.example`'s placeholder, and with the example's `POSTGRES_PASSWORD` (`config.py`, `_no_example_secrets_on_a_server`).
- `DATA_ENCRYPTION_KEY` (or `DATA_ENCRYPTION_KEY_FILE`) — a Fernet key; it decrypts every secret the app stores (TOTP secrets, SMTP password, single sign-on client secret, SIEM webhook secret, queued messages). Losing it makes them unreadable. Rotation: `DATA_ENCRYPTION_KEY_PREVIOUS` (`docs/architecture/email.md`).
- `ENVIRONMENT` — `production` by default (`development` only on a workstation, set by `.env.example`, the dev Compose file and `conftest.py`): session cookies are sent with `Secure`, so the site must be served over HTTPS.
- `POSTGRES_PASSWORD` (or `POSTGRES_PASSWORD_FILE`, which the postgres image also reads) — not the example's. Any character is fine; the backend quotes it in the connection URL.
- `FORWARDED_ALLOW_IPS` — the reverse proxy's address or network (section 4).

Every secret can come from a file instead (a Docker or Kubernetes secret): `SECRET_KEY_FILE`, `POSTGRES_PASSWORD_FILE`, `DATA_ENCRYPTION_KEY_FILE`, `SMTP_PASSWORD_FILE`, `OIDC_CLIENT_SECRET_FILE`. A value set directly wins over its file.
- `BACKEND_CORS_ORIGINS` — the public origin only (`https://ttx.example.org`).
- `PUBLIC_BASE_URL` — the public address; needed for single sign-on's redirect URI and the links in emails.
- Tenancy rule (`TENANCY_MODE`, `TENANCY_MAX_ORGANIZATIONS`) if you want it pinned rather than set from Platform (`docs/features/instance-tenancy.md`).
- `INSTANCE_ADMIN_WEB_GRANTS=false` if administrator grants must only ever come from the console.
- Outgoing email (`SMTP_*`) if accounts should get confirmation, reset and invitation emails (`docs/architecture/email.md`).

The backend migrates the database on every start (`alembic upgrade head` in the image's `CMD`); a failed migration keeps the API down instead of serving an older schema.

## 3. The first instance administrator

Server access is the root of trust: the first administrator can only be granted from the server's console, by design.

1. Open the app and register an account with *Create my account*. It lands in the Waiting Room — expected.
2. On the server: `docker compose exec api python -m scripts.instance_admin grant <email>` (the service is `backend` in the development Compose file).
3. Sign in again and enroll TOTP (mandatory for an instance administrator).
4. Avatar menu → **Instance administration**: create the first organization (its name and the email of an existing account, which becomes its Program Manager and Planner), or change the tenancy rule first.

Further administrators are granted from Platform → Accounts (unless `INSTANCE_ADMIN_WEB_GRANTS=false`). When nobody can sign in any more — the last administrator deleted their account, or every one is suspended — the console recovers it: `instance_admin grant <email>`, `instance_admin unsuspend <email>`, `instance_admin list`.

With `TENANCY_MODE=single` there is no console step: whoever installs it signs up with *Set up my organization*.

## 4. Reverse proxy and TLS

Put a reverse proxy (Nginx, Caddy, a load balancer) in front, terminating TLS, and expose only it. It forwards `/api/` and `/media/` (uploaded avatars, logos and exercise images) to the backend and everything else to the frontend image.

What it must do:

- **HTTPS only**, with a redirect from HTTP and HSTS.
- **`frame-ancestors`**: the SPA's Content-Security-Policy is a build-time `<meta>`, and `frame-ancestors` can't be set that way. The frontend image and the API already send it as a header with `X-Frame-Options: DENY`; a proxy only has to add it if it serves some other build of the frontend.
- **No redirect of `/api/v1/ttx`**: the API redirects `/api/v1/ttx/` to `/api/v1/ttx`, so nothing may send it the other way. In Nginx a `location /api/v1/ttx/` with `proxy_pass` does exactly that unless `location = /api/v1/ttx` exists too: the exercise list then never loads.
- **Request size and timeouts in step with the upload limits** (next section). Nginx's `client_max_body_size` defaults to 1 MB: below that, an inject file upload or a scenario import fails before the backend sees it, with a generic error instead of the app's own message.
- **No buffering of the session stream**: the Playground's live updates come over Server-Sent Events (`/api/v1/ttx/*/run/stream`); turn off proxy buffering there and allow long reads.
- **The client's address**: the proxy sends `X-Forwarded-For` and `X-Forwarded-Proto`, and the backend trusts them only from the addresses in `FORWARDED_ALLOW_IPS` (default `127.0.0.1`, i.e. nobody in another container). Set it to the proxy's address or network (comma-separated, CIDR allowed); otherwise every session, sign-in event and access log line records the proxy's address, and everyone shares one count of failed sign-ins, so 100 failures in 15 minutes lock every sign-in. **Never `*`** while the proxy *appends* to `X-Forwarded-For` (`$proxy_add_x_forwarded_for`): uvicorn would then believe the first address in the header, which the client writes. `*` is safe only if the outermost proxy replaces the header (`proxy_set_header X-Forwarded-For $remote_addr;`) and nothing else can reach the backend.

`deploy/nginx/ttxzone.conf.template` does all of this with Nginx: adapt it for another layout, or follow it with another proxy.

## 5. Limits to keep in step

| Setting | Default | Keep in step with |
|---|---|---|
| `MSEL_FILE_MAX_BYTES` | 50 MB per inject file | the proxy's body size and timeouts on `/api/v1/ttx/*/msel/files`; the UI copy that states the limit (`creator.msel.files.hint`, `creator.msel.files.errors.tooLarge` in both locales) |
| `MSEL_FILE_MAX_PER_MSEL` | 60 files per MSEL | `SCENARIO_MAX_BYTES`: a scenario file carries an exercise's files |
| `SCENARIO_MAX_BYTES` | 200 MB per scenario file | the proxy on the scenario import routes |
| `LOGIN_FAILURES_PER_ADDRESS` | 100 failed sign-ins per address in 15 minutes | how many people share one public address; the proxy's `limit_req` on the sign-in routes (30 per second, burst 300) |
| `LOG_FILE_MAX_MB` × `LOG_FILE_BACKUPS` | 10 MB × 5 per log file | disk space under `/app/logs`; Docker's own json-file cap (`x-logging` in the Compose file) |

**Several API processes.** One API container per face is the tested setup (with the worker beside it, section 8). The Playground's live stream works across processes: each process with open streams checks the database for each exercise every `RUN_STREAM_TICK_SECONDS` (1 s), so a change made through any process reaches every stream within about a second. Several processes must not share log files that the app rotates: give each container its own `logs` volume, or set `LOG_FILE_MAX_MB=0` and rotate on the host (`docs/architecture/logging.md`).

## 6. Inject files and antivirus

TTX-Zone stores inject files byte for byte and never opens them; they're only ever downloaded as `application/octet-stream` attachments, and text files can be previewed as plain text decoded on the server. In a cyber exercise a file may legitimately hold malware samples or indicators that a scanner flags, so scanning is the operator's choice, outside the app: a scanner on the host over the uploads volume (prefer reporting to deleting: a quarantined file answers 404 on download), an ICAP/WAF on the upload route, or the players' own endpoint protection. Planners should hand out defanged samples, and live samples only inside a password-protected archive (`docs/features/msel.md` → Inject files).

## 7. Upgrading

Read `CHANGELOG.md`, set the new `TTX_VERSION` in `.env`, then `docker compose pull` and `docker compose up -d` (from a clone: `git pull`, `docker compose build`, `docker compose up -d`). The `migrate` service applies the migrations before the API and the worker start. Take a backup first (`docs/architecture/backup-and-restore.md`); a migration that fails leaves the API down and the database unchanged, so you can roll back to the previous image and restore nothing.

**Publishing a release** (maintainers): set the version in `frontend/package.json` and `backend/pyproject.toml`, give it its dated section in `CHANGELOG.md` (`## [0.2.0] - 2026-12-01`), commit to `main`, then push the tag (`git tag v0.2.0 && git push origin v0.2.0`). `.github/workflows/images.yml` then, in order:

1. checks in seconds that the tag is `vMAJOR.MINOR.PATCH[-suffix]`, points at a commit on `main`, and agrees with both version files and a dated `CHANGELOG.md` section — a mismatch stops it before anything long runs;
2. runs CI and the browser tests on the tagged commit;
3. pushes `ghcr.io/pasket/ttxzone-backend` and `ttxzone-frontend` as `0.2.0` and `0.2`, each with its SBOM and build provenance attached;
4. moves `latest` to both, only once both are up;
5. creates the GitHub Release, its notes taken from the version's `CHANGELOG.md` section.

The documentation site is published from the same tag (`.github/workflows/docs.yml`, public repository only). A tag with a suffix (`v0.2.0-rc1`) is a pre-release: only its own version tag, no `0.2` and no `latest`, a Release marked as pre-release, and an `Unreleased` changelog section is accepted. `gh workflow run images.yml` is a dry run of the same jobs on `main`: it builds both images and pushes nothing. A failed run can be re-run from the Actions tab once the cause is fixed on the same commit; anything that needs a new commit needs a new tag (delete the old one only if nothing was pushed under it).

While the repository is private its packages are private too: a server pulls them after `docker login ghcr.io` with a token that has `read:packages`. They don't become public with the repository (`docs/repository-settings.md`).

## 8. Process roles

One image runs as different processes, chosen by `APP_ROLE` (the image's `start.sh` reads it):

| `APP_ROLE` | Runs | Port | Health check |
|---|---|---|---|
| `all` (default) | the API **and** the background loops | 8000 | `GET /api/v1/health` |
| `api-internal` | the API only | 8000 | `GET /api/v1/health` |
| `worker` | the background loops only: outgoing email, the activity log's forwarding to the SIEM and every retention purge (`python -m app.worker`) | none | a heartbeat file the worker touches every 15 s (`python -m app.healthcheck`, the image's `HEALTHCHECK`) |
| `api-public` | the Players' face only (section 9): their routes, their view | 8000 | `GET /api/v1/health` |

`all` is what the development Compose file and a single-container deployment run. To separate them, run one `api-internal` and one `worker` from the same image:

- **Email stays immediate.** Queuing a message (a sign-in code, a reset link) sends a Postgres `NOTIFY` in the same transaction; the worker `LISTEN`s and sends at once, whichever process queued it. If that connection drops, the worker still polls every `EMAIL_POLL_SECONDS` and reconnects.
- **One forwarder.** Each forwarding round to the SIEM (and the retention purges) holds a Postgres advisory lock, so only one process forwards, in order, even with two workers. Each message in the outbox is claimed `SKIP LOCKED`, so none goes out twice.
- **Migrations once.** Every container migrates before starting unless `RUN_MIGRATIONS=false` (the worker never does). With several containers, run a one-shot `migrate` service and set `RUN_MIGRATIONS=false` on the rest.

`deploy/docker-compose.yml` runs them this way.

Run exactly one process with the loops: either a single `all`, or `api-internal` plus `worker`. Two `all` containers work (each message is still sent once, one forwarder at a time), but every one of them polls.

## 9. A public face for the Players

For an exercise whose Players connect from the Internet while design and control stay on the internal network, run the same image twice more: `api-internal` behind the internal proxy, `api-public` behind a proxy in a DMZ.

What the public face serves (`backend/app/api/exposure.py` lists every route as `PUBLIC` or `INTERNAL_ONLY`; a test fails on a route in neither):

- signing in and the account itself (password, second factor, single sign-on, email links, sessions, avatar, legal documents), the exercise list, joining (invitation links and tokens) and leaving;
- a Player's part of a live session: the view, the stream, notes, decisions, votes, REAL WORLD, the feedback form, the images and files delivered;
- `GET /instance/policy` (with `surface: "public"`) and the health routes.
- the `/media/` files: avatars, organization logos and exercise cover images, without a session, by an unguessable name (`uuid4`), as on the internal face. A cover picture isn't exercise content; MSEL images and inject files go through guarded endpoints.

Nothing else answers (404): no design, control, evaluation, Admin, Platform, library, AI assistant or `/openapi.json`/`/docs`. And what does answer gives a Player's view only:

- on an exercise, the caller must take part as a **Player**; `as=` other than `player` is refused (403 `NOT_ACTING_AS`), and the services never build a Controller's view there, whoever asks;
- `/ttx`, `/organizations/mine` and `/auth/me` answer as a Player (only the exercises one plays, no organization role, no Platform), so the app shows only the Playground;
- **a session belongs to the face it was opened on** (`UserSession.surface`): a cookie from the internal face doesn't work on the public one, nor the other way round. Different hostnames keep the cookies apart anyway.

How to lay it out. Two reference layouts, both validated in CI (`images` job):

- **Same host**: `docker compose --profile public up -d` in `deploy/` runs `api-public` and its proxy, with `TTX_PUBLIC_SERVER_NAME`, a certificate in `certs-public/` and `TTX_PUBLIC_HTTPS_BIND` for the address the Internet reaches. The public proxy sits alone on network `ttx-public` (172.30.1.0/24) with `api-public` and the frontend, so it can't reach `api` or Postgres; `api-public` is on both networks.
- **DMZ host**: `deploy/public-host/docker-compose.yml` runs `proxy-public`, `api-public` and the frontend on a host of its own (network 172.30.2.0/24), reusing `deploy/nginx/`. Inside, `deploy/public-host/internal-host.yml` is layered on the main file: it publishes Postgres on `TTX_DB_BIND` with TLS (`ssl=on`, `public-host/db-certs/`, key owned by uid 70) and mounts the shared uploads at `TTX_UPLOADS_PATH`. `api-public` insists on TLS through libpq's own variables (`PGSSLMODE`, default `verify-full`; `PGSSLROOTCERT` from `public-host/db-ca/root.crt`): psycopg reads them, no setting in `config.py`. Both hosts need the same `SECRET_KEY` and `DATA_ENCRYPTION_KEY` (sessions, second factors).

The ports and every connection, inward and outward: the site's `instance/network-and-ports.mdx`. What each layout needs:

- **Networks**: the public proxy and `api-public` in a DMZ; the internal proxy, `api-internal`, the worker, Postgres and `migrate` on the internal network. `api-public` needs Postgres: allow that one port from the DMZ in the firewall, nothing else inward.
- **Uploads**: `api-public` serves the images and files delivered to the Players, so it mounts the same `uploads` volume (read and write: avatars are uploaded through it).
- **Proxies**: each as in section 4, its own hostname and certificate; `FORWARDED_ALLOW_IPS` on each API set to its own proxy. The public one forwards `/api/` and `/media/` to `api-public` and the rest to the frontend image.
- **Links in emails** point to `PUBLIC_BASE_URL` as the worker sees it. Set it to the public address if invitations go to Players outside; staff then follow reset links there too, and sign in on the internal face afterwards.
- **Single sign-on** builds its redirect address from `PUBLIC_BASE_URL` too: register each face's callback (`<address>/api/v1/auth/oidc/callback`) with the provider and set `PUBLIC_BASE_URL` per API container.
- **Size the public face from section 10.**

## 10. How many Players: load test

Measured with `backend/scripts/load_test/` (`seed_players` adds Players to the demo exercise of a throwaway database; `players` drives them). Each simulated Player behaves like the app: signs in, opens the Playground's stream, fetches its view (`GET /run?since=`) after every ring, and once every 30 s anyway. Meanwhile the demo's Controller, on the internal face, releases a mandatory inject every 15–20 s. The public face ran in a container limited to the vCPUs shown. Postgres 16 shared the machine (Apple silicon, 11 cores) unconstrained, and so did the load generator itself, so a real server will do somewhat better. Treat the figures as orders of magnitude.

Three rounds, the same day and setup: as first measured, after making the Player's view cheaper, and after trimming each request's fixed queries (a Player's fetch went from ~22 database statements to 7).

| Public face (`api-public`) | Players | `GET /run` p95: first → view → queries | A released inject reaches every Player, p95: first → view → queries | Errors (last round) |
|---|---|---|---|---|
| 2 vCPU, 1 worker | 100 | 1.2 s → 0.7 s → – | 2.0 s → 1.6 s → – | none |
| 2 vCPU, 1 worker | 300 | 8.4 s → 2.4 s → 1.7 s | 7.9 s → 3.4 s → 2.6 s | none |
| 4 vCPU, `WEB_CONCURRENCY=4` | 300 | 3.3 s → 1.6 s → – | 3.5 s → 2.1 s → – | none |
| 4 vCPU, `WEB_CONCURRENCY=4` | 1000 | 41 s → 6–7 s → 4.3 s | 39 s → 7–8 s → 5.5 s | 3–5 dropped connections (the Players reconnect) |

**What that means today:**
- Up to about **300 Players**: one process on 2 vCPU; an inject reaches the table in about 2.6 s (1.6 s with 100).
- **1000 Players**: 4 vCPU with `WEB_CONCURRENCY=4`; an inject reaches everyone in about 5.5 s. The CPU isn't saturated, and more requests at once didn't help: what's left is each request's own work (resolving it, building and serialising the answer) times a thousand fetches per change. Beyond about 1000 Players at once, the option on the roadmap (§3) is to send the shared view inside the ring itself, without the fetch after it.

**How the Player's view is kept cheap** (it grew with the square of the table before):
- the part every Player of a room shares is built once per change per process (`player_view`, cached `RUN_VIEW_CACHE_SECONDS`, 2 s), then each gets what is theirs added: their decisions, their vote, their room;
- a Player's view names at most 30 Players present; how many there are of each role comes as `presence_counts` ("and N more" on screen); who is present is read once a second per process (`RUN_PRESENCE_CACHE_SECONDS`), and a fetch updates someone's presence at most every 5 s;
- someone coming or going rings the team, not the Players: their presence panel catches up with the next change of the session or the page's fetch every 30 s. Before, every arrival rang everyone, and presence flapping under load made 70 % of the fetches useless;
- a request reads what it needs about its caller once (their grant on the exercise, their memberships: `core/security.ttx_access_of`, kept for the request and forgotten as soon as it writes), and the deployment-wide rules every request checks -- the password and second-factor policy, which legal documents must be accepted -- are kept `INSTANCE_CACHE_SECONDS` (5 s) per process: a change made in Platform applies at once in the process that saved it, within those seconds in the others. `tests/test_request_queries.py` holds a Player's fetch to its budget of statements.

**Settings that matter** (environment of the API containers):
- `WEB_CONCURRENCY`: uvicorn workers per container. Use one per vCPU; the background loops live in the worker container (section 8), so this is safe.
- `DB_POOL_SIZE` + `DB_MAX_OVERFLOW` (default 10 + 30) and `MAX_CONCURRENT_REQUESTS` (default 30). These apply per uvicorn worker, and requests beyond the limit wait without holding a thread or a connection. Keep the limit below the pool, and keep every process's pool together under Postgres's `max_connections` (100 by default). For example, 4 workers × (5 + 15) plus the internal face's 40 and the worker's few stay under 100, with `MAX_CONCURRENT_REQUESTS=15`.

The test found and fixed two faults that stopped a single process at about 15 open Playgrounds, in every deployment and not only on the public face:
1. Each open stream kept a database connection for its whole life.
2. With more requests in flight than pooled connections, requests waited for threads while threads waited for connections, until the pool timed out.

Repeat the test after changing the Playground (the commands are in `players`'s docstring): build `--target prod`, run the two faces against a database seeded with `scripts.seed_demo` and `scripts.load_test.seed_players`, then run `players` with the Controller's current code (`seed_demo --codes`). The seed and the load test need the development dependencies, so they run from the development image; the production image leaves them out.

