---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-018"
kind: "artifact"
title: "Leak-site listing: the organization appears on the attackers' blog"
summary: "The ransomware group's leak-site page about the organization: a description of the stolen data, sample screenshots, a countdown to full publication and a message aimed at customers, employees and regulators."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware", "data_breach"]
capabilities: ["internal_external_comms", "regulatory_notification", "legal_forensics"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1657"]
attack_groups: []
related: ["KB-ART-001", "KB-ART-011", "KB-TRD-001"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "media"
actor: "threat-actor"
variables: ["organization", "sector", "data_type", "stolen_data_volume", "publication_countdown"]
variable_defaults: {"stolen_data_volume": "1.2 TB", "publication_countdown": "6 days 14 hours"}
---
# Leak-site listing: the organization appears on the attackers' blog

## Purpose
Makes the data theft public and puts a deadline on it. Usually reported by a threat-intelligence provider or a journalist, it tests whether the organization can assess the samples quickly, decide whether the listing triggers or changes notifications, prepare people whose data appears, and respond to media and regulators.

## Template
[Leak site -- new victim]

{organization} -- {sector}

Data size: {stolen_data_volume}
Status: publication in {publication_countdown}

{organization} ignored our offer and decided that the privacy of its customers and employees is not important. We have: {data_type}, contracts, financial statements, passports and payroll of employees, internal emails of management, network documentation and passwords.

Samples (screenshots): payroll spreadsheet (names partly visible), scanned identity documents, folder tree of the finance share, a signed contract.

Customers and employees of {organization}: ask them why they didn't protect your data. Regulators: they did not inform you.

Full archive will be available for download when the timer reaches zero.

## Variants
- **Before contact**: the listing appears before the organization even knew it was breached.
- **Partial release**: a first batch is published immediately to show seriousness, the rest on countdown.
- **Auction**: the data is offered for sale to the highest bidder instead of free publication.
- **Removed**: the listing disappears suddenly, raising suspicion that someone paid or that the data was sold.
- **In the Library**: TTX-Zone inject INJ-RAN-06, ready to copy into an MSEL.

## Realism notes
- Leak sites present victims with countdowns, sample screenshots and pressure messages aimed at third parties; claims about content are often exaggerated but samples are real.
- Listings commonly appear one to three weeks after the attack, or after negotiation breaks down.
- Publication can come before the organization has finished its own assessment of what was taken; samples help scope notifications.
- Expected good outcome: secure copies of samples through the threat-intelligence provider, identify the affected data sets, update notification decisions, prepare employee and customer messages, and avoid amplifying the listing.
