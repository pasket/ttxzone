---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-001"
kind: "artifact"
title: "Ransom note with leak-site countdown and legal pressure"
summary: "The note Players find on encrypted servers: claims of stolen data, a countdown before publication, a negotiation portal and a pseudo-legal warning about regulatory fines."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware", "data_breach"]
capabilities: ["crisis_decision_making", "regulatory_notification", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1486", "enterprise:T1657"]
attack_groups: []
related: ["KB-TRD-001"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-30"
stage: "escalation"
delivery_method: "document"
actor: "threat-actor"
variables: ["organization", "data_type", "attacker_group", "stolen_data_volume", "ransom_amount", "ransom_deadline", "leak_portal"]
variable_defaults: {"attacker_group": "a fictitious group name", "stolen_data_volume": "1.2 TB", "ransom_amount": "USD 4.5 million", "ransom_deadline": "72 hours", "leak_portal": "a fictitious hidden-service address"}
---
# Ransom note with leak-site countdown and legal pressure

## Purpose
The moment the incident becomes undeniable. The note turns a technical outage into an extortion crisis and forces the first big decisions: engage or not, who is allowed to read the portal, when to involve legal counsel, the insurer and the authorities, and what to tell staff who find the note on their screens.

## Template
To the management of {organization}:

Your network has been under our control for some time. Your servers are now encrypted and cannot be recovered without our key. Do not restart them and do not try to restore them yourselves: you will damage your data permanently.

Before encrypting we copied {stolen_data_volume} of your files, including {data_type}. We hold the full list and will prove it on request.

You have {ransom_deadline}. After that the files will be published on our blog, and your customers, partners and the press will be told where to find them.

Remember that a leak of this size must be reported to the data protection authority, and the fines can exceed what we are asking. A quick, private agreement is the cheaper option for everyone.

To receive a sample of your files and start negotiations, open {leak_portal} in an anonymizing browser and enter your personal ID. Our price is {ransom_amount}, payable in cryptocurrency.

Do not contact the police or recovery firms: they will waste your time and make the price higher.

-- {attacker_group}

## Variants
- **Pure extortion**: no encryption, the same message emailed straight to several executives, with a sample file attached as proof.
- **Physical letter**: a printed version mailed to the CEO, possibly by impostors claiming a known group's name; is it real?
- **Follow-up pressure**: a second message offering a discount for paying within 24 hours (INJ-RAN-05), or naming a specific customer whose data was taken.
- **Leak-site listing**: the organization's profile on the leak site with a visible countdown and a first sample (INJ-RAN-06).
- **In the Library**: TTX-Zone inject INJ-RAN-02, ready to copy into an MSEL.

## Realism notes
- Attackers drop hundreds of copies across encrypted systems; employees will see it before the crisis team does, so expect photos of it on social media.
- The tone is increasingly business-like and pseudo-legal, using notification duties and fines as leverage.
- Countdowns and published samples are standard; unpaid data is often actually published within weeks.
- Negotiation happens through a chat portal that can feel like customer service; real cases include discounts, deadline extensions and "proof of deletion" promises with no guarantee.
- Facilitator tip: give the note to the group as a handout, not read aloud, and watch who reaches for the deadline first.
