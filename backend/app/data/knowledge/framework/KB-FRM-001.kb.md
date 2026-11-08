---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-001"
kind: "framework"
title: "NIS2: crisis management, effectiveness testing and staged incident reporting"
summary: "The EU directive on network and information security makes essential and important entities manage cyber risk, keep continuity and crisis plans, assess whether their measures work and report significant incidents in stages starting within 24 hours."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["regulatory_notification", "continuity_recovery", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-OBJ-004", "KB-GLS-010"]
frameworks: ["NIS2"]
requirements: ["NIS2-21-2-C", "NIS2-21-2-F", "NIS2-23"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# NIS2: crisis management, effectiveness testing and staged incident reporting

## Scope

The directive covers medium and large organizations in a long list of sectors (energy, transport, banking infrastructure, health, drinking and waste water, digital infrastructure, ICT service management, public administration, space, postal services, manufacturing of critical products, food, chemicals and digital providers), split into essential and important entities with different supervision. Each member state transposes it into national law and names its competent authorities and its CSIRT, so the exact thresholds, the reporting portal and the penalties come from the national act, not from the directive itself.

## What it expects from exercises

Among the risk-management measures of Article 21, point (c) asks for business continuity, backup management, disaster recovery and crisis management, and point (f) for policies and procedures to assess the effectiveness of those measures. A tabletop exercise is one of the clearest ways to show both: it walks the crisis structure through a realistic incident and produces findings and an improvement plan. Management bodies must approve the measures and follow training, so executives are expected at the table, not only the technical team.

## Notification duties

A significant incident (severe operational disruption or financial loss, or considerable damage to others) is reported to the CSIRT or competent authority in stages: an early warning without undue delay and at the latest within 24 hours of becoming aware, saying whether malicious action or cross-border impact is suspected; an incident notification within 72 hours with an initial assessment, severity, impact and indicators of compromise; intermediate reports on request; and a final report within one month of the notification, with the root cause and the mitigation applied. Recipients of the service may also have to be informed.

## Evidence to keep

Auditors look for the approved continuity and crisis plans, the record of exercises held (scenario, participants, date, objectives), the findings and the improvement plan with owners and deadlines, and proof that actions were closed. For notification, a decision log showing when the organization became aware, who assessed significance and when each report would have been sent is the most persuasive output of an exercise.

## Exercise hooks

Run the reporting clock explicitly: mark the moment of awareness, then make the table produce the early warning before the 24-hour mark and the notification before 72 hours. Add a supplier or cloud provider to test the cross-border question, and an inject where a manager questions whether the incident is significant at all. Map objectives to NIS2-21-2-C (continuity and crisis), NIS2-21-2-F (effectiveness) and NIS2-23 (reporting).
