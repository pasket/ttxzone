---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-010"
kind: "framework"
title: "New York financial services cybersecurity rule: tested plans and 72-hour notice"
summary: "The New York financial services cybersecurity regulation requires covered entities to keep incident response and business continuity plans tested at least yearly, and to notify the regulator within 72 hours of determining a reportable incident, with a faster notice for extortion payments."
language: "en"
sectors: ["finance"]
families: []
capabilities: ["regulatory_notification", "continuity_recovery", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["NYDFS_500"]
requirements: ["NYDFS-500-16", "NYDFS-500-17"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# New York financial services cybersecurity rule: tested plans and 72-hour notice

## Scope

Banks, insurers and other entities licensed by New York's financial services regulator, with lighter duties for small entities and stricter ones for the largest. The rule sets specific controls (multi-factor authentication, asset inventory, access reviews) on top of a risk-based programme.

## What it expects from exercises

Section 500.16 asks for written incident response and business continuity and disaster recovery plans, tested at least annually with the senior officer and other key staff, including the ability to restore from backups. A tabletop with executives, followed by a documented record and corrective actions, is how most entities meet the testing part.

## Notification duties

Section 500.17: notify the regulator electronically within 72 hours of determining that a reportable cybersecurity incident occurred, including those at a third-party service provider affecting the entity, and keep providing information as it becomes available. An extortion payment requires a notice within 24 hours and a written explanation of why it was necessary within 30 days. An annual compliance certification or acknowledgment of non-compliance is also due.

## Evidence to keep

The plans and the records of their annual tests (participants, scenario, results, corrective actions), the incident determination and notification, and the evidence behind the annual certification. Keep exercise reports for the retention period the rule sets.

## Exercise hooks

Include a ransom demand so the table discusses the 24-hour payment notice and the justification, and a third-party provider incident to test whether it is reportable. Test restore from backups as an explicit decision. Map objectives to NYDFS-500-16 and NYDFS-500-17.
