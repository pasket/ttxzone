# Single sign-on (OpenID Connect)

People can sign in through an identity provider: a "Sign in with Microsoft" button on the sign-in page (or "Sign in with <name>" for any other OpenID Connect provider). This is phase 1 of roadmap §8: **one provider for the whole instance**, configured by an instance administrator. Per-organization providers, email-first discovery and enforcing SSO are phase 2 (`docs/roadmap.md`).

Code: `services/oidc_service.py` (configuration, protocol, accounts), `api/v1/endpoints/auth_oidc.py` (`/auth/oidc/*`), `api/v1/endpoints/instance_oidc.py` (`/instance/oidc`), models in `models/oidc.py`. Frontend: `lib/sso.ts`, `hooks/useOidcConfig.ts`, `components/auth/LoginCard.tsx`, `components/common/{ReauthenticationHost,SsoReturnNotice}.tsx`, `components/account/SignInMethods.tsx`, `components/platform/PlatformSsoSection.tsx`.

## Where the configuration comes from
The same pattern as email (`docs/architecture/email.md`):
1. **The environment pins it.** Set `OIDC_PROVIDER` (`entra` or `generic`) and Platform → Single sign-on shows it read-only (409 `SSO_PINNED_BY_ENV` on writes). Variables: `OIDC_ENTRA_TENANT_ID` (entra) or `OIDC_ISSUER_URL` (generic), `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` or `OIDC_CLIENT_SECRET_FILE`, `OIDC_DISPLAY_NAME`, `OIDC_ALLOW_JIT` (default false), `OIDC_TRUST_PROVIDER_MFA` (default true). A pinned configuration is checked at startup (missing values stop the backend).
2. **Otherwise Platform → Single sign-on** (`OidcSettings`, one row): the client secret is encrypted with `DATA_ENCRYPTION_KEY` (`core/crypto.py`), write-only (`has_client_secret`, `client_secret_readable`; omitted keeps it, it can't be emptied — a provider always needs one). Saving, removing and testing need step-up and are activity-log events (`sso.settings_update` before → after with `secret_changed`, `sso.settings_delete`, `sso.test` with the outcome), never the secret.
3. **Neither**: no button, `/auth/oidc/start` sends back to `/login?sso_error=SSO_UNAVAILABLE`.

`PUBLIC_BASE_URL` (scheme + host + port, as the browser sees the app) is required either way: the provider sends people back to `<PUBLIC_BASE_URL>/api/v1/auth/oidc/callback`, which must be registered there exactly. Platform shows it with a copy button. Without it single sign-on is off and can't be configured (409 `SSO_PUBLIC_URL_MISSING`). `OIDC_ALLOW_INSECURE` (env only) accepts a provider on plain http — a local test provider only.

### Microsoft Entra ID
Register an application in the tenant (**single tenant**), platform **Web**, redirect URI as above; create a client secret (and replace it before it expires — Platform keeps the old one until then). The tenant is a GUID: `common`/`organizations`/`consumers` are refused (422 `SSO_TENANT_ID_INVALID`), so only that tenant's people sign in, and the ID token's `tid` must match. For accounts created on first sign-in, add the optional claim **`xms_edov`** to the ID token (see *Accounts*). The issuer is `https://login.microsoftonline.com/<tenant>/v2.0`.

### Another provider
Named by its issuer URL (https; Keycloak `https://idp/realms/<realm>`, Okta, Google Workspace…); its metadata must be at `<issuer>/.well-known/openid-configuration`, and its `issuer` must equal the URL configured.

## The flow
Authorization code flow with PKCE (S256), run by the server; every trip is a full-page navigation, never `fetch`, so the SPA's CSP needs nothing new.

1. **Start**: `GET /auth/oidc/start?return_to=` (sign-in) or `POST /auth/oidc/step-up|link {return_to}` (signed in, CSRF; link also needs step-up) creates an `OidcLoginState` row — `state`, `nonce`, the PKCE verifier, the purpose, the account and session asking, `return_to` — valid 10 minutes, and sets an HttpOnly cookie `ttx_oidc_binding` (path `/api/v1/auth/oidc/`, SameSite=Lax) whose SHA-256 is in the row. Expired rows are purged whenever a new trip starts.
2. **Provider**: `response_type=code`, `scope=openid email profile`, `response_mode=query`; step-up adds `prompt=login&max_age=0` and `login_hint`; link adds `prompt=select_account`.
3. **Callback** `GET /auth/oidc/callback?code&state`: the row is deleted as it's read (single use), then refused unless the binding cookie matches (a callback URL replayed in another browser — login CSRF) and it hasn't expired. The code is exchanged at the token endpoint (`client_secret_basic` when advertised, else `client_secret_post`; no redirects followed) and the ID token checked: signature with the provider's published keys (`PyJWKClient`, asymmetric algorithms only — never HS256 or `none`), `iss`, `aud`, `exp`/`iat` (2 minutes leeway), `nonce`, and for Entra `tid` and `oid`. Metadata and keys are cached an hour.
4. **Outcome**: always a redirect into the SPA (`PUBLIC_BASE_URL` + path), never a page of its own (the API's CSP is `form-action 'none'`). Failures: `?sso_error=SSO_<REASON>` on `/login` (sign-in) or on `return_to` (step-up, link). Reasons: `state_invalid`, `state_expired`, `token_invalid`, `cancelled` (the person declined at the provider), `provider_error`, `provider_unreachable`, `account_not_found`, `link_required`, `email_unverified`, `suspended`, `session_mismatch`, `identity_mismatch`, `identity_taken`, `already_linked`, `mfa_required`, `not_recent`, `unavailable`.

No HTTP library was added: discovery and the token request use `urllib.request` with a no-redirect opener and a 10 s timeout (`oidc_service._http_get_json` / `_http_post_form`, which the tests replace), ID tokens `pyjwt[crypto]`.

## Accounts
Matched on `ExternalIdentity(issuer, subject)` — the provider's immutable id for the person (`oid` for Entra, which is per tenant, unlike `sub`; `sub` elsewhere). **Never on the email** after the first time. One identity per account per provider, one account per identity.

- **Linked before**: that account, whatever email the provider now says.
- **The email belongs to an existing account**: refused (`link_required`). The owner signs in with the password and links it in Preferences → Security → Single sign-on — never an automatic takeover by email.
- **New email, account creation on** (`allow_jit`): an account with no role and **no password** (`User.hashed_password` is NULL), name from the `name` claim; it lands in the Waiting Room, and roles are granted in Users and roles as for anyone. Legal documents are accepted through the usual gate (`LEGAL_ACCEPTANCE_REQUIRED`) on the first request. Logged `auth.register` with `via: sso`.
- **Otherwise**: `account_not_found`.

Which email the provider vouches for (`oidc_service.verified_email`): for Entra the `email` claim only with `xms_edov` true (the mail attribute is set by tenant administrators, and a tenant can claim any domain in it); otherwise `preferred_username` (the UPN, a domain the configured tenant verified), unless it's a guest's (`#EXT#`). Other providers need `email_verified: true`. No vouched email means `email_unverified` for an unlinked person.

Suspended and deleted accounts are refused like at password sign-in. Deleting an account (own or from Platform) deletes its identities and pending trips (`oidc_service.forget_user`), freeing the person at the provider.

## Second factor
The session records `UserSession.mfa_source = "provider"` when the ID token's `amr` contains `mfa` and the configuration trusts it (`trust_provider_mfa`). `core/security.mfa_satisfied` — behind every mandatory-TOTP gate (`_require_mfa_enrolled`) — accepts the account's own TOTP **or** that session flag (carried on the request's `User` row via `sqlalchemy.inspect(user).info`; a `User` loaded any other way counts only its own TOTP). `/auth/me` exposes it as `session.mfa_source`, and `authStore` uses it for the `needs-mfa-enrollment` gate.

Without it, an account with TOTP gets the usual challenge: the callback redirects to `/login?return_to=…#mfa=<token>` (the mfa_pending token in the fragment, never sent to a server nor in a Referer; `LoginCard` reads it, clears the URL and shows the code step). An account without TOTP gets a session, and the role gates send privileged roles to enrollment as usual.

**Entra caveat**: Microsoft's ID token claims reference doesn't list `amr`, and a Microsoft answer from 2022 says it's emitted only in v1.0 tokens; this app uses the v2.0 endpoint. So with Entra, expect the switch to have no effect: privileged roles keep using the app's TOTP — the safe default, never a weaker one. To see what a real tenant does, sign in once with single sign-on and look at the `auth.login` event in Platform → Activity log: `provider_mfa` says whether the token counted as the provider's second factor. If it reads `false` after a sign-in that asked for MFA, the tenant's tokens don't carry it.

## Step-up and sign-in methods
- An account with neither TOTP nor password gets 409 `SSO_STEP_UP_REQUIRED` from `POST /auth/step-up`; the client's step-up dialog then offers "Continue with <provider>", which calls `POST /auth/oidc/step-up` and leaves the page. The callback checks the session that asked is the one coming back (`session_mismatch`), the identity is that account's (`identity_mismatch`), the provider authenticated just now (`auth_time` within 5 minutes and after the trip started, when the provider sends it — `not_recent`) and, for an account with TOTP, that the provider did MFA (`mfa_required`); then `mark_authenticated`, `auth.step_up` with `factor: sso`, and back to `return_to?sso_confirmed=1`. The pending action is lost with the page: the person does it again (`SsoReturnNotice` says so).
- An account without a password confirms password-protected self-service actions with step-up instead: `POST /auth/password` sets the first password without `current_password`; `POST /auth/totp/disable` and `/auth/totp/backup-codes/regenerate` take no password. A password sign-in to such an account is a plain `INVALID_CREDENTIALS` (logged `reason: no_password`).
- Preferences → Security → Single sign-on: link (`POST /auth/oidc/link`, step-up, then `?sso_linked=1`), unlink (`DELETE /auth/oidc/link`, step-up; 409 `SSO_UNLINK_NEEDS_PASSWORD` while the account has no password). `/auth/me` carries `has_password`, `sso_linked` and `sso_provider` (the provider's name while it's on).

## Logged
Through `auth_event_service.auth_event` (`auth.log` + activity log + SIEM): `auth.login` `method: sso`, `auth.register` `via: sso`, `auth.login_failed` `{method: sso, reason, detail?}` (a link failure adds `link: true`), `auth.step_up` / `auth.step_up_failed` `factor: sso`, `auth.sso_link` (`provider_email`), `auth.sso_unlink`. Platform's changes: `sso.settings_update`, `sso.settings_delete`, `sso.test`.

## Testing locally
The backend tests fake the provider in process (`tests/test_oidc.py`'s `FakeProvider`: metadata, token endpoint, an RSA key made in the test). For a real round trip, run a Keycloak container as a generic provider (`OIDC_ALLOW_INSECURE=true` for plain http) or use an Entra test tenant, with `PUBLIC_BASE_URL=http://localhost:5173` (the Vite proxy forwards `/api`).

## Open points (phase 2 and later)
Per-organization providers tied to Allowed Domains, email-first discovery, enforcing SSO per organization, mapping Entra groups to org grants, deprovisioning (SCIM, or refusing a disabled user at sign-in), an account in several organizations with different providers.
