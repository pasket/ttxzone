---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-OBJ-001"
kind: "objective"
title: "Escalate the first alert within the hour"
summary: "An objective for detection, triage and escalation: the first credible alert is triaged, recorded and escalated to the incident manager within a set time, through the channel the procedure names."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["detection_triage_escalation"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-GLS-003"]
frameworks: ["NIS2"]
requirements: ["NIS2-21-2-F", "ISO27035-2"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
---
# Escalate the first alert within the hour

## Objective

Within 60 minutes of the first alert, the security team triages it, opens an incident record and escalates it to the incident manager following the escalation procedure. The time is scenario time and can be tightened for a mature team or loosened for a first exercise; what matters is that it is stated before the session, so the Evaluator can measure it rather than judge it.

## Success criterion

One observable condition per line, each a point on the evaluation guide: the alert is acknowledged and assigned to a named analyst; an incident record is opened with time, source and affected assets; the incident manager is notified through the channel the procedure names; the escalation happens within the stated time. Avoid words such as properly or adequately, which no observer can check.

## Evidence

The incident record with its timestamps, the escalation message or call log, and the Evaluator's notes with the scenario time of each step. In a tabletop, ask the table to say aloud when they would open the record and whom they would call, and write the time down.

## Regulatory mapping

Evidences the assessment of the effectiveness of security measures (NIS2-21-2-F) and the detection and reporting phase of an incident management process (ISO27035-2). It also starts the clock for every notification duty later in the scenario, so the time of escalation is worth recording precisely.

## Common pitfalls

Teams often triage well but never formally escalate, assuming the manager already knows; or escalate by a personal chat that leaves no record. Another pitfall is an alert that arrives outside business hours with nobody on call: include that variant if the organization claims round-the-clock coverage.
