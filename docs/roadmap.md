# Roadmap

## Product modules
One module per role family, plus the operator's workspace (the code lives in `frontend/src/components/<area>/`). All are built.
1. **Creator** (Exercise Planners) — design: needs analysis, MSEL with timed and contingent injects, discussions and polls, the session plan (definitive EEGs on a common rating scale, evaluator assignments, design validation, logistics, session documents), scenarios (Library → Scenarios), and after the session the editable after-action report and improvement plan (`docs/features/after-action.md`).
2. **Control** (Controllers, `/control`) — runs the exercise from the Control center: the Playground plus the control panel (start, pause, release / fire / skip injects, key questions, expected actions, STOP), the read-only EEG and the after-action report (`docs/features/playground.md`).
3. **Playground** (`/playground`; Players, plus Facilitators, Observers and Evaluators identified as such) — the live session for the table, with each role's own panel (notes, the Facilitator's script, live P/S/M/U evaluation, the feedback form), the table's decision log and polls.
4. **Admin** (Program Managers) — organization management: profile, users and roles matrix, the exercise portfolio with self-join, domains, dashboard, library, the organization's improvement plan (`docs/features/admin.md`).
5. **Instance administration** (`/platform`, the instance administrator; avatar menu) — the operator's workspace above every organization: organizations, accounts, administrators, legal documents, tenancy rule, sign-in security, email, single sign-on, AI assistant, activity log (`docs/features/instance-tenancy.md`).

## Backlog
Grouped by theme. Section numbers are stable references (other documents cite them), not an order: each heading carries its priority (**Now**, **Next**, **Later**), and within a group the first entries come first.

### 1. After the first release (Now)
- What the first deployments report: issues and questions on GitHub, fixed in patch releases (`docs/deployment.md` §7).
- The `ubuntu-latest` runners move to Ubuntu 26: check CI and the release workflow on it, or pin the version the workflows were proven on.

### 2. Email and accounts (Later)
- A Microsoft Graph transport (`sendMail`, OAuth2 client credentials, one mailbox via an Application Access Policy) for Microsoft 365 tenants without SMTP AUTH, when an operator asks or Microsoft announces the final removal of Basic authentication for SMTP AUTH (`docs/architecture/email.md#microsoft-graph-evaluation`). Other providers' APIs only when an operator asks (they all keep SMTP relays).
- A "check your email" signup: the same answer whether or not the address has an account, and a session only once it's confirmed. Signing up says when an email is taken, limited per address (`docs/architecture/session-policy.md`) but not closed. Changes how every account is created, and a deployment without email can't use it.
- Manually unlocking an account or address held by the failed sign-in limits.
- Password policy: dictionary / breached-password checks and per-organization rules (the instance-wide rules are in Platform → Sign-in security, `docs/features/instance-tenancy.md#sign-in-security`).

### 3. Deployment and operations (Later)
- Running the browser tests against `deploy/` on a real server, and automating it.
- More than ~1000 Players at once (`docs/deployment.md` §10): send the shared view inside the ring (`event: view`, no `GET /run` after it) — server fan-out per room in `run_stream`, the client taking the newest view by `seq`, an access check in the stream's keep-alive; an estimated 1–2 s for 1000 Players with Postgres nearly idle on each change. Trade-offs: a revoked or suspended Player keeps receiving views until the next keep-alive (up to 10 s), and a second delivery path to keep in step with `GET /run`. Also: Postgres `LISTEN/NOTIFY` behind `run_stream.listen`, so several backend processes ring each other's streams instantly.
- Backups stay the infrastructure owner's (scheduling, encryption, shipping copies off the host; `docs/architecture/backup-and-restore.md`).

### 4. Legal and product information (Later)
- Nothing open: licence, `NOTICE`, credits in About, per-operator terms and privacy policy are built (`docs/features/legal-documents.md`).

### 5. Exercise lifecycle and after-action (Later)
- Opening an exercise read-only from Admin → Exercises without a seat on its team.

### 6. Live session and rooms (Later)
- Applying a scenario to an exercise that has been played: refused (`SCENARIO_EXERCISE_PLAYED`), since each run's snapshots hang off the MSEL and session plan rows the copy deletes. Allowing it means snapshots owned by the exercise (a migration) so archived runs keep the design they ran.

### 7. Scenarios and library content (Later)
- More TTX-Zone scenarios; converting a scenario whose ATT&CK release this build doesn't ship (refused); the session plan's content in a scenario (left out of the format); a community exchange beyond files.
- Organization-level objective and risk libraries.
- Phase-structure sets generalizing the four suggested phases (e.g. a short 2-hour session, a multi-day scenario with long time jumps).
- "Update from library": offer to refresh a copy when its original changed (origin + `updated_at`).
- Polls in the TTX-Zone catalog (the organization's library already keeps them).
- An instance administrator importing extra packages of `.kb.md` files, validated by the same `parse_entry` (`docs/features/knowledge-base.md`).

### 8. Single sign-on and organization administration (Later)
- Single sign-on, phase 2 (phase 1, one provider for the instance, is built: `docs/architecture/sso.md`):
  - **Configuration** per organization by its Program Manager (Entra tenant ID, client ID, client secret stored encrypted, tied to its Allowed Domains), with email-first discovery on the sign-in page; the button appears only where a provider is configured.
  - **Accounts**: just-in-time provisioning into the organization for a verified email in its Allowed Domains; mapping Entra groups to org grants as an option.
  - Optionally the organization enforces SSO and turns password sign-in off for its members.
  - Open points: deprovisioning (SCIM, or a disabled user refused at the next sign-in), an account in several organizations with different providers, SAML only if an operator needs it.
  - Microsoft's documentation doesn't list `amr` in v2.0 ID tokens, so with Entra the provider-MFA trust switch may have no effect; it fails safe (TOTP is still required), and each SSO `auth.login` event records `provider_mfa` to read the real behaviour.
- Billing: invoices, payment methods; `Organization.subscription_tier` exists with no UI.
- On organization creation: optionally seed a demo exercise and a scenario library.
- Import / export of organization data.

### 9. Exports and UI polish (Later)
- A print stylesheet for the needs analysis.
- MSEL export formats beyond PDF.
- UI polish: further toward a whitespace-led hierarchy (fewer hairline borders, more separation by spacing).

### 10. AI assistant (Later)
The design: TTX-Zone serves an MCP endpoint and each person uses an AI client they run themselves, as themselves, with a personal access token; only for building an exercise and writing its after-action report, never in the Playground. Proposals wait for a person to accept or discard them. No data filtering, responsible-use notices instead; an instance switch; no embeddings (`docs/features/ai-assistant.md`).
- The server marks a proposal applied when the form's save holds it, instead of the page.
- Proposals for Library scenarios.
- **Delegated acceptance**: a Planner lets low-risk proposals of one exercise accept themselves, by kind, recorded in the activity log as accepted by delegation; validating injects, approvals and READY always by hand. Accepting with nobody on the page needs the server to write the document itself, which ends "propose, never write" for those kinds — the decision to take first.
- **Integrated chat** inside TTX-Zone through a provider the operator contracts (Azure AI Foundry, Amazon Bedrock, Google Vertex AI), for organizations that need it for compliance: split screen with the real form, same tools and guards. Never on the public (Player) face.
  - With it, **per-organization control**: each organization's Program Manager turns the AI on or off for its exercises (Admin → Organization, audited, off by default), inside the instance switch; optionally the provider and region per organization.

### 11. Automated verification (Later)
- Generated frontend types from the OpenAPI export.

### 12. Instance administration (Later)
- Technical side: system logs UI, performance metrics, i18n language toggles.
- Delegated, narrower operator roles (e.g. read-only support), once an operator asks.
