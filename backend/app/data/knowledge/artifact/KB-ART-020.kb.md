---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-020"
kind: "artifact"
title: "Financial supervisor asks for the major ICT incident report"
summary: "The financial supervisor contacts a bank after an outage of its payment services became visible to customers, asks whether it has been classified as a major ICT-related incident and reminds it of the initial, intermediate and final report deadlines."
language: "en"
sectors: ["finance"]
families: ["regulatory"]
capabilities: ["regulatory_notification", "incident_classification", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-TRD-012", "KB-ART-007"]
source_class: "trade-magazine"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "email"
actor: "financial-supervisor"
variables: ["organization", "critical_service", "supervisor_reference", "outage_start"]
variable_defaults: {"supervisor_reference": "FS-ICT-0937", "outage_start": "this morning"}
---
# Financial supervisor asks for the major ICT incident report

## Purpose
Brings sector regulation into a financial-services exercise. It tests whether the entity can apply the classification criteria under time pressure, who decides and signs, how an ICT provider's incident is reported when the entity itself was not breached, and how the supervisor's report stays consistent with customer communication.

## Template
Subject: {supervisor_reference} -- {organization} -- service disruption affecting {critical_service}

Dear Sir or Madam,

The supervisory authority has observed reports of a disruption affecting {critical_service} at {organization} since {outage_start}, including customer complaints on social media and in the press.

Please confirm, as soon as possible, whether your entity has classified this event as a major ICT-related incident. We remind you that, once classified as major, an initial notification is due within 4 hours of classification and in any case no later than 24 hours after becoming aware of the incident, followed by an intermediate report within 72 hours and a final report within one month.

In your response, please indicate:
1. The classification decision and the criteria applied (clients affected, duration and service downtime, geographical spread, data losses, criticality of services, economic impact).
2. Whether the incident originates at an ICT third-party service provider, and which one.
3. Whether personal data or payment data have been affected.
4. The measures taken to restore service and to inform customers.

If the event is not considered major, please explain the reasons briefly.

Yours faithfully,
Directorate for Operational Resilience
Financial Supervisory Authority

## Variants
- **Provider's fault**: the outage is at the card processor; the bank must report anyway and depends on the provider for facts.
- **Cyber cause unclear**: it might be a failed change rather than an attack; the classification still applies.
- **Two regulators**: the data protection authority asks about the same event with a different deadline and template.
- **Already filed**: the bank filed a notification, but the figures for affected clients differ from those the press reports.
- **In the Library**: TTX-Zone inject INJ-REG-02, ready to copy into an MSEL.

## Realism notes
- Financial operational-resilience rules require classifying ICT incidents against defined criteria and reporting major ones in hours; the deadlines in the template follow that model.
- Supervisors often learn of incidents from social media and customer complaints before the entity reports.
- The entity remains responsible when the cause is at an ICT provider; contracts must ensure timely information.
- Expected good outcome: a documented classification decision with its rationale, a short initial notification on time, consistent figures across regulators, customers and media, and a plan for the intermediate report.
