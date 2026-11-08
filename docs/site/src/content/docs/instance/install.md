---
title: Install on one server
description: Run TTX-Zone on a single Docker host with TLS.
sidebar:
  order: 3
---

The `deploy/` folder is a complete deployment for one Docker host: the [internal model](/instance/deployment-models/), and the Players' public face on the same host with a profile. You need Docker with Compose, a hostname and a TLS certificate for it. For the public face on a separate host, see [Deployment models](/instance/deployment-models/#model-2-exercise-with-external-players) after this page.

Get the folder from the [latest release](https://github.com/pasket/ttxzone/releases), or clone the repository:

```bash
git clone https://github.com/pasket/ttxzone.git
cd ttxzone/deploy
```

## Install

1. Copy `deploy/` to the server, or use a clone of the repository.
2. Create the configuration:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`:
   - `TTX_VERSION`: the release to run, without the `v` (`0.1.0`).
   - `TTX_SERVER_NAME`: the hostname people use, the one the certificate is for.
   - `POSTGRES_PASSWORD`, `SECRET_KEY` and `DATA_ENCRYPTION_KEY`: replace each placeholder with a value of your own. The API refuses to start with the placeholders. These print one of each:

     ```bash
     echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
     echo "SECRET_KEY=$(openssl rand -hex 32)"
     echo "DATA_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr '+/' '-_')"
     ```

   Keep a copy of `DATA_ENCRYPTION_KEY` apart from your backups. [Configuration](/instance/configuration/) explains every setting.

3. Put the certificate for `TTX_SERVER_NAME` in `certs/` as `fullchain.pem` and `privkey.pem`. The proxy runs as uid 101 and must be able to read both. Pick the line for where Docker runs, not both:
   - **A Linux server**: keep the key private to that user.

     ```bash
     sudo chown 101:101 certs/privkey.pem && sudo chmod 600 certs/privkey.pem
     chmod 644 certs/fullchain.pem
     ```

   - **Docker Desktop on macOS or Windows**, to try it on your own machine: keep the files owned by you. Ownership doesn't carry into the container, so the Linux `chown 101` leaves the key unreadable there:

     ```bash
     chmod 644 certs/*.pem
     ```

   [Certificates](/instance/reverse-proxy/#certificates) explains how to get one from your organization's CA or from Let's Encrypt, and how to renew it. After a renewal:

   ```bash
   docker compose exec proxy nginx -s reload
   ```

   To try it without one, a self-signed certificate for `localhost` (set `TTX_SERVER_NAME=localhost`; the browser will warn about it). The last line makes both readable by the proxy on any platform; on a Linux server, prefer the commands above, which keep the key private:

   ```bash
   mkdir -p certs
   openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" \
     -addext "subjectAltName=DNS:localhost" \
     -keyout certs/privkey.pem -out certs/fullchain.pem
   chmod 644 certs/*.pem
   ```

4. Start it:

   ```bash
   docker compose pull
   docker compose up -d
   ```

The network's subnet, `172.30.0.0/24`, is fixed in the Compose file so each API trusts only its proxy's address. Change it there if it clashes with a local network.

## If it doesn't start

`docker compose ps -a` shows each service. The two usual causes:

- **`migrate` exited with code 1**, so the API and the worker never start (`service "migrate" didn't complete successfully`). Read why with `docker compose logs migrate`: most often `.env` still holds a placeholder, or a value is missing. Fix `.env` and run `docker compose up -d` again.
- **`proxy` keeps restarting.** `docker compose logs proxy`: the certificate is missing from `certs/`, or uid 101 can't read it. The proxy checks both files before it starts and, when it can't read them, says what to run for each platform. On Docker Desktop it's usually a key given to uid 101 by the Linux step: `sudo chown $(whoami) certs/*.pem && chmod 644 certs/*.pem`, then `docker compose up -d`.
- **`migrate` fails with `password authentication failed for user "ttx_admin"`.** PostgreSQL reads `POSTGRES_PASSWORD` only when its volume is first created, and keeps that password afterwards: `.env` now holds another one (regenerated secrets, a new copy of `.env` over an existing volume). Put the original password back, or, on an installation with no data to keep, start over with `docker compose down -v`; if `docker volume ls` still lists `<project>_postgres_data` afterwards, remove it with `docker volume rm`.

Logs are read by service from the `deploy/` folder (`docker compose logs api`, `migrate`, `proxy`…), not by the project's name.

## Create the first administrator

Access to the server is the root of trust: the first administrator can only be granted from its console.

1. Open the application and register an account with **Create my account**. It lands in the Waiting Room, which is expected.
2. On the server:

   ```bash
   docker compose exec api python -m scripts.instance_admin grant <email>
   ```

3. Sign in again and enroll an authenticator app, which is mandatory for an instance administrator.
4. Open the avatar menu, then **Instance administration**. Create the first organization, with its name and the email of an existing account, which becomes its Exercise Program Manager and an Exercise Planner. Or [change the tenancy rule](/instance/tenancy/) first.

Later administrators can be granted from **Accounts**, unless `INSTANCE_ADMIN_WEB_GRANTS=false`.

With `TENANCY_MODE=single` there is no console step: whoever installs it signs up with **Set up my organization**.

## If nobody can sign in

When the last administrator is gone or suspended, the console recovers access:

```bash
docker compose exec api python -m scripts.instance_admin list
docker compose exec api python -m scripts.instance_admin grant <email>
docker compose exec api python -m scripts.instance_admin unsuspend <email>
```

## What has to persist

| What | Where | Lose it and |
|---|---|---|
| Database | Volume `postgres_data`, or a managed PostgreSQL 16 | You lose everything |
| Uploaded files | Volume `uploads`, at `/app/uploads` | Images, inject files and evidence go missing |
| Configuration and keys | `.env`, or `*_FILE` secrets | Stored secrets become unreadable |

The log files, under `/app/logs`, are optional. [Backup and restore](/instance/backup-and-restore/) covers what to copy.

## Images

| Image | What it runs |
|---|---|
| `ghcr.io/pasket/ttxzone-backend` | The API, the public face, the worker and the migrations, chosen by `APP_ROLE` ([Scaling](/instance/scaling/#process-roles)). Runs as uid 10001 and writes only to `/app/logs` and `/app/uploads` |
| `ghcr.io/pasket/ttxzone-frontend` | The web application, as static files served by Nginx as a non-root user |

**When they're built.** Only when a release is tagged: the release workflow runs the whole test suite and the browser tests on the tagged commit, then publishes both images to the GitHub Container Registry, for `linux/amd64` and `linux/arm64` (x86 servers and ARM ones such as AWS Graviton or Apple silicon; Docker pulls the right one), with a software bill of materials and build provenance, and creates the [GitHub release](https://github.com/pasket/ttxzone/releases). Commits between releases publish nothing.

**Tags.** Each release is published under its version (`0.1.0`), its minor line (`0.1`, which follows its patch releases) and `latest`. Pin the exact version in `TTX_VERSION`: `latest` moves, and the two images of one instance must be the same version.

**Pulling.** `docker compose pull` fetches the version in `TTX_VERSION`; `docker pull ghcr.io/pasket/ttxzone-backend:0.1.0` fetches one by hand. On a server without access to GitHub, pull on a machine that has it, then `docker save` and `docker load`, or mirror them to your own registry and change `image:` in the Compose file.

**Building from source** instead, from a clone, such as a modified version or a commit between releases:

```bash
cd deploy
docker compose build
```

Or each image by hand:

```bash
docker build --target prod -t ttxzone-backend backend
docker build --target prod \
  --build-arg VITE_COMMIT_SHA=$(git rev-parse HEAD) \
  --build-arg VITE_COMMIT_DATE=$(git log -1 --format=%cI) \
  -t ttxzone-frontend frontend
```

The build arguments fill in the commit shown in **About**. A modified build also sets `--build-arg VITE_SOURCE_URL=…`, so **About** links to its own source, as the licence asks.
