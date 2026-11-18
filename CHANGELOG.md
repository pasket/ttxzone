# Changelog

Notable changes to TTX-Zone, by release. Versions follow [Semantic Versioning](https://semver.org/). Before upgrading a deployment, read the release's entry and [Upgrade](https://docs.ttxzone.com/instance/upgrade/).

## [Unreleased]

### Changed
- **MITRE ATT&CK v20.1** is the release new exercises, TTX-Zone's scenarios, its inject catalog and the assistant's knowledge base use: 18 new techniques (9 Enterprise, 9 ICS) and two new groups (G1058, G1059). Nothing changes on its own: an existing MSEL and the organization's library stay on v19.2 and offer the update. Updating removes the two ICS techniques v20.1 deprecates (T0807, T0853) from what uses them, and says so. No database migration.
- **Creator → MSEL**: a newer ATT&CK version is no longer offered only at the foot of the Threat actors tab. A draft it changes nothing in moves to it when opened, with a message. Otherwise a notice above every tab says what the update would change in that MSEL, and an MSEL in review or ready keeps its status when nothing in it changes (before, updating always sent it back to draft). A technique kept under another tactic is now reported too.

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
