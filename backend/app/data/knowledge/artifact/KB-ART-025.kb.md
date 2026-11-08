---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-025"
kind: "artifact"
title: "Supplier declines to hand over logs for the investigation"
summary: "A supplier that hosts part of the organization's service replies to a request for logs that it can share only a summary, after a legal review, in about ten days; its own logs cover seven days and its contract only promises 'reasonable cooperation'."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["supply_chain"]
capabilities: ["third_party_supply_chain", "legal_forensics", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-ART-021", "KB-ART-003", "KB-TRD-003"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "email"
actor: "critical-supplier"
variables: ["organization", "supplier", "product", "log_retention"]
variable_defaults: {"log_retention": "7 days"}
---
# Supplier declines to hand over logs for the investigation

## Purpose
Exposes the gap between what an investigation needs and what contracts actually guarantee. It tests whether the organization can obtain evidence from third parties, how it documents its regulatory obligations when facts depend on someone else, and who escalates commercially and legally.

## Template
Subject: RE: Urgent request for logs -- {organization} incident

Dear customer,

We understand the urgency of your request for access logs, administrator activity and network flows related to your tenant on {product}.

Please note that our platform is shared by many customers, and raw logs may contain information about other clients. For confidentiality reasons we cannot provide them directly. Our security team can prepare a summary of relevant events once our legal department has reviewed the request, which we expect to take approximately ten business days.

We would also like to inform you that, in line with our standard configuration, detailed logs are retained for {log_retention}. Events older than that are no longer available.

Under the terms of our agreement, {supplier} provides reasonable cooperation in the event of a security incident. If you require additional forensic services, these can be offered under a separate statement of work.

Kind regards,
Customer Success
{supplier}

## Variants
- **No reply**: the supplier simply doesn't answer for three days.
- **Regulator involved**: the competent authority asks the organization for facts that only the supplier holds.
- **Partial help**: the supplier offers a call with its security lead, but nothing in writing.
- **Contract clause**: legal finds the contract does include an audit and information clause; will invoking it damage the relationship?
- **In the Library**: TTX-Zone inject INJ-SUP-06, ready to copy into an MSEL.

## Realism notes
- Missing or short-retained logs are among the most common obstacles in investigations; default retention on appliances and services is often 24 hours to 7 days.
- Suppliers cite multi-tenancy and confidentiality; contracts rarely define timelines or formats for incident cooperation.
- The organization's notification obligations don't pause while it waits for the supplier.
- Expected good outcome: formal written request citing the contract, escalation to account and executive level, preservation request for remaining logs, documentation of the delay for regulators, and contractual lessons recorded.
