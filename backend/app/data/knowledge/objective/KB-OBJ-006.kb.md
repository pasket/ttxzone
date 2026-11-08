---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-OBJ-006"
kind: "objective"
title: "Keep a critical service within its maximum tolerable disruption"
summary: "An objective for continuity: when a critical service stops, its owner activates the continuity plan's workaround and the team confirms degraded operation before the service's maximum tolerable disruption or impact tolerance is exceeded."
language: "en"
sectors: ["finance", "cross-sector"]
families: []
capabilities: ["continuity_recovery"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-FRM-004"]
frameworks: ["DORA", "UK_OPRES"]
requirements: ["DORA-11", "UK-OPRES-SYSC-15A", "ISO22301-8-5"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
---
# Keep a critical service within its maximum tolerable disruption

## Objective

When a critical or important business service stops, its owner activates the continuity plan's workaround and the team confirms the service runs in degraded mode before its maximum tolerable disruption (or impact tolerance) is exceeded, then agrees a restore order based on business priority.

## Success criterion

The affected service and its owner are identified; its maximum tolerable disruption is stated; the plan's workaround is activated by its owner; degraded operation is confirmed before the tolerance is exceeded; a restore order is agreed; the integrity of the backups is checked before restoring.

## Evidence

The plan activation record, the confirmation of degraded operation with its scenario time, the restore plan and the backup integrity check. Put the tolerance on the wall during the session so everyone measures against it.

## Regulatory mapping

Evidences ICT business continuity and its testing under DORA (DORA-11), scenario testing against impact tolerances under the UK operational resilience rules (UK-OPRES-SYSC-15A), and business continuity procedures under ISO 22301 clause 8.5 (ISO22301-8-5).

## Common pitfalls

Plans that assume the systems used to coordinate are still available; workarounds that exist on paper but need a supplier who is also down; and restoring from backups that were already encrypted or contain the intruder. Include an inject that removes the primary communication channel.
