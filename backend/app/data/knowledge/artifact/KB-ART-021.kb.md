---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-021"
kind: "artifact"
title: "Managed service provider downplays a compromise on its side"
summary: "The organization's managed IT provider writes, after being asked about suspicious traffic, that it found 'minor commodity malware' on one of its jump servers, already removed by antivirus, and that customers are not affected; the provider's remote-access tunnels into the organization stay open."
language: "en"
sectors: ["cross-sector", "technology-msp", "energy-utilities"]
families: ["supply_chain"]
capabilities: ["third_party_supply_chain", "detection_triage_escalation", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1199", "enterprise:T1219", "enterprise:T1133"]
attack_groups: []
related: ["KB-TRD-003", "KB-ART-003", "KB-ART-025"]
source_class: "sector-incident-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "email"
actor: "managed-service-provider"
variables: ["organization", "supplier", "jump_server"]
variable_defaults: {"jump_server": "one of our remote support jump servers"}
---
# Managed service provider downplays a compromise on its side

## Purpose
Tests how the organization handles a trusted provider with privileged access that says "nothing to see here". Players must weigh the provider's reassurance against the risk, decide whether to suspend its access (and lose support), and ask the right questions about scope, investigation and evidence.

## Template
Subject: RE: Suspicious traffic -- {organization}

Hello,

Thank you for your message. Following the alert from the national CSIRT, our team investigated and identified a minor commodity malware infection on {jump_server}. The file was detected and removed by our antivirus, and the server has been rebooted. We have no indication that the malware spread or that any customer environment was affected.

Our remote support connections to {organization} remain operational as normal, so there is no impact on your service. As a precaution we will change the password of the affected server.

We consider this matter closed, but please don't hesitate to contact us if you have further questions.

Kind regards,
Service Delivery Manager
{supplier}

## Variants
- **Reappears**: three weeks later, the CSIRT reports the same command-and-control traffic from the provider's network.
- **Shared tool**: the provider's remote monitoring and management platform, used for all its customers, is the compromised system.
- **Provider insists**: the provider says suspending its access breaches the contract and it won't be responsible for outages.
- **Proof**: the organization's own logs show the provider's account connecting at night to servers it never manages.
- **In the Library**: TTX-Zone inject INJ-SUP-04, ready to copy into an MSEL.

## Realism notes
- Providers commonly downplay early findings and "remediate" with antivirus alone, leaving persistent access in place; the threat often returns weeks later.
- Customers frequently learn of a provider's compromise from a national CSIRT or threat intelligence rather than from the provider.
- Remote management tools and permanent VPN tunnels give a compromised provider a direct path into every customer.
- Expected good outcome: restrict or suspend the provider's access until scope is clear, request a proper investigation report and indicators, review the provider's activity in the organization's logs, and escalate under the contract.
