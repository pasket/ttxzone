---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-015"
kind: "artifact"
title: "Customer's viral social media complaint during an outage"
summary: "A frustrated customer posts that the organization's service has been down for a day, that nobody answers the phone, and that they received a suspicious email with their own account details; thousands share it and others add similar stories."
language: "en"
sectors: ["cross-sector", "retail-ecommerce", "finance"]
families: ["generic", "data_breach", "ransomware"]
capabilities: ["internal_external_comms", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-CAS-002", "KB-ART-005"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "media"
actor: "customer"
variables: ["organization_short", "critical_service", "outage_duration", "share_count"]
variable_defaults: {"outage_duration": "more than 24 hours", "share_count": "4,800"}
---
# Customer's viral social media complaint during an outage

## Purpose
Shows the incident from the customer's side and forces the communications team to act in public, in real time. It tests whether social media is monitored, who can answer and with what message, how the organization handles a claim that customer data has leaked, and whether the customer service line was prepared.

## Template
Post by a customer (verified account, 12k followers) -- shared {share_count} times in 3 hours

{critical_service} at @{organization_short} has been down for {outage_duration}. Can't log in, can't pay, can't get my order. Called customer service 6 times: "high call volume", then the line drops.

And now the best part: this morning I got an email with my FULL account details -- name, address, last orders -- asking me to "confirm my card" on a weird website. Did you get hacked?? Why haven't you told us anything???

Anyone else? #{organization_short}down

Top replies:
- "Same here. Got the same email with my phone number in it."
- "They will say 'no evidence of data access' as usual."
- "My bank just blocked my card after a payment I never made."

## Variants
- **Influencer**: the post comes from a well-known personality and reaches mainstream news within hours.
- **Employee reply**: a staff member answers from their personal account with internal details.
- **False claim**: the leaked-data claim is wrong (the phishing used an old, unrelated breach), but customers believe it.
- **Competitor**: a competitor posts a thinly veiled ad offering "secure" service to unhappy customers.
- **In the Library**: TTX-Zone inject INJ-GEN-05, ready to copy into an MSEL.

## Realism notes
- Customers notice outages and phishing before most press releases; the first public narrative is theirs.
- Attackers and opportunistic fraudsters often run phishing against a victim's customers during an incident, using stolen or public data.
- Saying nothing on social media is read as confirmation; an early factual message reduces speculation even without answers.
- Expected good outcome: acknowledge publicly, warn customers about phishing, give a channel for updates, align customer service scripts, and verify the data-leak claim quickly.
