# Invitations, access requests and enrollment

## Model and rules
- A Planner generates an `InvitationToken` for one exercise, **for Players only** (`InvitationTokenCreateRequest` rejects the Planner role; Exercise Planners join through the planning team). Optional `description`, expiry ≤ 1 year (`MAX_TOKEN_LIFETIME`), optional `max_uses` (`None` = unlimited). `POST`/`GET /ttx/{ttx_id}/invitation-tokens`, `RequiresOrgAndTTXAccess(RoleEnum.PLANNER)`.
- It's a **shared join code**, not a secret: the plaintext is persisted (`InvitationToken.token`, unique) and stays retrievable in the audit list.
- **Redemption is approval-gated**: anyone holding the code redeems it (`POST /invitation-tokens/redeem`, with or without an existing account) and gets a **pending** `TTXAccessRequest` — never `TTXAccess` directly. Each redemption is recorded in `InvitationTokenRedemption` (uniqueness and `max_uses` accounting; `redemption_count <= max_uses` is enforced in the service, not yet a DB constraint). Redemption without a session *and* without account details answers 401 `NOT_AUTHENTICATED` (only an expired signed-in client sends none).
- A Planner approves (`POST /ttx/{ttx_id}/access-requests/{request_id}/approve` → creates `TTXAccess`) or rejects (`…/reject`); both 409 if already decided. `TTXAccessRequest.invitation_token_id` links the request to its token (per-token dashboard breakdown).
- Requests are never deleted, only transitioned (`pending`/`approved`/`rejected`), like `InvitationToken.revoked_at`. A new request is blocked while the user holds a `TTXAccess` on the exercise (`ALREADY_HAS_TTX_ACCESS`) or a `pending` request exists (`ACCESS_REQUEST_ALREADY_PENDING`). A request rejected less than 24 hours ago blocks too (`ACCESS_REQUEST_RECENTLY_REJECTED`, `REJECTION_COOLDOWN`, with any code for that exercise). An old `approved` one doesn't block, so a Player who left or was removed can try again, and a rejected user once the day has passed. Each needs another code, because `InvitationTokenRedemption` allows one redemption per token and user.
- Revoke: `DELETE /invitation-tokens/{token_id}` (idempotent, `require_ttx_role` against Planner). Audit: `GET /ttx/{ttx_id}/access-requests`. A user's own requests, any status: `GET /access-requests/me` (joined to exercise and organization names).
- Player requests are never domain-gated; the domain allowlist (`docs/features/admin.md`) only applies to Planner/Program Manager grants.
- Onboarding outcomes (redemption, approve/reject) are logged to `auth.log`.

## Email invitations
Personal invitations a Planner sends to addresses (`EmailInvitation`, `email_invitation_service`, template `email_invitation`). Unlike a join code, the link proves its holder reads that mailbox, so it grants the exercise **at once** -- no access request, no approval -- but only to the account with that address.
- **Offered only while the deployment sends email** and knows its public address (`account_email_service.available`; `GET /instance/policy`'s `email_invitations_available`). Otherwise the panel isn't shown and the API answers 409 `EMAIL_INVITATIONS_UNAVAILABLE`.
- **Sending**: up to 50 addresses at a time, each checked like any recipient (`email_service.normalize_address`, lower-cased, duplicates once). One outcome per address: `sent`; `resent` (it had a live invitation, which gets a new link); `already_player` and `on_team` (someone with a seat on the exercise gets nothing); `dropped` (the outbox's hourly limit for that address). The message is in the Planner's language (the invitee has no account yet) and names the Planner, the organization and the exercise.
- **The link**: `<PUBLIC_BASE_URL>/join#token=…`, valid 14 days (`INVITATION_TTL`). The token travels in the fragment; the database keeps its SHA-256 only. One live invitation per exercise and address: sending again or Resend replaces the link and the expiry (and brings back a withdrawn one). Withdraw (`revoked_at`) stops it. An accepted invitation stays as history.
- **Accepting** (`/join`, `JoinInvitationCard`): the page reads the token, takes it off the address bar and keeps it in the tab's `sessionStorage` (`lib/pendingInvitation.ts`) for a sign-in round trip (`LoginCard` and single sign-on come back to `/join` while it's there). `preview` shows the exercise, the organization and the masked address. Then:
  - signed in with the invited address: Join;
  - signed in with another one: 409 `INVITATION_OTHER_ACCOUNT`, and the page offers to sign out;
  - signed out, an account with that address exists: Sign in to join;
  - signed out, none: a form (name, password, legal acceptance) creates the account with the invited address and signs it in (`auth.register` with `via=invitation`).

  Accepting creates the `PLAYER` `TTXAccess` (`granted_by_id` = who sent it), marks the address confirmed (`email_verified_at`) and lands on the Playground. Logged to `auth.log`.
- **Lists**: Creator → Players → Invitations shows them under the join codes (address, status pending / joined / expired / withdrawn, sent by, sent, expires; Resend and Withdraw). Confirmed reads "Invited by email" for a Player who joined that way (`TTXPlayerRead.invited_by_email`).
- **Deletion**: deleting the exercise deletes its invitations. Deleting an account removes the invitations waiting for its address; accepted ones keep the account's link and lose the address. `email_invitation` counts as "invitations" in Platform's hard-delete dependency check.

## Creator → Players
The menu item is **Players**, an org-scoped route acting on the ContextBar's exercise. It has three tabs, shown with the page title by `creator/PlayersTabs`, keyed off `location.pathname`:
- **Confirmed** (`/creator/players`)
- **Pending** (`/creator/players/pending`), with a count pill (`PageTabs` `count`). The Pending page passes its live `total`; elsewhere the tabs fetch `access-requests?limit=1`.
- **Invitations** (`/creator/players/invitations`): the join codes, then the [email invitations](#email-invitations)

## Invitations (`CreatorInvitationsSection`, `/creator/players/invitations`)
- Acts on the ContextBar's `activeTtxId` (no local picker); `creator.invitations.noTtxMessage` when there's none.
- Create form: optional description, no role picker, an "Unlimited" checkbox (sends `max_uses: null`, disables the number), `expires_at` `max` = now + 365 days client-side.
- On creation the plaintext shows once in a dismissible callout with Copy (`navigator.clipboard.writeText`); every row also shows its token + Copy. The response is prepended to local state as an `InvitationTokenAuditRead`-shaped row and revoke patches `revoked_at` locally — no re-fetch. The table still shows the role of older, revoked Planner tokens (labels via `ROLE_LABEL_KEYS`).
- Actions column: Edit (only opens the tag-assignment `Modal` — a token has nothing else to edit) + Revoke (hidden once revoked).

## Pending (`CreatorAccessRequestsSection`, `/creator/players/pending`)
- Same context pattern; a decided row is filtered out locally. Shows the domain-not-allowed indicator and disables Approve for a non-allowlisted Planner-role request (`is_allowed_domain`, always true for Players). Approve/Reject is the one Actions column with a text button (auto width).

## Confirmed (`CreatorPlayersSection`, `/creator/players`)
- The end of the invite → approve funnel: the exercise's `PLAYER` rows, from `GET /ttx/{ttx_id}/players` (`ttx_player_service.players_view`, Planner, design). The team is never listed here; it's on Creator → Exercise.
- Columns: Player (name, email), Joined (`TTXAccess.created_at`), Invitation (the token description of the latest approved request; "Added directly" when there is none, for example a fixture), Room (`CodeRef`, only while `uses_rooms`), Last login, Actions. Search and sort run client-side (`filterAndSortPeople`, URL prefix `players_`).
- Remove: trash `IconButton` + `useUndoableAction`, then `DELETE /ttx/{ttx_id}/players/{user_id}`. It deletes the access row with its tags and seat, and logs to `app.log`. Only `PLAYER` rows can be removed (anything else answers 404 `PLAYER_NOT_FOUND`). There is no step-up: the Player can come back with another code and a new approval.

## Confirmation screens
`WaitingRoom.tsx` shows "request submitted, awaiting approval" naming the organization (`InvitationTokenRedeemResponse.organization_name`/`ttx_name`). `RegisterCard.tsx`'s token flow navigates with `state: { justRequestedAccess: true, organizationName }` so the same confirmation shows when redemption happened during registration.

## Playground → My exercises (`EnrollmentsSection`, `/playground/enrollments`, org-scoped, Players only)
A Player's self-service panel: enrolled exercises (`ttxOptionsForModule('execution', ttxList)` filtered to `role === 'player'`), a join-with-token form usable at any time (same `POST /invitation-tokens/redeem`), the pending-requests list (`GET /access-requests/me`), and **Request to leave** per row: a Player never leaves on their own. A dialog with an optional reason (`LeaveRequestDialog`) sends `POST /ttx/{ttx_id}/leave-request`; the row then reads "Leave requested" (`GET /leave-requests/me`). The exercise's Planners decide in Creator → Players → Pending, in a **Requests to leave** panel under the join requests (`LeaveRequestsPanel`; the Pending tab counts both): Approve takes the Player out, Reject (with Undo) keeps them in. Removing the Player from Confirmed closes a pending request as approved.
