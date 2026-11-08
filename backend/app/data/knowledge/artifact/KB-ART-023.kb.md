---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-023"
kind: "artifact"
title: "Executive situation report, version 1"
summary: "The incident lead's first written situation report for the executive committee: what is known, unknown and decided, business impact in plain terms, decisions needed now and the next update time; written in a hurry, with some gaps and technical jargon left in."
language: "en"
sectors: ["cross-sector"]
families: ["generic", "ransomware"]
capabilities: ["crisis_decision_making", "internal_external_comms", "cross_unit_coordination"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-ART-016", "KB-ART-017"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "document"
actor: "insider"
variables: ["organization_short", "critical_service", "critical_system", "next_update"]
variable_defaults: {"next_update": "18:00 today"}
---
# Executive situation report, version 1

## Purpose
Gives the executive committee a realistic document to work from and improve. It tests whether leaders can extract the decisions they own from a technical report, ask for what's missing (business impact, options, costs), and agree on a reporting rhythm. It also works as a model for Players to produce their own updates.

## Template
{organization_short} -- INCIDENT SITUATION REPORT -- v1 -- CONFIDENTIAL

1. Situation
Ransomware detected at 06:40. Encryption confirmed on servers supporting {critical_system}. {critical_service} unavailable since 07:15. Email and identity platform working. Network segment isolated; remote access disabled for all staff.

2. What we know / don't know
Known: entry point probably remote access with a contractor account; data exfiltration likely (large outbound transfer last night).
Unknown: full scope; whether backups are usable (assessment in progress); whether personal data was taken.

3. Business impact
{critical_service} down; customers cannot place orders. Estimated revenue impact: not yet assessed. Staff working on paper where possible.

4. Actions taken
External IR firm engaged. Insurer notified. Police not yet contacted. No contact with attackers.

5. Decisions needed from the executive committee
a) Approve keeping remote access disabled for at least 48 hours.
b) Decide on initial notification to the competent authority (deadline approaching).
c) Agree on a spokesperson and the holding statement (draft attached).
d) Mandate on any contact with the attackers.

6. Next update: {next_update}

## Variants
- **Too technical**: a version full of hostnames, hashes and log extracts, with no business impact or decisions.
- **Optimistic**: the report says restoration "within 24 hours" without any basis.
- **Conflicting numbers**: the impact estimate differs from the figures finance has given the board chair.
- **Missing owner**: decisions are listed, but nobody is named to carry them out.
- **In the Library**: TTX-Zone inject INJ-GEN-07, ready to copy into an MSEL.

## Realism notes
- Effective executive reporting translates technical facts into impact on revenue, operations, reputation and legal exposure, and lists decisions with deadlines.
- Separating known, unknown and assumed facts prevents later accusations of misinformation.
- A fixed update rhythm reduces interruptions to the technical team.
- Expected good outcome: decisions taken and recorded with owners, missing information requested explicitly, next update confirmed, and the report reused as the basis for external communication.
