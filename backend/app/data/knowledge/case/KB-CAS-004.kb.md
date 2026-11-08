---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-004"
kind: "case"
title: "Zero-day in a managed file-transfer platform: hundreds of victims, extortion by email"
summary: "An extortion group exploits a zero-day in a widely used file-transfer product, copies data from hundreds of organizations in days, and weeks later emails their executives threatening to publish, without ever encrypting anything."
language: "en"
sectors: ["cross-sector", "transport-logistics", "ot-manufacturing"]
families: ["data_breach", "supply_chain"]
capabilities: ["regulatory_notification", "legal_forensics", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1190", "enterprise:T1505.003", "enterprise:T1219", "enterprise:T1041", "enterprise:T1657"]
attack_groups: ["G0092"]
related: ["KB-TRD-005", "KB-TRD-003", "KB-ART-001"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Zero-day in a managed file-transfer platform: hundreds of victims, extortion by email

## Archetype
Any mid-sized or large organization that exchanges files with customers, suppliers and logistics partners through a commercial managed file-transfer (MFT) server exposed to the internet: transport companies, manufacturers, food producers, health providers. The extortion group, the one ATT&CK tracks as TA505, acquires a zero-day for the product and runs a campaign against every exposed server. The same group repeats the playbook against other file-transfer and ERP products across the period.

## Relative timeline
- **Day 0 to day 5**: automated exploitation of exposed servers worldwide; web shells or new accounts are planted; files are copied in bulk. Victims notice nothing.
- **Day 3 to day 10**: security researchers spot the exploitation; the vendor publishes an advisory and an emergency patch; customers start patching and hunting.
- **Weeks 2 to 6**: the group processes the stolen data; it announces the campaign on its leak site and threatens to publish victims' names.
- **Weeks 3 to 8**: extortion emails reach executives of each victim with a list of stolen files and a link to the negotiation portal.
- **After the deadline**: names and data of non-paying victims are published in batches; media coverage lists the best-known victims.

## Decision points
- Advisory day: take the platform offline (stopping partner exchanges) or patch and keep running?
- Compromise assessment: with limited logs on the appliance, can we prove what was or wasn't taken?
- When the extortion email arrives weeks later: real or opportunistic? Which data, whose data?
- Which notifications are due (data protection authority, sector regulator, affected customers), and when did the clock start?
- Pay to keep the name off the list, or accept publication?
- Coordinate with other victims, partners and the vendor, or act alone?

## Impacts
- Theft of operational documents, engineering data, partner exchanges and personal data from hundreds of organizations.
- No operational disruption from the attack itself, but disruption from emergency shutdowns of the platform.
- Regulatory notifications and customer communications across several countries.
- Reputational damage when listed publicly among the victims.

## Lessons
- File-transfer and ERP platforms are high-value, exposed and poorly monitored: keep them off the internet where possible and keep their logs.
- Know which data passes through them and how long it is stored; retention limits reduce what can be stolen.
- Have a decision ready for "the vendor says it's being exploited" before it happens.
- The extortion contact can arrive weeks after the breach: compromise assessments must look back far enough.
- Supplier contracts should require timely advisories, indicators and cooperation.

## Inject ideas
- The vendor's security advisory: active exploitation of the version in use, patch available (with no detail on impact).
- A partner asks whether the files they sent through the platform are safe.
- The SOC finds an unknown administrator account on the platform, created days ago.
- Weeks later, the CFO receives an extortion email listing folders and file names (KB-ART-001, variant "pure extortion").
- A journalist asks whether the organization is among the victims named on the leak site.
- **In the Library**: the TTX-Zone scenario "data-extortion" plays this case end to end.
