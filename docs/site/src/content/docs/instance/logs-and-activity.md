---
title: Logs and activity
description: Where TTX-Zone keeps its records and how to forward them.
sidebar:
  order: 11
---

Three places keep a record, each with its own job.

| Where | Holds | Kept |
|---|---|---|
| Activity log | What administrators and the console do, and every account's authentication events | 90 days, fixed |
| SIEM | Every activity log event, as it happens | Your SIEM's retention |
| Log files | `app.log`, `access.log` and `auth.log` | Capped by size |

## Activity log

**Instance administration → Activity log** shows it, and it can be downloaded. Events older than 90 days are deleted, except any still waiting to reach the SIEM.

Authentication events are named `auth.*`: `auth.login`, `auth.login_failed`, `auth.login_locked`, `auth.mfa_failed`, `auth.step_up`, `auth.logout`, `auth.register`, `auth.password_change`, `auth.totp_enable` and others. Each is also a line in `auth.log`.

## Forwarding to a SIEM

Set a webhook in **Activity log**, and every event is sent to it in order. It's signed with a secret you can rotate from the same place. If your SIEM is down, events wait: none is dropped by the 90-day retention while it's queued.

## Log files

The files are in `/app/logs`, one volume per process in `deploy/`:

```bash
docker compose exec api tail -f /app/logs/auth.log
```

They're capped by default, so a deployment nobody tuned never fills its disk.

| Setting | Default | Effect |
|---|---|---|
| `LOG_FILE_MAX_MB` | `10` | Each file rotates at this size. `0` means the application doesn't rotate |
| `LOG_FILE_BACKUPS` | `5` | Older copies kept |

Each log takes at most `LOG_FILE_MAX_MB × (LOG_FILE_BACKUPS + 1)`: 60 MB with the defaults, 180 MB for the three. The limit is by size, not by age, because a wave of failed sign-ins can write gigabytes in hours. The cost is that the days `auth.log` covers depend on traffic.

### With logrotate

Only one process may rotate a file. With `WEB_CONCURRENCY` above 1, or several processes sharing a logs folder, set `LOG_FILE_MAX_MB=0`, mount `/app/logs` from a host folder and rotate there:

```
/srv/ttx-zone/logs/*.log {
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0640
}
```

The application reopens the file on its own: no `copytruncate` and no restart. With `LOG_FILE_MAX_MB=0` and no rule, the files grow without bound.
