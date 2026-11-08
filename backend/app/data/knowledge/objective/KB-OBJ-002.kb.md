---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-OBJ-002"
kind: "objective"
title: "Classify the incident against the severity and reporting thresholds"
summary: "An objective for incident classification: the incident manager assigns a severity with the organization's scale and checks each applicable reporting threshold, recording the criteria and who decided."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["incident_classification"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["NIS2", "DORA"]
requirements: ["NIS2-23", "DORA-19"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
---
# Classify the incident against the severity and reporting thresholds

## Objective

Within 30 minutes of escalation, the incident manager assigns a severity level using the organization's scale and checks the incident against the reporting thresholds of each applicable regulation, recording the criteria used and the person who decided. Classification is revisited whenever a new inject changes the impact.

## Success criterion

A severity level from the organization's own scale is assigned; the criteria used (services affected, users, duration, data, financial impact) are written down; each applicable regulation is checked against its thresholds; the person accountable for the classification is named; the classification is reviewed after the impact changes.

## Evidence

The incident record with the severity and its justification, a threshold checklist per regulation, and the decision log. Evaluators should note the moment the incident is judged significant or major, since reporting deadlines often run from it.

## Regulatory mapping

Prepares the staged reporting of significant incidents under NIS2 (NIS2-23) and the classification of major ICT-related incidents under DORA (DORA-19), whose criteria include clients affected, duration, geographic spread, data losses, critical services and economic impact.

## Common pitfalls

Classifying once and never again, even when the scenario escalates; confusing internal severity with regulatory significance; and arguing about the scale itself during the incident. A short threshold card prepared before the exercise saves time and is itself a good improvement action.
