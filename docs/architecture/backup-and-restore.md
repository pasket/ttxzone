# Backup and restore

TTX-Zone doesn't schedule its own backups: taking them, keeping them off the server and testing them is the job of whoever runs the infrastructure. This page says what has to be copied and gives the commands to copy and restore it with the Docker Compose deployment in this repository. Adapt the paths and the scheduler (cron, a systemd timer, the platform's own backup tool) to your environment.

## What to back up

| What | Where (this Compose file) | Why |
|---|---|---|
| **The database** | Postgres, database `$POSTGRES_DB` (volume `postgres_data`) | Everything: organizations, accounts, exercises, MSELs, runs, the activity log, the settings made from Platform |
| **Uploaded files** | `backend/uploads/` on the host (`uploads/` under the backend's working directory, `/app/uploads` in the container) | Avatars, organization logos, exercise images, MSEL images and inject files, and needs-analysis evidence. The database only stores their names: a dump without them restores broken images and missing evidence |
| **The keys in `.env`** | `.env` (or the `*_FILE` secrets) | `DATA_ENCRYPTION_KEY` decrypts the secrets stored in the database (TOTP secrets, the SMTP password, the single sign-on client secret, the SIEM webhook's secret and header, queued messages). A restore with a different key leaves all of them unreadable. Losing `SECRET_KEY` only signs everyone out |

Keep the keys **apart from the backups**: the database copy holds the encrypted secrets, and the key alone decrypts them (`docs/architecture/email.md` → Encrypted secrets). Store the key somewhere else, such as a password manager or a secrets vault.

Not needed: `backend/logs/` (the activity log is in the database, and the log files are diagnostics), the test database `ttx_zone_test`, and `frontend_node_modules`.

Uploaded files under `needs-evidence/`, `msel-images/` and `msel-files/` are TLP-classified material (inject files may be real logs or captures). Treat the copies like the live server: encrypt them, restrict who can read them, and delete them when your retention ends.

## Taking a backup

Run from the repository's directory on the host. The dump comes from the `pg_dump` inside the Postgres container, so its version always matches the server's.

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups

# 1. The database, in pg_dump's custom format (compressed; restorable table by table).
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/ttx-zone-db-$STAMP.dump"

# 2. The uploaded files, after the dump.
tar -C backend -czf "backups/ttx-zone-uploads-$STAMP.tar.gz" uploads

# 3. A quick check that the dump is readable (lists its contents, restores nothing).
docker compose exec -T postgres pg_restore --list < "backups/ttx-zone-db-$STAMP.dump" > /dev/null \
  && echo "dump OK"
```

`pg_dump` reads a consistent snapshot while the application keeps running: there's no need to stop it. Copying the files **after** the dump means the copy has at most a few files that no row points to, which is harmless. It never has rows that point to missing files.

### Scheduling and shipping off the server

A copy that stays on the same disk doesn't survive losing that disk. Once the commands above are in a script (for example `/opt/ttx-zone/backup.sh`), a nightly cron entry on the host could look like this:

```cron
# m h dom mon dow  command
0 3 * * *  cd /opt/ttx-zone && ./backup.sh >> /var/log/ttx-zone-backup.log 2>&1
```

Recommendations for the script:

- **Encrypt before uploading.** Use `age -r <public key>` or `gpg --encrypt`, so the server only holds the public key and a stolen copy can't be read. Keep the private key off the server.
- **Ship to external storage** with the tool you already use: `aws s3 cp`, `rclone copy`, `az storage blob upload`, `restic`, `borg`. Then delete the local copy.
- **Make the copies immutable** where the storage allows it (S3 Object Lock, immutable Azure blobs), and give the backup's credentials write access only. A compromised server then can't delete its own backups.
- **Retention**: let the storage expire old copies (a lifecycle rule) rather than the script.
- **Alert on failure**: exit non-zero on any error (`set -euo pipefail`) and let your monitoring report a missing night.

## Restoring

> **Warning:** restoring replaces the current database and uploaded files completely. Anything written since the backup is lost, and this can't be undone. Take a backup of the current state first if there's any doubt.

1. Put the same `DATA_ENCRYPTION_KEY` (and preferably `SECRET_KEY`) in `.env` that the server used when the backup was taken.
2. Decrypt the copies if they were encrypted, and place them in `backups/`.
3. Stop the backend, so nothing writes while the database is replaced:

   ```bash
   docker compose stop backend
   ```

4. Recreate the database empty and load the dump:

   ```bash
   docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error' \
     < backups/ttx-zone-db-<STAMP>.dump
   ```

   `--no-owner --no-privileges` let the dump load into a server whose database user has a different name.

5. Replace the uploaded files:

   ```bash
   rm -rf backend/uploads
   tar -C backend -xzf backups/ttx-zone-uploads-<STAMP>.tar.gz
   ```

6. Start the backend:

   ```bash
   docker compose up -d backend
   ```

   On start it runs `alembic upgrade head`, which brings a dump from an older version up to the current schema. The other way round doesn't work: a dump taken with a **newer** version than the code being started fails (alembic doesn't know its revision). Restore with the same or a newer TTX-Zone version.

7. Check: sign in, open an exercise with images, and download a needs-analysis evidence file. Every existing session was in the dump, so they stay valid if `SECRET_KEY` didn't change. If it did, everyone signs in again.

### Restoring to another server

The steps are the same on a fresh deployment: `docker compose up -d postgres` first (it creates the empty database), then steps 3 to 7. The target's Postgres must be the same major version or newer (16 in this Compose file).

## Testing the backups

A backup that has never been restored is a guess. Every so often (monthly, say), restore the latest copy into a throwaway deployment or a scratch database and check it the same way as step 7:

```bash
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" ttx_zone_restore_check'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d ttx_zone_restore_check --no-owner --no-privileges --exit-on-error' \
  < backups/ttx-zone-db-<STAMP>.dump
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d ttx_zone_restore_check -c "SELECT count(*) FROM \"user\";"'
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" ttx_zone_restore_check'
```

The variables are inside `sh -c '…'` on purpose: they come from the Postgres container's environment, not from the host's shell.
