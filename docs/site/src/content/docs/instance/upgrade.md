---
title: Upgrade
description: Move to a new version.
sidebar:
  order: 12
---

1. Read `CHANGELOG.md` for the new version.
2. [Take a backup](/instance/backup-and-restore/#take-a-backup).
3. Set the new `TTX_VERSION` in `.env`. Change nothing else there: the database keeps the password it was created with, and `DATA_ENCRYPTION_KEY` must stay the one that encrypted the stored secrets.
4. Pull and start:

   ```bash
   docker compose pull
   docker compose up -d
   ```

The `migrate` service applies the migrations before the API and the worker start. From a clone, run `git pull` and `docker compose build` instead of `docker compose pull`.

A migration that fails leaves the API down and the database unchanged. You can go back to the previous image and restore nothing.
