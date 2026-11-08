# Logging, the activity log and the SIEM

Three places keep a record of what happens, each with its own job:

| Where | Holds | Kept | Who reads it |
|---|---|---|---|
| **Activity log** (Platform → Activity log, `platform_audit_event`) | What instance administrators and the server's console do, and every account's authentication events | 90 days, fixed (`platform_audit_service.RETENTION_DAYS`), then deleted | Instance administrators, in the browser and as a download |
| **SIEM** (the activity log's webhook) | Every activity-log event, as it happens | The SIEM's own retention | The operator's security team |
| **Log files** (`backend/logs/`) | `app.log` (application), `access.log` (HTTP requests), `auth.log` (authentication and onboarding) | Capped by size: 10 MB × 6 files per log by default (`.env`), or the server's `logrotate` | The operator, on the server |

## Authentication events
`services/auth_event_service.auth_event` writes each one twice: a line in `auth.log` (`<action> user=<id> account=<email> details=<json>`) and an activity-log event (`target_kind` `account`), which `platform_audit_service.record` queues for the SIEM in the same commit while forwarding is on.

| Action | When | `details` |
|---|---|---|
| `auth.login` | A session is issued (`auth_service.record_login`) | `method`: `password` / `totp` / `sso` |
| `auth.backup_code_login` | Signed in with a backup code (TOTP enrollment reset) | |
| `auth.login_failed` | Wrong password, no such account, suspended, a password on an account without one, a failed single sign-on | `reason`: `password` / `unknown_account` / `suspended` / `no_password`; single sign-on adds `method: sso` and its reason (`docs/architecture/sso.md`) |
| `auth.login_locked` | Too many failed sign-ins lock an account, an address or the two together | `address`, `minutes` |
| `auth.signup_locked` | Too many signups with a taken email lock an address | `address`, `minutes` |
| `auth.mfa_failed` | Wrong second-factor code at sign-in | |
| `auth.mfa_locked` | Too many wrong codes lock the second factor | `minutes` |
| `auth.step_up` / `auth.step_up_failed` | Confirming it's you for a sensitive action | `factor`: `password` / `totp` / `sso` |
| `auth.logout` | Signed out | |
| `auth.register` | An account created and signed in (`auth_service.record_signup`) | `via`: `account` / `organization` / `invitation` / `sso` |
| `auth.password_change` | Own password changed (or a first one set) | `first: true` for a first password |
| `auth.sso_link` / `auth.sso_unlink` | Single sign-on linked to / unlinked from the account | `provider_email` (link) |
| `auth.totp_enable` / `auth.totp_disable` / `auth.backup_codes_regenerate` | Two-factor set up, turned off, new backup codes | |
| `auth.token_create` / `auth.token_revoke` | A personal access token for the AI assistant created / revoked in Preferences (`docs/features/ai-assistant.md`) | `token_id`; on create also `name`, `expires_in_days`, `disclaimer_version` -- never the token |

An attempt on an email with no account (or a deleted one, whose email is anonymized) has no `actor_user_id`; `actor_label` and `target_label` keep the email typed, so it never reads as the server's console. A new authentication path records its event through `auth_event`, never with a bare `auth_logger` line.

## Outgoing email
Platform → Email's changes and test messages are activity-log events (`email.settings_update` with before/after and `password_changed` — never the password, `email.settings_delete`, `email.test` with the recipient and outcome), so they reach the SIEM. The delivery loop writes to `app.log` (`app.services.email_service`): INFO per message sent, WARNING per retry or a message dropped by the per-address limit, ERROR when one is given up on — each naming the outbox id, the template and the recipient's **domain** only; never a body, parameter, credential or the SMTP conversation. Detail in `docs/architecture/email.md`.

## Single sign-on
Platform → Single sign-on's changes and tests are activity-log events (`sso.settings_update` before/after with `secret_changed` — never the secret, `sso.settings_delete`, `sso.test` with the outcome). Detail in `docs/architecture/sso.md`.

## AI assistant
Platform → AI assistant's switch is an activity-log event (`assistant.settings_update`, before/after), and so is a person deciding one of the assistant's proposals (`assistant.proposal_accepted`, `assistant.proposal_discarded`: who, the exercise, the kind of row and its code, never what was proposed -- the person validates it; a proposal superseded by a newer one isn't logged, nobody decided it); creating and revoking tokens are authentication events (table above). Each **tool call** on the MCP endpoint is not: with a client calling tools several times per question, it would flood the activity log and the SIEM. It goes instead to its own table, `assistant_call` (who, which token, which tool, the exercise and organization when there is one, the outcome -- `ok` or the error code -- and the duration; **never the arguments or the result**), and to a line in `app.log` (`assistant.call tool=… user=… token=… ttx=… outcome=… ms=…`). Instance administrators see the latest of them in Platform → AI assistant → Recent use. `assistant_call` rows are kept 90 days, pruned hourly by the same loop as the activity log, and they also count towards the per-token rate limit. Deleting an account deletes its tokens and call records. Detail in `docs/features/ai-assistant.md`.

## Retention of the activity log
`platform_audit_service.prune_expired` deletes the events older than the retention period, in batches of 5 000, **except any still queued for the SIEM** (`PlatformAuditDelivery`): forwarding gets every event. It runs from the activity log's background loop (`forward_forever`) once an hour, webhook or not. The period is fixed at 90 days (`RETENTION_DAYS`): no setting or endpoint changes it. Platform → Activity log → Retention only shows it, with the log files' cap below (`GET /instance/audit/retention` → `{days, log_file_max_mb, log_file_backups}`; read-only, nothing in the web changes either). `audit.retention` events (from when the period was editable) are no longer written. Retention bounds the log's age, not a burst (a password-spraying wave adds a row per attempt until it ages out).

## Rotating the log files
The files are capped **by default**, so a deployment nobody tuned never fills its disk. Two settings in `.env` (`core/config.py`, read at startup; change them and `docker compose up -d backend`):

| Setting | Default | Effect |
|---|---|---|
| `LOG_FILE_MAX_MB` | `10` | Each file (`app.log`, `access.log`, `auth.log`) rotates at this size. `0` = the app doesn't rotate (see *With logrotate* below). |
| `LOG_FILE_BACKUPS` | `5` | Older copies kept (`auth.log.1` … `.5`); at the next rotation the oldest is deleted. |

So each log takes at most `LOG_FILE_MAX_MB × (LOG_FILE_BACKUPS + 1)`: 60 MB with the defaults, 180 MB for the three. `core/logging_conf._build_handlers` uses a `RotatingFileHandler` for that.

**Size, not days, on purpose**: a cap by age doesn't bound the disk (a password-spraying wave or an error loop can write gigabytes in hours); a cap by size does. The cost: how many days `auth.log` covers depends on traffic — months at a normal pace, less during an attack, when the oldest lines go first. The reliable history is elsewhere: the SIEM gets every event and the activity log keeps 90 days. The files are the server's local copy.

**One process per file.** `RotatingFileHandler` is only safe while a single process writes each file: two processes would each rotate it, and lines would be lost. Today the backend runs one uvicorn process. A deployment with several workers or replicas sharing `backend/logs/` sets `LOG_FILE_MAX_MB=0` and rotates with logrotate.

### With logrotate (`LOG_FILE_MAX_MB=0`)
Each file is then a `WatchedFileHandler`, which reopens its file once something has moved it away; how long the files are kept is the operator's call, set in the rule (`rotate N` × the period). In the Compose deployment the files are on the host in `backend/logs/` (the `./backend` bind mount); a logrotate rule on the host, e.g. `/etc/logrotate.d/ttx-zone`:

```
/srv/ttx-zone/backend/logs/*.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0640
}
```

No `copytruncate` and no restart needed: logrotate renames the file and the app writes to a new one on its next line. With `LOG_FILE_MAX_MB=0` and no rule, the files grow without bound.

## Docker's copy (stdout)
Each line also goes to the container's stdout, so `docker compose logs` and a log driver see it. Docker's default `json-file` driver keeps that copy **without a limit**: `docker-compose.yml` caps every service through the `x-logging` anchor (`max-size: 10m`, `max-file: 3`, i.e. 30 MB per container). A deployment with its own log driver (journald, a collector) replaces the anchor.
