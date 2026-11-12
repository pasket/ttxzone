# Outgoing email

How the instance sends email. The instance's operator configures it, not an organization. Phase 1 built the component: configuration, transport, queue, templates and Platform → Email. Messages sent today: Platform's test message, "forgot your password?", the email confirmation at signup (see [Account links](#account-links)) the second factor's verification code (`mfa_code`, `docs/architecture/session-policy.md`) and personal invitations to an exercise (`email_invitation`, `docs/features/invitations-and-enrollment.md`). Also the [periodic reconfirmation](#periodic-reconfirmation) of addresses (`email_reconfirmation`), and an organization's offer of roles to an existing account (`role_invitation`, `docs/features/admin.md` → Invitations to the organization; no link token: the account signs in to answer).

Code: `app/core/crypto.py` (encryption at rest), `app/models/email.py` (`EmailSettings`, `EmailOutbox`), `app/services/email_transports.py` (SMTP, console), `app/services/email_service.py` (configuration, queue, delivery loop, templates), `app/api/v1/endpoints/instance_email.py` (Platform), `app/data/email/` (templates), `frontend/src/components/platform/PlatformEmailSection.tsx`.

## SMTP, a REST API, or both
**Both, behind one transport interface.** SMTP is built first. A provider's REST API comes as one adapter per provider, when an operator needs it.

| | SMTP | A provider's REST API |
|---|---|---|
| Who speaks it | Every mail system: an on-premises relay (Postfix, Exchange), Microsoft 365, Google Workspace, Amazon SES, SendGrid, Mailgun, Postmark… (all of them also take SMTP) | Each provider has its own API, auth and errors: one adapter each |
| Isolated / on-premises deployments | Works with the organization's internal relay | Needs Internet access to the provider |
| Dependencies | The standard library (`smtplib`, `email`) | An HTTP client and code per provider |
| Network | Ports 587/465 (cloud providers often block 25) | HTTPS 443 only |
| Credential | Username and password, often a real mailbox | An API key limited to sending, revocable |
| Extras | — | Bounce and delivery webhooks |

Why this order:
- The product is self-hosted. Its operators range from an air-gapped SOC to a cloud tenant. SMTP is the one transport they all can use, and it needs nothing new.
- The first REST adapter planned is **Microsoft Graph** (`sendMail`), not a generic one. Corporate customers often run Microsoft 365, where Microsoft has announced the retirement of Basic authentication for SMTP AUTH (the dates have moved; check them). A tenant without SMTP AUTH then needs OAuth2 or Graph. SES, SendGrid and Mailgun keep SMTP relays, so they need no adapter until someone asks.
- There will be no "configurable generic REST" transport. Every API differs in auth, payload and errors, and a URL plus header templates typed into the web would be fragile and an SSRF vector.

A transport is any class with `send(message: EmailMessage) -> None` (`EmailTransport` protocol). It raises one of two errors:
- `TransientEmailError` when trying later may work: the server is down, busy or refuses the credentials (the operator can fix it).
- `PermanentEmailError` when it never will: the server refused that recipient, or refused the message with a 5xx.

## Where the configuration comes from
The configuration has three possible sources. The first one present wins:
1. **The environment pins it.** `EMAIL_TRANSPORT` set in `.env`/the container's environment means the whole configuration comes from there. Platform → Email shows it read-only, and `PUT`/`DELETE /instance/email` answer 409 `EMAIL_PINNED_BY_ENV`. This is what infrastructure-as-code, Kubernetes and Docker secrets deployments use.
2. **Platform → Email.** Without the pin, an instance administrator sets it from the web. It is stored in the one-row `email_settings` table, with the password encrypted. Its **Email sending active** switch (`enabled`) turns sending off without losing the configuration: while inactive, the instance counts as sending no email (point 3). Messages already queued wait until it's active again; new ones aren't queued.
3. **Nothing.** The instance sends no email. `email_service.is_enabled(session)` is False, and features that need email hide themselves; nothing fails.

This is the same model as the tenancy rule (`TENANCY_MODE`, `docs/features/instance-tenancy.md`).

| Setting | Default | Meaning |
|---|---|---|
| `EMAIL_TRANSPORT` | unset | `smtp` or `console` (writes each message to `app.log`; development only, refused with `ENVIRONMENT=production`). Set = pinned. |
| `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` / `EMAIL_REPLY_TO` | — | The sender. The address is required when pinned. |
| `SMTP_HOST` / `SMTP_PORT` | — / `587` | The server. |
| `SMTP_SECURITY` | `starttls` | `starttls` (587: upgrade, never falls back to plain text), `tls` (465: TLS from the first byte), `none` (needs `EMAIL_ALLOW_INSECURE`). |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | — | Login (only after TLS). |
| `SMTP_PASSWORD_FILE` | — | Read the password from this file (a Docker/Kubernetes secret) instead of the environment. |
| `SMTP_TIMEOUT_SECONDS` | `15` | Per connection. |
| `EMAIL_ALLOW_INSECURE` | `false` | Accepts plain-text SMTP, unverified certificates and ports other than 25/465/587/2525 — an internal relay or a local mail catcher only. Applies to both the pinned and the web configuration. |
| `EMAIL_POLL_SECONDS` | `5` | How often the queue is drained. |
| `EMAIL_MAX_ATTEMPTS` | `8` | Attempts before a message is given up on. |
| `EMAIL_RATE_PER_RECIPIENT_PER_HOUR` | `10` | Messages one address can be queued per hour; beyond, new ones are dropped. |
| `EMAIL_RATE_GLOBAL_PER_MINUTE` | `60` | Messages the instance sends per minute in all (the rest wait). |
| `EMAIL_RECONFIRMATION_DAYS` | unset | Every account confirms its address again after this many days ([Periodic reconfirmation](#periodic-reconfirmation)); `0` = never. Set = pinned (Platform shows it read-only); unset = Platform → Email decides, off by default. |
| `DATA_ENCRYPTION_KEY` / `_FILE` | — | **Required**: the backend doesn't start without it. See below. |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | — | Still decrypts during a key rotation. |

A pinned configuration is checked when the backend starts (`Settings._email_and_encryption`). A missing host or sender, a missing key, `console` in production, or `none`/an odd port without `EMAIL_ALLOW_INSECURE` stops the backend with the reason, instead of failing every message later. A blank value (`SMTP_HOST=`) counts as unset.

## Secrets: encrypted at rest
`core/crypto.py` encrypts what the application keeps in its own database:
- each account's TOTP secret (`User.totp_secret_encrypted`, through `totp_service.store_secret`/`stored_secret`);
- the SIEM webhook's signing secret and Authorization header (Platform → Activity log);
- the SMTP password typed into Platform → Email, and the single sign-on client secret typed into Platform → Single sign-on;
- each queued message's parameters (features will put one-time links in them).

It uses Fernet (AES-128-CBC with HMAC-SHA256: a tampered value fails to decrypt instead of decrypting to garbage). The key is `DATA_ENCRYPTION_KEY`, from the environment or a file. It is never stored in the database, so a dump or a backup alone reveals nothing. It is **separate from `SECRET_KEY`**: rotating that one (it signs sessions) must not make stored secrets unreadable, and one key per purpose limits what a leak exposes.

The key is required: without it the backend refuses to start (and the container's `alembic upgrade head` fails before it). Generate one with:

```bash
docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Keep it with the database backups' secrets, not inside them. A backup restored without its key loses what was encrypted with it, each recoverable on its own: every account with two-factor authentication has to have it reset by an instance administrator (Platform → Accounts) and enroll again; the webhook needs a new secret (and its Authorization header again); the SMTP password and the client secret have to be entered again; queued messages are lost.

The API never returns a secret. `GET /instance/email` says `has_password`, and `password_readable` (false when no configured key decrypts the stored one: email is then off until it's entered again). `PUT` takes `smtp_password`: left out, the stored one stays; `""` removes it; any other value replaces it.

### Rotating the encryption key
1. Set the new key as `DATA_ENCRYPTION_KEY` and the old one as `DATA_ENCRYPTION_KEY_PREVIOUS`, then `docker compose up -d backend`. Both keys decrypt; new values use the new one.
2. `docker compose exec backend python -m scripts.reencrypt_secrets` re-encrypts every stored secret listed above and every queued message with the new key. It reports any value neither key reads, and what to do about it.
3. Remove `DATA_ENCRYPTION_KEY_PREVIOUS` and restart.

## The outbox: how a message leaves
1. **Queued with the action.** A feature calls `email_service.queue(session, to, template, params, locale)` inside its own transaction, before its commit. The message exists if and only if the action committed (transactional outbox). Nothing is ever sent from inside an HTTP request; the only exception is Platform's test message.
2. `queue` returns `None` without queueing when:
   - the instance sends no email;
   - or the address already got `EMAIL_RATE_PER_RECIPIENT_PER_HOUR` messages in the last hour, so a public form can't flood a mailbox. A WARNING line in `app.log` names only the domain.

   Callers answer the user the same either way, so a "forgot password" form never reveals whether an account exists.
3. **Sent by a background loop.** `deliver_forever` runs in the process with the background loops (`APP_ROLE` `all` or `worker`, `docs/deployment.md` §8), next to the activity log's loop. `queue()` sends a Postgres `NOTIFY email_outbox` in the caller's transaction and the loop `LISTEN`s on a connection of its own, so a message goes out right after the commit that queued it, whichever process queued it; otherwise every `EMAIL_POLL_SECONDS`, in a worker thread (smtplib blocks), it takes the due messages one at a time, oldest first. Each row is locked `FOR UPDATE SKIP LOCKED` in its own transaction, so several backend processes never send the same message. At most `EMAIL_RATE_GLOBAL_PER_MINUTE` go out per minute. For each message the loop decrypts the parameters, renders the template, builds the message and sends it with one SMTP connection.
4. **Outcomes:**
   - **Sent:** `status=sent`, `sent_at`, and the encrypted parameters are wiped.
   - **Transient failure:** `attempts+1`, retried after `10 s × 2^attempts`, at most 1 hour. The round stops there, since the server is likely down.
   - **Permanent failure** or the last of `EMAIL_MAX_ATTEMPTS`: `status=failed`, parameters wiped, an ERROR line in `app.log`.
   - **Unwritable message** (a parameter no key decrypts, a template error): `failed` at once, recorded as the exception's type only, never its text, which could quote the parameters.
5. **Kept without content for 30 days** (`EMAIL_RETENTION_DAYS`, fixed). Platform → Email → Outbox lists recipient, message, status, attempts and last error. The loop prunes older rows hourly, whatever their state: a message still pending after 30 days would carry an expired link.

Delivery is **at least once**: a crash between the server accepting a message and the commit sends it again on the next round. While email is off or removed, queued messages wait.

Deleting an account removes its messages from the outbox: `email_service.forget_recipient`, called by both the self-service soft delete and Platform's hard delete.

### Adding a message (for the features that will send email)
1. Add its name to `EmailTemplate` and `TEMPLATES` in `email_service.py`.
2. Write `app/data/email/<locale>/<name>.subject.txt`, `<name>.txt` and `<name>.html` (extending `layout.html`) for every supported locale, `en` and `es`.
3. Call `queue(...)` in the action's transaction with the recipient's locale; check `is_enabled` first if the feature should hide itself without email.
4. Label it in the outbox (`TEMPLATE_LABEL_KEYS` in `PlatformEmailSection.tsx`, `platform.email.outbox.templates.*` in both locale files).

Links in messages build on the instance's public URL, `PUBLIC_BASE_URL` (the same setting single sign-on requires, `docs/architecture/sso.md`).

## Account links
The messages the instance sends today besides the test: "forgot your password?" and confirming the address an account signs up with. Code: `app/services/account_email_service.py`, `app/models/account_token.py`, the pages `frontend/src/components/auth/{ForgotPasswordCard,ResetPasswordCard,VerifyEmailLink,EmailVerificationGate}.tsx`.

- **Offered only when possible**: `account_email_service.available` = email is on **and** `PUBLIC_BASE_URL` is set. Otherwise the sign-in page has no "Forgot your password?" link (`GET /instance/policy`'s `password_reset_available`), and nobody is asked to confirm anything.
- **The link**: `<PUBLIC_BASE_URL>/reset-password#token=…` or `/verify-email#token=…`. The token (32 random bytes) travels in the fragment, so it never reaches a server log or a `Referer`; the page reads it and takes it off the address bar. The database keeps its SHA-256 only (`account_token`), with the address it went to: the link stops working if the account's address changes. One live link per account and purpose: a new one withdraws the previous. Opening it spends it (the row is locked, so it can't be spent twice at once).
- **Forgot password** (`password_reset`, 30 minutes): `POST /auth/password/forgot` answers 202 whatever the address, so the form never tells whether an account exists. A deleted, unknown or suspended account gets nothing; an account without a password that signs in through single sign-on gets `password_reset_sso` instead (no link: its way in is the provider; without single sign-on any more it gets the ordinary link and may choose a password). Spending the link sets the password (`StrongPassword`), clears a temporary password, confirms the address (it reached the mailbox) and **signs every session out**; it signs nobody in, and two-factor authentication is untouched. Recorded: `auth.password_reset_request` (with `sent`, and the reason when nothing was sent) and `auth.password_reset`.
- **Email confirmation** (`email_verification`, 48 hours): every signup (bare account, organization, invitation code) calls `start_verification` in its transaction. While the deployment sends email, the new account gets `email_verification_required` and the message; until it opens the link it reaches only `/auth/...` (403 `EMAIL_VERIFICATION_REQUIRED`, `docs/architecture/session-policy.md`). The link works in any browser, signed in or not (`auth.email_verify`). "Send a new link" waits a minute between links. Accounts created through single sign-on are confirmed by the provider (`verified_email`); accounts from before this existed were confirmed by the migration, and accounts created while email was off are never asked. If email is turned off, a pending account is let through (it can't get the link).
- **Rate limits**: the outbox's per-address hourly limit applies (`EMAIL_RATE_PER_RECIPIENT_PER_HOUR`); when it drops a message, the link already sent stays the live one.
- **Privacy**: the account's links are deleted with the account (both deletion paths).
- Platform shows "Email not confirmed" on an account held at the confirmation screen.

## Periodic reconfirmation
Every account confirms its address again after a period: **off by default**, set in Platform → Email → Periodic reconfirmation (30–730 days) or pinned by `EMAIL_RECONFIRMATION_DAYS` (`0` pins it off). Code: `account_email_service` (`reconfirmation_days`, `ask_reconfirmation`, `reconfirmation_overdue`), template `email_reconfirmation`.

- **Due**: the rule is on, the deployment can send the link (`available`), and `email_verified_at` is older than the period, or empty. An empty one covers accounts created while email was off, or before confirmation existed. An account still confirming its signup address is held by that instead.
- **Asked at sign-in** (`start_session`, every way a session is issued): a due account that wasn't asked yet gets a link (purpose `email_verification`, the same `/verify-email` page) valid for the **grace period, 14 days** (`RECONFIRMATION_GRACE`), and `User.email_reconfirm_deadline` = now + 14 days. If the outbox drops it (the hourly limit), the next sign-in asks again. Nothing goes out to accounts that never sign in: they're asked when they come back.
- **Grace**: the account works as usual; a banner under the header says until when, with "Send a new link" (`POST /auth/email/verification`, a new link for the rest of the period; the minute between links applies).
- **Held** past the deadline: 403 `EMAIL_RECONFIRMATION_REQUIRED` outside `/auth/...`, and the client shows the confirmation screen with its own wording (`docs/architecture/session-policy.md`). Platform → Accounts shows "Email reconfirmation overdue".
- **Confirmed** by anything that proves the mailbox: the link, a password reset link, accepting an email invitation, and every single sign-on (the provider vouches for the address, `oidc_service.resolve_login`). Each sets `email_verified_at` to now and clears the deadline.
- **Safety**: turning the rule or email off releases every held account at once (the check is made on each request). Instance administrators are included; if email breaks they're released with everyone, and `scripts.instance_admin` still works from the console.
- **Recorded**: `email.reconfirmation_update` (before/after) in the activity log; `auth.email_verify` when a link is opened.

## Verification codes
A 6-digit code as a second factor (`app/services/email_mfa_service.py`, template `mfa_code`), rules in `docs/architecture/session-policy.md`. It reuses `account_token` (purpose `mfa_email_code`, 10 minutes, one per account, bound to the address) but stores an HMAC keyed with `SECRET_KEY` over the account id and the code: a plain SHA-256 of 6 digits is reversed by trying them all, and would collide across accounts on the unique column. The code is in the body, never in the subject (notifications show it). Someone waiting at the sign-in page can't wait for the next poll: after the commit, `email_service.wake_delivery()` starts a delivery round at once (the loop waits on an `asyncio.Event` with `EMAIL_POLL_SECONDS` as the timeout). A new code waits a minute after the previous one (429 `EMAIL_CODE_RATE_LIMITED`), and the per-address hourly limit applies.

## Templates
Jinja2 renders the templates in a **`SandboxedEnvironment`**. A template can't reach Python internals, so templates may one day be edited from the web (invitation templates in the roadmap). Rendering uses `StrictUndefined`: a missing parameter fails instead of rendering empty.
- **HTML is autoescaped**: a value such as an account's name can't inject markup. Plain text and the subject aren't escaped, since they are never parsed as markup.
- The subject is collapsed to one line whatever the parameters held.
- The layout carries no remote images, scripts or tracking pixels. Styles are inline (mail clients drop `<style>`). Every message is `multipart/alternative`, plain text plus HTML; the HTML part is `multipart/related` with the logo (`app/data/email/logo.png`, the dark isotype at 2x) attached inline as `cid:logo@ttx-zone`, so it shows without loading anything remote. The header is the app's dark band with the logotype as text (it reads even with images off), the button the primary-button colours.
- The language: the recipient's (`queue(..., locale=)`), falling back to `DEFAULT_LOCALE`. Platform's test message uses the administrator's interface language.

## Security controls
- **TLS by default and no downgrade:**
  - `ssl.create_default_context()` checks the certificate and host name, with TLS 1.2 minimum.
  - `starttls` requires the server to offer STARTTLS; otherwise the attempt fails as transient and nothing goes out in plain text.
  - The login happens only after TLS.
  - Unencrypted connections, unverified certificates and non-standard ports need `EMAIL_ALLOW_INSECURE=true`, a server-side switch the web can't flip.
- **No header injection:**
  - Messages are built with `EmailMessage(policy=SMTP)`, which refuses a header value with a line break.
  - Addresses go through `email-validator` (one address, no display name, no list, no CR/LF).
  - The sender's name is checked for line breaks.
  - Each message has one recipient, no Cc or Bcc.
  - Headers: `Message-ID` on the sender's domain, `Date`, `Auto-Submitted: auto-generated`.
- **The host field is not a scanner:** host names or IPs only (no scheme, port or path), and only ports 25/465/587/2525 unless `EMAIL_ALLOW_INSECURE`.
- **Access:**
  - Every endpoint is instance administrator only (`require_instance_admin`, TOTP mandatory).
  - Writes need CSRF.
  - Saving, removing and the test message need a recent sign-in (`RequireRecentAuthentication`): whoever controls the mail server reads every message the instance sends.
  - At most 5 test messages per administrator per minute (429 `EMAIL_TEST_RATE_LIMITED`).
- **Recorded:** `email.settings_update` (before/after, never the password: `has_password`, `password_changed`), `email.settings_delete` and `email.test` (recipient, outcome) go to the activity log, and so to the SIEM (`docs/architecture/logging.md`).
- **Never logged:** passwords, keys, message bodies, parameters, or the SMTP conversation. `SmtpConfig.__repr__` masks the password, and the settings use `SecretStr`. `app.log` lines name the outbox id, the template and the recipient's domain only.
- **Privacy:** the outbox keeps the recipient for 30 days and nothing of the content; deleting an account removes its rows.

## Microsoft Graph: evaluation
**Not built.** Taken up when an operator asks for it, or when Microsoft announces the final removal date.

- **Timeline** (Message Center MC786329, last updated January 2026; check it again before deciding): Exchange Online keeps Basic authentication for SMTP AUTH unchanged until the end of December 2026. Then it is turned off by default in existing tenants, but their administrators can turn it back on. Tenants created after that never have it. The final removal date is to be announced in the second half of 2027.
- **Not blocking today.** A Microsoft 365 operator can:
  - turn SMTP AUTH back on for the sending mailbox;
  - send through an on-premises relay or an Exchange connector allowed by IP;
  - use another provider's SMTP relay (SES, SendGrid, Mailgun).
- **What building it takes** (about a day with tests):
  - a `GraphTransport` behind the `EmailTransport` protocol: `POST /users/{sender}/sendMail` with the MIME message in base64, so the message built today (multipart, inline logo) goes out unchanged;
  - an access token by client credentials, cached until it expires;
  - tenant ID, client ID and client secret in Platform → Email (the secret encrypted with `core/crypto.py`) and pinned by the environment like SMTP;
  - 429 and 5xx answers as `TransientEmailError` (respecting `Retry-After`), other 4xx as `PermanentEmailError`.

  The outbox, templates and rate limits don't change.
- **Risks to document:**
  - The application permission `Mail.Send` lets the app send as **any** mailbox in the tenant. The operator must scope it to the sending mailbox (RBAC for Applications in Exchange Online, or an Application Access Policy); the setup guide has to make that mandatory.
  - It needs outbound HTTPS to `login.microsoftonline.com` and `graph.microsoft.com`, so it doesn't serve an isolated deployment (SMTP to an internal relay does).
- **SMTP with XOAUTH2 instead: discarded.** It would reuse the SMTP transport, but it needs the app's service principal registered in Exchange Online and the `SMTP.SendAsApp` permission. That is harder to set up and to diagnose than Graph for the same tenants.

## Operator checklist (deliverability)
- **Sender domain records.** The sender's domain needs **SPF** allowing the server, **DKIM** signing (done by the relay or provider) and a **DMARC** policy. Otherwise messages land in spam or are refused. The application doesn't sign DKIM itself.
- **Sender address.** Use an address the server may send as (Microsoft 365 and Google require the mailbox or a "send as" grant). A `noreply@` mailbox with `EMAIL_REPLY_TO` pointing to a monitored one is common.
- **Recipes:**
  - **Internal relay** (Postfix/Exchange): `SMTP_HOST=relay.corp.example`, `SMTP_PORT=25` or `587`, `starttls`, often without login (allowed by IP).
  - **Microsoft 365**: `smtp.office365.com:587`, `starttls`, the mailbox's credentials, with SMTP AUTH enabled for that mailbox. If the tenant turns off Basic authentication, see [Microsoft Graph: evaluation](#microsoft-graph-evaluation).
  - **Google Workspace**: `smtp.gmail.com:587`, `starttls`, an app password; or the SMTP relay service, `smtp-relay.gmail.com`, allowed by IP.
  - **Amazon SES**: `email-smtp.<region>.amazonaws.com:587`, `starttls`, SMTP credentials (not the IAM keys).
  - **SendGrid**: `smtp.sendgrid.net:587`, username `apikey`, password = the API key.

## Local development
A mail catcher runs on demand (profile `mail` in `docker-compose.yml`):

```bash
docker compose --profile mail up -d mailpit     # UI at http://localhost:8025
```

Then set `EMAIL_ALLOW_INSECURE=true` in `.env` and `docker compose up -d backend`. In Platform → Email, use host `mailpit`, port `1025`, connection "Unencrypted", no username. Or pin it in `.env` with `EMAIL_TRANSPORT=smtp`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURITY=none` and a sender. `EMAIL_TRANSPORT=console` writes messages to `app.log` instead.

Tests never touch a network. `tests/test_email.py` swaps `email_service.transport_for` for a fake and `smtplib.SMTP` for a stub. `conftest.py` sets a fixed test key and unpins email for every test.

## Troubleshooting
| Symptom | Cause |
|---|---|
| Backend doesn't start: "Outgoing email: …" | The pinned configuration is incomplete or unsafe; the message lists what. |
| Backend doesn't start: "DATA_ENCRYPTION_KEY … is required" | Set it in `.env` (or `DATA_ENCRYPTION_KEY_FILE`); see above. |
| Platform → Email: "Password unreadable" | `DATA_ENCRYPTION_KEY` changed without `_PREVIOUS`; enter the password again. |
| Every two-factor code refused for an account; `app.log` says its TOTP secret can't be decrypted | Same cause; reset its two-factor authentication in Platform → Accounts. |
| Activity log forwarding: "The signing secret or Authorization header can't be decrypted" | Same cause; generate a new secret (tell the collector) and enter the header again. |
| Test: "The server doesn't offer STARTTLS" | Wrong port (465 needs "TLS from the start"), or a relay without TLS (`EMAIL_ALLOW_INSECURE` + "Unencrypted", internal only). |
| Test: "TLS failed: CERTIFICATE_VERIFY_FAILED" | The relay's certificate isn't trusted: install the CA in the image, or (internal relay only) `EMAIL_ALLOW_INSECURE`. |
| Test: "SMTP 535 …" | The server refused the credentials (Microsoft 365: SMTP AUTH disabled for the mailbox or the tenant). |
| Test OK but nothing arrives | Spam folder; SPF/DKIM/DMARC of the sender's domain. |
| Messages stay "Waiting" | Email is off or removed, or the server keeps failing (see the last error); they leave once it's fixed, within `EMAIL_MAX_ATTEMPTS`. |
