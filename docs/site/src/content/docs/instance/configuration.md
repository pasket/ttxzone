---
title: Configuration
description: The settings to review before the first start, and the limits to keep in step.
sidebar:
  order: 4
---

Configuration comes from the environment. Start from `.env.example`, keep the file readable only by you, and restart the affected services after a change.

## Before the first start

| Setting | What it does |
|---|---|
| `SECRET_KEY` | Signs sessions. At least 32 random characters. Changing it signs everyone out |
| `DATA_ENCRYPTION_KEY` | A Fernet key that decrypts every secret the application stores. [Losing it](#the-encryption-key) makes them unreadable |
| `POSTGRES_PASSWORD` | The database password. Any character is fine |
| `ENVIRONMENT` | `production` by default: session cookies need HTTPS. `development` only on a workstation |
| `BACKEND_CORS_ORIGINS` | The public origin only, such as `https://ttx.example.org` |
| `PUBLIC_BASE_URL` | The public address. Single sign-on and the links in emails need it |
| `FORWARDED_ALLOW_IPS` | The reverse proxy's address or network. See [Reverse proxy](/instance/reverse-proxy/#the-clients-address) |

Outside `development`, the API refuses to start with a `SECRET_KEY` shorter than 32 characters, or with `.env.example`'s placeholder for it or for `POSTGRES_PASSWORD`.

`deploy/docker-compose.yml` sets `ENVIRONMENT`, `BACKEND_CORS_ORIGINS`, `PUBLIC_BASE_URL`, `FORWARDED_ALLOW_IPS` and `RUN_MIGRATIONS` from `.env`.

To generate the two keys:

```bash
openssl rand -hex 32
openssl rand -base64 32 | tr '+/' '-_'
```

## Secrets from files

Each secret can come from a file, such as a Docker or Kubernetes secret: `SECRET_KEY_FILE`, `POSTGRES_PASSWORD_FILE`, `DATA_ENCRYPTION_KEY_FILE`, `SMTP_PASSWORD_FILE` and `OIDC_CLIENT_SECRET_FILE`. A value set directly wins over its file.

## Settings pinned by the environment

Several settings can be made from the web or fixed in the environment. Once fixed, the web shows them read-only.

| Setting | Variables | Web section |
|---|---|---|
| [Tenancy rule](/instance/tenancy/) | `TENANCY_MODE`, `TENANCY_MAX_ORGANIZATIONS` | Tenancy rule |
| [Email](/instance/email/) | `EMAIL_TRANSPORT` and `SMTP_*` | Email |
| [Single sign-on](/instance/single-sign-on/) | `OIDC_PROVIDER` and `OIDC_*` | Single sign-on |
| [AI assistant](/instance/ai-assistant/) | `ASSISTANT_ENABLED` | AI assistant |

`INSTANCE_ADMIN_WEB_GRANTS=false` keeps administrator grants on the console only.

## The encryption key

`DATA_ENCRYPTION_KEY` protects authenticator secrets, the SMTP password, the single sign-on client secret, the SIEM webhook's secret and queued messages. Keep a copy somewhere other than your backups.

To rotate it:

1. Set the new key as `DATA_ENCRYPTION_KEY` and the old one as `DATA_ENCRYPTION_KEY_PREVIOUS`, then restart. Both keys decrypt, and new values use the new one.
2. Re-encrypt what's stored. The command reports any value neither key can read.

   ```bash
   docker compose exec api python -m scripts.reencrypt_secrets
   ```

3. Remove `DATA_ENCRYPTION_KEY_PREVIOUS` and restart.

## Limits to keep in step

| Setting | Default | Keep in step with |
|---|---|---|
| `MSEL_FILE_MAX_BYTES` | 50 MB per inject file | The proxy's body size and timeouts on the upload route |
| `MSEL_FILE_MAX_PER_MSEL` | 60 files per MSEL | `SCENARIO_MAX_BYTES`, since a scenario file carries an exercise's files |
| `SCENARIO_MAX_BYTES` | 200 MB per scenario file | The proxy on the scenario import routes |
| `LOGIN_FAILURES_PER_ADDRESS` | 100 failed sign-ins per address in 15 minutes | How many people share one public address |
| `LOG_FILE_MAX_MB` × `LOG_FILE_BACKUPS` | 10 MB × 5 per log file | Disk space under `/app/logs` |

## Inject files and antivirus

TTX-Zone stores inject files byte for byte and never opens them. They're only downloaded as attachments, and text files can be previewed as plain text.

An exercise file may legitimately hold samples or indicators that a scanner flags, so scanning is your choice, outside the application. You can run a scanner on the host over the uploads volume, an ICAP or WAF on the upload route, or rely on the Players' own endpoint protection. Prefer reporting to deleting: a quarantined file answers 404 on download.

Ask Exercise Planners to hand out defanged samples, and live samples only inside a password-protected archive.
