---
title: Outgoing email
description: Connect TTX-Zone to an SMTP server.
sidebar:
  order: 8
---

Email is optional. Without it the instance works, and the features that need it hide themselves: resetting a forgotten password, confirming addresses, email invitations and the second factor by email.

Email needs `PUBLIC_BASE_URL` too, because links in messages are built on it.

## Configure it

The first of these that applies wins:

1. **The environment.** `EMAIL_TRANSPORT` set means the whole configuration comes from there, and the web shows it read-only.
2. **Instance administration → Email.** The password is stored encrypted. The **Email sending active** switch stops sending without losing the configuration.
3. **Nothing.** The instance sends no email.

| Setting | Default | Meaning |
|---|---|---|
| `EMAIL_TRANSPORT` | unset | `smtp`. Setting it pins the configuration |
| `EMAIL_FROM_ADDRESS` | | The sender's address, required when pinned |
| `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | | Optional sender details |
| `SMTP_HOST`, `SMTP_PORT` | port `587` | The server |
| `SMTP_SECURITY` | `starttls` | `starttls` on 587, `tls` on 465, or `none` with `EMAIL_ALLOW_INSECURE` |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | | The login, sent only after TLS. `SMTP_PASSWORD_FILE` reads it from a file |
| `SMTP_TIMEOUT_SECONDS` | `15` | Per connection |
| `EMAIL_ALLOW_INSECURE` | `false` | Accepts plain text and unverified certificates. For an internal relay only |

Any SMTP service works: an internal relay, Microsoft 365, Google Workspace, Amazon SES and similar. Cloud providers often block port 25, so use 587 or 465.

## Check it

Send a test message from **Instance administration → Email**. **Outbox** lists each message's recipient, status, attempts and last error, without its content, for 30 days.

## How messages leave

A message is queued in the same transaction as the action that causes it, and the `worker` sends it right after. A temporary failure is retried with growing waits of up to an hour. A permanent one is marked `failed` and logged in `app.log`.

Delivery is at least once, so a crash at the wrong moment can send a message twice. Messages per address are limited per hour, so a public form can't flood a mailbox.

## Confirming addresses

While the instance sends email, a new account must confirm its address before going further. Accounts that existed before email was turned on aren't asked.

You can also ask people to reconfirm their address periodically, from **Instance administration → Email**.
