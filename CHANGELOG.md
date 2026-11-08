# Changelog

Notable changes to TTX-Zone, by release. Versions follow [Semantic Versioning](https://semver.org/). Before upgrading a deployment, read the release's entry and [Upgrade](https://docs.ttxzone.com/instance/upgrade/).

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
