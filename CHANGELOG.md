# Changelog

Notable changes to TTX-Zone, by release. Versions follow [Semantic Versioning](https://semver.org/). Before upgrading a deployment, read the release's entry and [Upgrade](https://docs.ttxzone.com/instance/upgrade/).

## [Unreleased]

### Added
- **AI assistant**: it reads one inject in full (`get_inject`) and the MSEL with each inject's recipients, rooms and where a contingent one branches; a long MSEL can be read by phase or by inject.
- **AI assistant**: an inject proposal can carry the artifact it's drawn as (email, press release, social media post, chat message), what would be attached, and its rooms.
- **AI assistant**: proposals for the needs analysis' context (motivation, triggers, levels, date window, stop keyword) and for the risks to the exercise, with a search of TTX-Zone's risk library; an objective proposal can say what achieved, partially achieved and not achieved look like.
- **AI assistant**: values for the placeholders an exercise template left unfilled. Accepting the proposal opens "Fill them in…" with the proposed values to review.
- **AI proposals**: Discard asks first and takes an optional reason and note, which the assistant reads before proposing again.
- **Creator → MSEL → Review**: a design review reads the saved design as one chain, from the needs to the observation points. It names what's missing (an objective no inject tests, an inject without expected actions, an empty phase), the long stretches with no timed inject and the threat actors' techniques no inject uses. It blocks nothing. The AI assistant reads the same review.
- **Admin → Organization**: "Context for exercise design" takes the organization's sector, size, regulators, technologies and critical assets in its own words. Where the AI assistant is on, the Exercise Planners' AI client reads it so proposals fit the organization.
- **Ask the AI assistant** from the needs analysis, the MSEL and the session plan: leave a request about the document or one of its rows; your AI client reads it the next time you work with it, and its proposals come back marked as the answer.
- **AI assistant**: proposals for the session plan's texts (the invitation, briefing and session notes, how data is collected).
- **Admin → Organization**: "AI assistant" chooses the roles your organization leaves the assistant on for: Exercise Program Managers, Exercise Planners, Controllers and Facilitators, Evaluators. Existing organizations keep what they had (Program Managers, Planners and Evaluators); Controllers and Facilitators start off.
- **AI assistant for other roles**: an Exercise Program Manager reads the programme (what was exercised, what never was, overdue actions); a Controller or Facilitator reads the MSEL in running order before the session, to rehearse it or write the Facilitator's script; an Evaluator reads the EEGs they rate and, after the session, their own notes. Never while a session is in play. Each person's client is offered only the tools of their roles.
- **AI assistant**: it can propose a new exercise, reviewed in Creator → New exercise, and injects for the organization's Library, reviewed in Library → Injects.
- **Preferences → AI assistant**: the configuration for AI clients that connect over HTTP themselves, with no Node.js bridge.
- **API**: `GET|PUT /organizations/{id}/assistant`, `GET /organizations/{id}/assistant/proposals` and `POST …/{id}/applied|discard`.
- **API**: `GET /ttx/{id}/design-review`, `GET|PUT /organizations/{id}/context`, `GET|POST /ttx/{id}/assistant/requests` and `DELETE /ttx/{id}/assistant/requests/{id}`.

### Changed
- **API**: `POST /ttx/{id}/assistant/proposals/{id}/discard` takes an optional `{reason, note}`. This release includes database migrations (`0004` to `0008`), applied when the backend starts.

## [0.3.0] - 2026-11-20

### Added
- **Creator → New exercise**: start from an exercise template. Pick one of TTX-Zone's or the organization's from a searchable list, or import a `.ttx.md` file.
- **Exercise templates**: placeholders say what they stand for. Format version 9 adds a `placeholders` block with a description and a suggested value for each, and TTX-Zone's templates with several placeholders declare them. Copying a template onto an exercise shows each placeholder's description, its suggested value and where it appears; a suggested value is only offered, never applied on its own.
- **Creator → MSEL**: a placeholder nobody filled in is marked on its inject's row and raises a warning that never blocks (M31). Review lists the ones left anywhere in the exercise and "Fill them in…" replaces them across it in one step.
- **Several rows at once**: tick boxes and a selection bar in Players → Pending (approve or reject), Players → Confirmed (remove) and both lists of exercises (archive or unarchive). An action that takes rows away asks first, naming them; a row that fails doesn't stop the others.
- **Admin → Exercises**: an Exercise Program Manager opens any exercise of the organization read-only (profile, needs analysis, MSEL, session plan and after-action report), with or without a seat on its team, and "Documents" on each row downloads its PDFs.
- **Control center**: "View as Player" shows the planning and control team exactly what a room's Players see, read-only and without being marked present.
- **Exercise team**: an Exercise Program Manager grants a person's missing organization role from the team dialog, and under the single and managed tenancy rules adds someone new from the allowed domains there. The exercise's profile shows its team and rooms without entering the edit mode.
- **Admin → Users and roles → Add a person**: under the single and managed tenancy rules, the email field suggests the allowed-domain accounts that hold no role yet, by name or email.
- **Playground → My exercises**: a Session column says where each exercise's session stands, the exercise selector marks the one in play, and whoever takes part in an exercise in play lands on it on arrival.
- **After-action report**: an index of its parts with where each stands and the Draft → Final track, and the line with the exercise's code, version, status and TLP the other documents have. Marking it as final asks first, naming the objectives without a level and the empty conclusions; a final report reads as text until it is reopened.
- **Preferences**: each account corrects its own name; the change is recorded in the activity log.
- **Keyboard**: Cmd/Ctrl+Enter commits a dialog's form and "/" takes the focus to a list's search. Neither applies in the Control center.
- **API**: `PUT /auth/name`, `GET /ttx/{id}/placeholders`, `POST /ttx/{id}/placeholders/fill`, `POST /ttx/{id}/access-requests/decide`, `POST /ttx/{id}/players/remove`, `POST /ttx/archive-many`, and `GET /ttx/{id}/run?preview=player`. `GET /ttx` also carries each exercise's `run_state` and `session_date`.

### Changed
- **MITRE ATT&CK v20.1** is the release new exercises, TTX-Zone's exercise templates, its inject catalog and the assistant's knowledge base use: 18 new techniques (9 Enterprise, 9 ICS) and two new groups (G1058, G1059). Nothing changes on its own: an existing MSEL and the organization's library stay on v19.2 and offer the update. Updating removes the two ICS techniques v20.1 deprecates (T0807, T0853) from what uses them, and says so. This update needs no database migration of its own.
- **Creator → MSEL**: a newer ATT&CK version is no longer offered only at the foot of the Threat actors tab. A draft it changes nothing in moves to it when opened, with a message. Otherwise a notice above every tab says what the update would change in that MSEL, and an MSEL in review or ready keeps its status when nothing in it changes (before, updating always sent it back to draft). A technique kept under another tactic is now reported too.
- **Library**: the item that packages a whole exercise is now called an "exercise template" ("plantilla de ejercicio"); "scenario" is only the exercise's story. The API paths, the Library's URL, the `SCENARIO_*` error codes and the `.ttx.md` format keep their names.
- **Creator → Players** lives under the exercise's own URL (`/creator/{exercise}/players`), so a shared link opens the sender's exercise. The earlier URL redirects.
- **Phones and tablets**: the Playground and the Control center show the stage and the panel side by side from 768 px. On a phone only the EXERCISE strip with the stop keyword stays at the top, wide tables (needs analysis, MSEL, improvement plan) scroll inside their panel, and the bottom menu shows an icon over one word and scrolls sideways.
- **Control center**: starting the exercise asks first and says how many Players are present; the inject that is due has the one named button, "Release"; an action that fails says why in its own dialog; ending the exercise is confirmed as an action that can't be undone; the inject in play stays beside the panel while it scrolls; once the session is over, a link leads to the report.
- **Lists**: filters sit in one row under the panel's header, each under its visible label.
- **AI assistant**: with several proposals only the first shows its changes; "Accept all" is the panel's main action, a proposal names the row it changes with its code and title, and a notice says when an accepted one is in the form.
- **Playground → Evaluation**: with every point on screen each objective folds and says how many of its points are rated.
- **Admin → Organization**: deleting the organization is a panel of its own at the end of the edit page.
- **Browser tabs** are named after the page and, on an exercise's pages, the exercise.
- **Library**: its form dialogs ask before discarding what was typed.
- **Platform → Activity log**: an entry names its exercise by code and name, as the rest of the application does.
- **Spanish**: "Borrar" for Delete and "Quitar" for Remove everywhere, "Terminar" for ending an exercise, and a contingent inject is "activated" rather than released.
- **Database**: one migration (`0003`), applied when the backend starts.

### Fixed
- **Library**: sixteen TTX-Zone exercise templates ran sixty times faster than written, so the storyline and the session clock drifted days away from their situation updates. They now run in real time within each phase; phases and deadlines are unchanged.
- **Legal documents** published while someone was signed in left every screen refusing to work with no way to reach them. A banner now says what to accept and links to Preferences → Privacy, where each document is accepted on its own.
- **Stop keyword**: it is accepted without accents, in any case and with spare spaces, so "pinzon de hierro" pauses an exercise whose keyword is "PINZÓN DE HIERRO".
- **Creator → MSEL**: the injects table no longer squeezes an inject's title to one letter per line on a narrow screen, and two storyline labels that fell under AA contrast are readable.
- **Dialogs**: closing one returns the focus to what opened it, and the Control center keeps the focus after an action instead of dropping it to the page.
- **Platform → Accounts**: the list no longer moves under the pointer when the first account is ticked.

### Security
- Frontend image: Nginx 1.30.7 (CVE-2026-113425, CVE-2026-121810, CVE-2026-123007, CVE-2026-123633, CVE-2026-118899, CVE-2026-123634). The image now takes Nginx's own fixes at every build, not only Alpine's.

## [0.2.0] - 2026-11-15

### Added
- **Library**: the TTX-Zone scenario "Black Friday eve: operations continuity when a critical third party goes down" (`black-friday-suite-outage`, English and Spanish). A business continuity exercise for a crisis committee chaired by the business: a retailer loses its productivity suite to a public provider outage on the eve of a sales peak. Polls that move four impact meters, three contingent injects (one fired by the Controller), simulated artifacts and six illustrations; the suggested placeholder values are in its first inject's facilitator notes.
- **AI assistant**: knowledge base case `KB-CAS-011`, a productivity suite provider's global outage, which the scenario plays.

### Fixed
- **Library**: in thirteen TTX-Zone scenarios, an expected action whose deadline ran past the end of its phase now ends with it, so they open with no MSEL warning.

### Security
- `dnspython` 2.9.2 (CVE-2026-128089: excessive memory and CPU use).

## [0.1.0] - 2026-11-09

First release.

### Added
- **Creator**: needs analysis, MSEL with timed and contingent injects, discussions and polls, storyline map, session plan with definitive EEGs, session documents, and the after-action report and improvement plan.
- **Control and Playground**: the live session with a panel for each role, rooms that each get their own key questions, notes and ratings, polls with their consequences and impact meters, the table's decision log, live evaluation and the feedback form.
- **Admin**: organization profile, users and roles, exercise portfolio, allowed domains, dashboard, library and improvement plan.
- **Library**: TTX-Zone scenarios and injects, simulated and threat actors, MITRE ATT&CK data, `.ttx.md` import and export.
- **Instance administration**: tenancy rule, accounts, activity log with SIEM forwarding, sign-in security, legal documents, outgoing email, single sign-on.
- **Accounts**: TOTP and email second factors, password reset, email confirmation, personal invitations, OpenID Connect sign-in, limits on failed sign-ins by account and address.
- **AI assistant**: an MCP endpoint with personal access tokens, read tools and proposals a person accepts or discards, for the design (an MSEL from scratch included: phases, simulated actors and threat actors, then injects on them; the session plan's observation points) and for the after-action report, where each one cites what of the session backs it; the Library's scenarios, past exercises and the improvement plan to learn from; guided flows (MCP prompts), an exercise's documents to attach (resources) and suggestions for their arguments; the scope, deletions, dry runs with their balance, a step-by-step plan to close each document, named changesets, the TLP in every answer and accepted or discarded proposals in the activity log.
- **Deployment**: production images for `linux/amd64` and `linux/arm64`, published to GHCR on release tags, process roles, a public face for Players, and reference Compose files with a TLS reverse proxy: one Docker host (`deploy/`), and the public face on a separate host in a DMZ (`deploy/public-host/`).
- English and Spanish throughout, dark and light themes.
- **Documentation**: a site with a user guide, instance administration (deployment models, network and ports included), the API reference and a contributing section (`docs/site/`), published at docs.ttxzone.com.
- Accessibility: the main screens of every module checked with axe for WCAG 2.2 A and AA, on both themes.
