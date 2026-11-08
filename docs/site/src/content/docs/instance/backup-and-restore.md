---
title: Backup and restore
description: What to copy, how to restore it and how to test it.
sidebar:
  order: 10
---

TTX-Zone doesn't schedule its own backups. Taking them, keeping them off the server and testing them is your job. The commands below are for the `deploy/` Compose file: run them from its folder and adapt the rest to your environment.

## What to back up

| What | Where | Why |
|---|---|---|
| The database | Service `postgres` | Everything: organizations, accounts, exercises, sessions, the activity log, settings made from the web |
| Uploaded files | Volume `uploads`, at `/app/uploads` | Avatars, logos, images, inject files and evidence. The database only stores their names |
| The keys | `.env`, or the `*_FILE` secrets | `DATA_ENCRYPTION_KEY` decrypts the secrets stored in the database |

The log files aren't needed: the activity log is in the database.

Keep the keys **apart from the backups**. The database copy holds the encrypted secrets, and the key alone decrypts them.

Uploaded files may hold classified exercise material, including real logs or captures. Treat the copies like the live server.

## Take a backup

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups

# 1. The database, in pg_dump's compressed custom format.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/ttx-zone-db-$STAMP.dump"

# 2. The uploaded files, after the dump.
docker compose exec -T api tar -C /app -czf - uploads \
  > "backups/ttx-zone-uploads-$STAMP.tar.gz"

# 3. Check that the dump is readable. This restores nothing.
docker compose exec -T postgres pg_restore --list < "backups/ttx-zone-db-$STAMP.dump" > /dev/null \
  && echo "dump OK"
```

The application keeps running: `pg_dump` reads a consistent snapshot. Copying the files after the dump means the copy can hold a few files no row points to, which is harmless, and never rows pointing to missing files.

## Keep copies elsewhere

A copy on the same disk doesn't survive losing that disk. Put the commands in a script and schedule it:

```cron
0 3 * * *  cd /opt/ttx-zone && ./backup.sh >> /var/log/ttx-zone-backup.log 2>&1
```

- **Encrypt before uploading**, with `age -r <public key>` or `gpg --encrypt`, and keep the private key off the server.
- **Ship it** with the tool you already use, such as `aws s3 cp`, `rclone`, `restic` or `borg`.
- **Make copies immutable** where the storage allows it, and give the backup's credentials write access only, so a compromised server can't delete them.
- **Let the storage expire** old copies with a lifecycle rule.
- **Alert on failure.** Use `set -euo pipefail` and let your monitoring report a missing night.

## Restore

:::danger
Restoring replaces the current database and uploaded files completely. Anything written since the backup is lost, and this can't be undone. Take a backup of the current state first if there's any doubt.
:::

1. Put the same `DATA_ENCRYPTION_KEY` in `.env` that the server had when the backup was taken, and preferably the same `SECRET_KEY`.
2. Decrypt the copies if needed, and place them in `backups/`.
3. Stop what writes. Add `api-public` if you run the public face.

   ```bash
   docker compose stop api worker
   ```

4. Recreate the database empty and load the dump:

   ```bash
   docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error' \
     < backups/ttx-zone-db-<STAMP>.dump
   ```

5. Replace the uploaded files:

   ```bash
   docker compose run --rm --no-deps -T api \
     sh -c 'find /app/uploads -mindepth 1 -delete && tar -C /app -xzf -' \
     < backups/ttx-zone-uploads-<STAMP>.tar.gz
   ```

6. Start everything. Migrations bring an older dump up to the current schema.

   ```bash
   docker compose up -d
   ```

7. Check: sign in, open an exercise with images, and download an evidence file.

A dump from a **newer** version than the one you start fails, because the migration tool doesn't know its revision. Restore with the same or a newer TTX-Zone version.

On a new server the steps are the same: `docker compose up -d postgres` first, then steps 3 to 7. PostgreSQL must be the same major version or newer.

## Without the key

A backup restored without its `DATA_ENCRYPTION_KEY` loses what was encrypted, and each part is recoverable on its own:

- Accounts with a second factor need it reset from **Accounts**, then enroll again.
- The SIEM webhook needs a new secret and its header again.
- The SMTP password and the single sign-on secret have to be entered again.

## Test your backups

A backup that has never been restored is a guess. Every month or so, restore the latest copy into a scratch database and check it:

```bash
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" ttx_zone_restore_check'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d ttx_zone_restore_check --no-owner --no-privileges --exit-on-error' \
  < backups/ttx-zone-db-<STAMP>.dump
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d ttx_zone_restore_check -c "SELECT count(*) FROM \"user\";"'
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" ttx_zone_restore_check'
```
