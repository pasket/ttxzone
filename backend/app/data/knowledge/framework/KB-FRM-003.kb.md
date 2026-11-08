---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-003"
kind: "framework"
title: "CER: resilience measures and incident notification for critical entities"
summary: "The EU directive on the resilience of critical entities covers all hazards, physical and cyber, for entities designated by each member state, asking for resilience measures and notification of significant disruptions within 24 hours."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["continuity_recovery", "regulatory_notification", "cross_unit_coordination"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["CER"]
requirements: ["CER-13", "CER-15"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# CER: resilience measures and incident notification for critical entities

## Scope

Member states designate critical entities in sectors such as energy, transport, banking, health, drinking and waste water, digital infrastructure, public administration, space and food. The directive is all-hazards: floods, sabotage, pandemics and cyber attacks are treated together, and it works alongside NIS2, which covers the cyber measures of the same entities. Designation is national, so an organization learns from its authority whether it is in scope.

## What it expects from exercises

Article 13 asks critical entities to take technical, security and organizational measures to prevent incidents, protect assets, respond, recover and adapt, including business continuity, emergency procedures and staff awareness. Exercises are the normal way to show that response and recovery work, and a cyber scenario with physical consequences (a site without power, a control room without screens) fits the all-hazards spirit.

## Notification duties

Article 15: notify the competent authority without undue delay of incidents that significantly disrupt or could significantly disrupt essential services, with an initial notification no later than 24 hours after becoming aware unless operationally impossible, followed where relevant by a detailed report no later than one month after. The notification covers the number of users affected, duration and geographical area. Authorities may inform the public.

## Evidence to keep

The resilience plan, the risk assessment it rests on, exercise records with findings and actions, and incident notification procedures naming who decides and who sends. After an exercise, a clear trace of the moment the disruption was judged significant is the key output.

## Exercise hooks

Combine a cyber cause with a physical effect and a second authority: the cyber CSIRT and the critical-entity authority may both expect a report. Add an inject about public information when an essential service is down, and one where emergency services ask for an estimate of restoration. Map objectives to CER-13 and CER-15.
