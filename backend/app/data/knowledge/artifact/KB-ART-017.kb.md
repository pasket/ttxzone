---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-017"
kind: "artifact"
title: "Draft holding statement awaiting approval"
summary: "The communications team's first draft of a public statement on the incident, sent to the crisis committee for approval: mostly sensible, but with a few phrases that promise too much, speculate or contradict what legal and the technical team know."
language: "en"
sectors: ["cross-sector"]
families: ["generic", "ransomware", "data_breach"]
capabilities: ["internal_external_comms", "crisis_decision_making", "legal_forensics"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-ART-005", "KB-ART-010", "KB-ART-015"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "document"
actor: "insider"
variables: ["organization", "critical_service", "approval_deadline"]
variable_defaults: {"approval_deadline": "in 30 minutes"}
---
# Draft holding statement awaiting approval

## Purpose
Gives Players something concrete to edit instead of writing from scratch. It tests whether the crisis committee can review and approve a public text quickly, spot risky claims, align communications with legal and the technical facts, and agree on who publishes and where.

## Template
DRAFT -- for approval by the crisis committee {approval_deadline} -- not for distribution

Statement from {organization}

{organization} has detected a cybersecurity incident affecting some of its systems. As soon as we became aware of it, we activated our response protocols and, as a precaution, temporarily disconnected certain services, including {critical_service}.

We are working with leading external experts and have informed the competent authorities. Our investigation is ongoing.

At this stage there is no evidence that customer data has been affected. We expect all services to be fully restored within 48 hours.

The attack appears to have been carried out by a sophisticated foreign group. We will not negotiate with criminals.

We apologize for any inconvenience and thank our customers for their patience. We will provide updates on our website.

Communications Department

## Variants
- **Legal rewrite**: legal returns a version so cautious it says nothing; communications objects.
- **Two drafts**: the business unit and corporate communications each prepare a different text.
- **Already leaked**: the draft is forwarded outside before approval and quoted by a journalist.
- **Regulator check**: the authority asks to see the statement before publication because the incident affects an essential service.
- **In the Library**: TTX-Zone inject INJ-GEN-06, ready to copy into an MSEL.

## Realism notes
- Common pitfalls: "no evidence that data was affected" before the investigation can know, firm restoration times, attribution, absolute statements about ransom payment.
- A good holding statement says what happened in plain words, what is being done, what customers should do (for example, beware of phishing), and when the next update will come.
- Approval chains that need many signatures turn 30 minutes into hours; agree on a fast path in advance.
- Expected good outcome: remove the risky phrases, add practical advice, approve within the deadline, and publish through agreed channels with a single spokesperson.
