---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-002"
kind: "framework"
title: "GDPR: testing security measures and notifying personal data breaches"
summary: "The EU data protection regulation (and its UK counterpart) requires regularly testing security measures and, after a personal data breach, notifying the supervisory authority within 72 hours unless the breach is unlikely to risk people's rights, and informing those affected when the risk is high."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["regulatory_notification", "legal_forensics"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-OBJ-005"]
frameworks: ["GDPR"]
requirements: ["GDPR-32-1-D", "GDPR-33-34"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# GDPR: testing security measures and notifying personal data breaches

## Scope

Any organization processing personal data of people in the EU (or, under the UK version, in the UK) is in scope, whatever its sector or size. The controller carries the notification duty; a processor must tell its controller without undue delay. In most cyber incidents the question is not whether personal data is involved but how much, of whom and with what risk, because email, HR, customer and log data almost always contain it.

## What it expects from exercises

Article 32(1)(d) asks for a process for regularly testing, assessing and evaluating the effectiveness of technical and organizational measures. An exercise that runs a breach from detection to the decision on notification tests the organizational half directly: whether the data protection officer is reached, whether the risk to people can be assessed with incomplete facts and whether the deadline is met.

## Notification duties

Article 33: notify the supervisory authority without undue delay and, where feasible, within 72 hours of becoming aware of a breach, unless it is unlikely to result in a risk to people's rights and freedoms; a late notification must explain the delay, and information may be provided in phases. The notification describes the nature of the breach, categories and approximate numbers of people and records, likely consequences and measures taken. Article 34: when the risk is high, inform the people affected without undue delay in clear language. Every breach, notified or not, goes into an internal breach register.

## Evidence to keep

The breach register entry with the facts, effects and remedial action; the risk assessment and who made it; the draft or submitted notification; and the communication to individuals if any. From an exercise, keep the decision log showing when awareness was established, the reasoning on risk, and the improvement actions for gaps such as missing data inventories.

## Exercise hooks

Make awareness ambiguous: an inject where data exfiltration is only suspected tests whether the clock starts. Give the table partial numbers that change later, and a leak-site post that contradicts the internal estimate. Include an inject asking whether to inform customers, so the high-risk threshold is discussed. Map objectives to GDPR-33-34 and GDPR-32-1-D.
