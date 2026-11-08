---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-019"
kind: "artifact"
title: "Business customer demands answers and threatens to suspend the contract"
summary: "A major business customer's security team sends a formal questionnaire after reading about the incident: were its data and connections affected, which indicators should it block, what is the timeline, and until when will the organization's access to its systems remain suspended."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["supply_chain", "data_breach", "ransomware"]
capabilities: ["third_party_supply_chain", "internal_external_comms", "legal_forensics"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-TRD-003", "KB-ART-003"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "email"
actor: "customer"
variables: ["organization", "customer", "response_deadline"]
variable_defaults: {"response_deadline": "within 24 hours"}
---
# Business customer demands answers and threatens to suspend the contract

## Purpose
Reverses the usual supply-chain view: here the organization is the third party that worries its customers. It tests whether the organization can share useful, accurate information with customers under legal constraints, who owns customer communication, and how to handle a customer cutting connections, which may hurt more than the attack.

## Template
Subject: Security incident at {organization} -- third-party risk questionnaire -- response required {response_deadline}

Dear {organization} team,

Following public reports of a cyber incident at {organization}, {customer} has activated its third-party incident procedure. As a precaution, we have suspended all network connections, VPN access and API integrations between our environments until further notice.

To assess our exposure and in accordance with the security clauses of our contract, please answer the following {response_deadline}:

1. What happened, when was it detected, and is it contained?
2. Were any {customer} data, credentials, or systems accessible to the attacker?
3. Were any of your staff accounts with access to {customer} systems compromised?
4. Please provide indicators of compromise (IP addresses, domains, file hashes) that we should block or search for.
5. Which forensic firm is investigating, and when will a written report be available?
6. Who is your single point of contact for this incident?

Failure to respond may lead us to review the continuation of our agreement.

Regards,
Third-Party Risk and Security Office, {customer}

## Variants
- **Many customers**: dozens of different questionnaires arrive the same day, each in its own format.
- **Regulated customer**: the customer is a bank or hospital that must itself notify its regulator and needs facts within hours.
- **Customer was hit**: the customer reports suspicious activity coming from the organization's connection.
- **Friendly call**: the customer's CISO calls informally first, asking for honest off-the-record context.
- **In the Library**: TTX-Zone inject INJ-SUP-07, ready to copy into an MSEL.

## Realism notes
- Customers routinely cut connections with an affected supplier first and ask questions later; restoring trust and access can take longer than technical recovery.
- Contracts often require notification within a fixed number of hours and cooperation with the customer's investigation.
- Sharing indicators early helps everyone; legal often slows it down.
- Expected good outcome: a single customer-communication owner, a standard factual update shared with all customers, indicators released quickly, and a clear path to reconnection.
