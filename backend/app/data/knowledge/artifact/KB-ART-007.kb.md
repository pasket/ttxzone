---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-007"
kind: "artifact"
title: "Competent authority asks why the incident hasn't been notified"
summary: "An email from the national cybersecurity authority saying it has learned of a significant incident at the organization through other channels, reminding it of the early-warning deadline and listing the information it expects within hours."
language: "en"
sectors: ["cross-sector", "energy-utilities", "finance", "healthcare", "public-administration"]
families: ["regulatory"]
capabilities: ["regulatory_notification", "incident_classification", "legal_forensics"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-CAS-003", "KB-CAS-004", "KB-ART-003"]
source_class: "trade-magazine"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "email"
actor: "competent-authority"
variables: ["organization", "critical_service", "case_reference", "information_source", "response_window"]
variable_defaults: {"case_reference": "CA-INC-2291", "information_source": "media reports and a notification from another affected entity", "response_window": "within 6 hours"}
---
# Competent authority asks why the incident hasn't been notified

## Purpose
Puts the regulatory clock on the table when the team is busy with containment. It tests whether anyone has decided if the incident is significant, who is responsible for notifying, what can be said with incomplete information, and whether the organization knows its deadlines under each applicable regulation (cybersecurity, data protection, sector rules).

## Template
Subject: {case_reference} -- request for information -- {organization}

Dear Sir or Madam,

The competent authority has become aware, through {information_source}, of a possible significant incident affecting {critical_service} at {organization}. To date, we have not received an early warning or incident notification from your organization.

We remind you that entities in scope must submit an early warning without undue delay and in any case within 24 hours of becoming aware of a significant incident, followed by an incident notification within 72 hours and a final report within one month.

Please provide, {response_window}, at least the following information:

1. Whether the incident is considered significant, and when the organization became aware of it.
2. Whether it is suspected to be caused by unlawful or malicious acts.
3. Whether it could have a cross-border impact or affect other entities.
4. The services affected and an initial assessment of severity and impact.
5. Measures taken and any support requested from the national CSIRT.
6. A contact person available around the clock.

Please also indicate whether notifications have been made to other authorities, such as the data protection authority.

Yours faithfully,
Incident Notification Unit
Competent Authority for Cybersecurity

## Variants
- **Financial entity**: the email comes from the financial supervisor and refers to a major ICT-related incident, with an initial notification due within hours of classification.
- **Data protection**: the data protection authority asks about a personal data breach reported in the press and the 72-hour deadline.
- **Courtesy call**: the national CSIRT calls informally first, offering help and reminding the organization to file.
- **Notification already sent**: the authority's email crosses with a notification the organization sent an hour ago, but the content doesn't match what the press says.
- **In the Library**: TTX-Zone inject INJ-REG-C01, ready to copy into an MSEL.

## Realism notes
- Under NIS2 the early warning is due within 24 hours, the notification within 72 hours and the final report within a month; some countries require faster initial reports. GDPR adds 72 hours to the data protection authority. DORA requires financial entities to report major incidents within hours of classification.
- Authorities often learn of incidents from the press, peers or suppliers before the victim files anything.
- The first notification may be incomplete; what matters is filing on time and updating.
- Expected good outcome: a clear owner for notifications, a decision on significance with its rationale recorded, a short factual early warning, and a consistent message across authorities.
