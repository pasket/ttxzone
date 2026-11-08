---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-011"
kind: "framework"
title: "HIPAA Security Rule: incident procedures and tested contingency plans in US health care"
summary: "The US health privacy rules require covered entities and business associates to have security incident procedures and a contingency plan with testing, and the breach notification rule sets deadlines to inform patients, the regulator and sometimes the media."
language: "en"
sectors: ["healthcare"]
families: []
capabilities: ["continuity_recovery", "regulatory_notification", "detection_triage_escalation"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["HIPAA"]
requirements: ["HIPAA-308-A6", "HIPAA-308-A7"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# HIPAA Security Rule: incident procedures and tested contingency plans in US health care

## Scope

Health plans, health care clearinghouses and providers that transmit health information electronically, and the business associates that handle it for them. The Security Rule covers electronic protected health information; the Breach Notification Rule covers unsecured protected health information in any form.

## What it expects from exercises

Section 164.308(a)(6) asks for security incident procedures to identify, respond to, mitigate and document incidents. Section 164.308(a)(7) asks for a contingency plan with data backup, disaster recovery and emergency mode operation plans, plus testing and revision procedures. A tabletop that runs an outage of clinical systems through downtime procedures exercises both.

## Notification duties

After a breach of unsecured protected health information, affected individuals are notified without unreasonable delay and no later than 60 days after discovery; the regulator is notified too (at once for breaches affecting 500 or more people, annually for smaller ones), and prominent media in a state or jurisdiction when more than 500 of its residents are affected. Business associates notify the covered entity. Encryption to recognized standards takes data out of the unsecured category.

## Evidence to keep

The incident procedures and incident documentation, the contingency plan with test records and revisions, the risk analysis, and breach assessments (the four-factor risk assessment) with the decision reached. Keep the documentation for six years.

## Exercise hooks

Take the electronic health record or laboratory system down and make clinicians decide how long paper downtime procedures hold; add a patient-safety inject and a breach assessment once exfiltration is suspected. Map objectives to HIPAA-308-A6 and HIPAA-308-A7.
