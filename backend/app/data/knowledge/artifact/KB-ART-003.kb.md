---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-003"
kind: "artifact"
title: "Supplier security notification with few details"
summary: "The email a critical supplier sends its customers after detecting a compromise: careful legal wording, a vague timeline, no confirmation of which customer data was affected, and a request not to share it."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["supply_chain", "data_breach"]
capabilities: ["third_party_supply_chain", "regulatory_notification", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1199", "enterprise:T1528"]
attack_groups: []
related: ["KB-TRD-003", "KB-CAS-004"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "email"
actor: "critical-supplier"
variables: ["organization", "supplier", "product", "detection_window", "advisory_reference"]
variable_defaults: {"detection_window": "between six and two weeks ago", "advisory_reference": "SA-2025-014"}
---
# Supplier security notification with few details

## Purpose
Starts a third-party scenario from outside the building. The information is partial, the language is defensive and the facts belong to someone else, so Players have to decide what to assume, what to ask, whether it's reportable and whether to cut the supplier's access, all without certainty.

## Template
Subject: Security notice for {organization} -- reference {advisory_reference} -- confidential

Dear customer,

We are writing to inform you that {supplier} recently identified unauthorized activity affecting part of the environment that supports {product}. Upon detection, we activated our incident response procedures, engaged leading external experts and informed the relevant authorities.

Our investigation is ongoing. At this stage we believe the activity took place {detection_window}. As a precaution, we have revoked and rotated the access tokens used by integrations with {product}. Some integrations may require reconnection.

We have not identified evidence that your data was accessed. However, our analysis is not complete, and we recommend that you review recent activity associated with your integration and rotate any credentials shared with us.

We will provide updates as more information becomes available. This notice is confidential and intended solely for your organization; please do not distribute it.

Kind regards,
Security and Trust Office, {supplier}

## Variants
- **Confirmed impact**: a second notice a few days later confirms that the customer's records were exported, with a file list.
- **Media first**: the organization learns of the breach from the press before any notice arrives.
- **Outage**: instead of a breach, the supplier announces an indefinite service outage after ransomware.
- **No answer**: the account manager knows nothing, and the support line is overwhelmed.
- **In the Library**: TTX-Zone inject INJ-SUP-05, ready to copy into an MSEL.

## Realism notes
- Real notices are drafted by lawyers: "unauthorized activity", "no evidence at this stage", "out of an abundance of caution". They rarely give indicators or exact dates in the first message.
- They arrive at a generic contact address that may be unattended, or at the commercial contact rather than security.
- Customers often have more than one integration with the supplier and don't know which tokens were shared.
- Expected good outcome: identify every connection to the supplier, rotate secrets, review logs for the window, open the regulatory assessment, and request specifics under the contract.
