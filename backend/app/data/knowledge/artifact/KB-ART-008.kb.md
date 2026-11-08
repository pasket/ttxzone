---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-008"
kind: "artifact"
title: "Cyber insurer acknowledges the claim and sets its conditions"
summary: "The insurer's reply to the first notice of a cyber incident: it assigns a claim number, imposes its panel response firm, reminds the organization not to pay or negotiate without consent, reserves its position on exclusions, and asks for evidence of the security controls declared in the policy."
language: "en"
sectors: ["cross-sector"]
families: ["generic", "ransomware"]
capabilities: ["crisis_decision_making", "legal_forensics", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-ART-001", "KB-ART-011"]
source_class: "trade-magazine"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "email"
actor: "cyber-insurer"
variables: ["organization", "claim_number", "policy_number", "panel_firm", "evidence_deadline"]
variable_defaults: {"claim_number": "CY-25-008812", "policy_number": "CPL-4471-09", "panel_firm": "the insurer's appointed incident response firm", "evidence_deadline": "within 5 business days"}
---
# Cyber insurer acknowledges the claim and sets its conditions

## Purpose
Brings the insurer into the room as a stakeholder with its own interests. It tests whether the organization knows its policy conditions before the incident, whether it has already engaged a response provider the insurer doesn't accept, who talks to the insurer, and how the ransom decision depends on the insurer's consent. It also exposes the gap between the security controls declared at underwriting and reality.

## Template
Subject: Claim {claim_number} -- policy {policy_number} -- {organization} -- acknowledgement and next steps

Dear Sir or Madam,

We acknowledge receipt of your notification of a cyber incident under policy {policy_number}. Claim number {claim_number} has been assigned. Please quote it in all correspondence.

In accordance with the policy conditions:

1. Incident response services must be provided by {panel_firm}, who will contact you within two hours. Costs of providers not approved by us may not be covered.
2. No ransom or extortion payment may be made, offered or negotiated without our prior written consent. Any contact with the threat actor should be coordinated with the negotiation specialist we appoint.
3. Please preserve all evidence and logs, and do not rebuild affected systems before the forensic team has captured what it needs.
4. We reserve our position regarding coverage, including the exclusions for acts of war or state-sponsored operations and for known vulnerabilities left unpatched beyond the periods stated in the policy.

To assess the claim, please provide {evidence_deadline}: evidence that multi-factor authentication was enforced for remote and privileged access as declared in your proposal form; your backup policy and the date of the last successful restore test; and a list of critical suppliers involved.

Kind regards,
Cyber Claims Team

## Variants
- **Provider conflict**: the organization already engaged its own response firm hours ago; the insurer says those costs won't be covered.
- **Attribution exclusion**: a government statement attributes a similar campaign to a state; the insurer signals the war exclusion may apply.
- **Declared controls**: evidence shows MFA was not enforced on the VPN, contrary to the proposal form.
- **Sub-limits**: the insurer points out that business interruption and extortion are subject to sub-limits far below the losses.
- **In the Library**: TTX-Zone inject INJ-RAN-07, ready to copy into an MSEL.

## Realism notes
- Insurers routinely require use of panel providers, consent before any payment and early notice; late notice can itself jeopardize cover.
- Claims are often reduced or refused when declared controls were not in place; trade sources put refusals at a significant share of claims.
- Attackers sometimes look for the victim's insurance policy in file shares to size the ransom demand: a useful twist for a later inject.
- Expected good outcome: a single owner for the insurer relationship, legal reviewing the policy, early agreement on providers, and no payment discussion without consent.
