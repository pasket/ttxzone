---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-006"
kind: "framework"
title: "Spain's National Security Framework: periodic continuity tests and incident management"
summary: "The Spanish National Security Framework binds the public sector and its technology suppliers to security measures by category, including periodic tests of continuity plans and a managed incident process with notification to the national government CERT."
language: "en"
sectors: ["public-administration"]
families: []
capabilities: ["continuity_recovery", "detection_triage_escalation", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["ENS"]
requirements: ["ENS-OP-CONT-3", "ENS-OP-EXP-7"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# Spain's National Security Framework: periodic continuity tests and incident management

## Scope

Public administrations in Spain, public-sector bodies and the private companies that provide them with systems or services, which must show conformity. Systems are categorized (basic, medium, high) by the impact of an incident on availability, integrity, confidentiality, authenticity and traceability, and the required measures grow with the category.

## What it expects from exercises

Measure op.cont.3 asks for periodic tests of the continuity plan to check that it works and that staff know their roles, and op.exp.7 for an incident management process: detection, classification, response, escalation and lessons learned. A tabletop that runs a disruption of a citizen-facing service through both continuity and incident management covers the two at once and leaves a record auditors recognize.

## Notification duties

Public bodies notify significant incidents to the national government CERT through the established channel, and the national incident notification guide sets levels of impact and the information expected. Entities also covered by NIS2 or data protection rules have those reports on top; the exercise should make the table decide which ones apply.

## Evidence to keep

The continuity plan and its test reports, the incident management procedure, the incident register and the lessons learned, and the system categorization that justifies the measures applied. Conformity audits ask to see test records with dates, participants and corrective actions.

## Exercise hooks

Disrupt an electronic service the public depends on (appointments, registry, tax) during a deadline period, add citizen complaints and a journalist, and a supplier who runs the platform. Make the table classify the incident and decide the notification level. Map objectives to ENS-OP-CONT-3 and ENS-OP-EXP-7.
