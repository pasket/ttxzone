---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-011"
kind: "artifact"
title: "First messages in the attackers' negotiation chat"
summary: "The opening of a ransomware negotiation on the attackers' portal: a scripted 'support' greeting, a ransom sized to the victim's revenue and insurance, a free test decryption, a sample of stolen files, a discount for paying quickly and a countdown to publication."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware", "data_breach"]
capabilities: ["crisis_decision_making", "legal_forensics"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1486", "enterprise:T1657"]
attack_groups: []
related: ["KB-ART-001", "KB-ART-008", "KB-TRD-001"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "chat"
actor: "threat-actor"
variables: ["data_type", "stolen_data_volume", "ransom_amount", "discount_window", "victim_id"]
variable_defaults: {"stolen_data_volume": "620 GB", "ransom_amount": "4.5 million in cryptocurrency", "discount_window": "72 hours", "victim_id": "a91c-7d"}
---
# First messages in the attackers' negotiation chat

## Purpose
Puts Players face to face with the adversary. It tests whether anyone is authorized to open the chat at all, who speaks, with what mandate, whether the insurer and legal are involved, and how the organization uses the conversation (buying time, gathering proof of what was stolen) without committing to pay.

## Template
[Negotiation portal -- client ID {victim_id}]

Support: Hello. You are talking to the support team. Your network has been encrypted and we have downloaded {stolen_data_volume} of your data, including {data_type}. We are professionals and keep our word.

Support: We studied your company's revenue and your cyber insurance policy. Our price for decryption and permanent deletion of your data is {ransom_amount}. If you pay within {discount_window} you receive a 30 % discount.

Support: To prove we can decrypt, send us 2 files under 5 MB that don't contain databases. We will return them decrypted for free.

Support: Here is a list of folders we have: Finance/Payroll, Legal/Contracts, HR/Employees, Customers/Exports. Ask for any 3 files as proof.

Support: The timer on our blog shows when your data will be published. Regulators and your customers will see it. Do not waste time with recovery companies -- they will charge you more than us.

## Variants
- **Silent attackers**: the portal stays open but nobody answers for a day.
- **Lawyer button**: the portal offers a "call a lawyer" option, with messages about regulatory fines for not paying.
- **Price drop**: after the organization says it cannot pay, the price falls by half, then again.
- **Data-only**: no encryption at all, only the threat to publish (pure extortion).
- **In the Library**: TTX-Zone inject INJ-RAN-13, ready to copy into an MSEL.

## Realism notes
- Negotiation portals look like customer-support chats with countdowns, sample downloads and victim pages; the tone is polite and businesslike.
- Ransom demands are often calibrated to revenue and, when found in the stolen files, to the insurance policy limit.
- Affiliates keep most of the ransom (around 80 to 90 %); payment does not guarantee deletion, and most organizations with working backups now refuse to pay.
- Paying may be illegal if the group is sanctioned; insurer consent and legal review come first.
- Expected good outcome: no improvised contact; a decision on whether to engage, with a mandate; a specialist negotiator if engaging; proof requested; every message logged.
