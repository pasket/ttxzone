---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-016"
kind: "artifact"
title: "Backup status report after encryption: most copies gone"
summary: "The infrastructure team's first assessment of backups after a ransomware attack: the backup server and snapshots were wiped, cloud copies deleted with stolen credentials, and the only clean copy is an offline set several days old that has never been fully restored."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware"]
capabilities: ["continuity_recovery", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1490", "enterprise:T1485", "enterprise:T1486"]
attack_groups: []
related: ["KB-TRD-001", "KB-CAS-002"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "document"
actor: "insider"
variables: ["organization_short", "critical_system", "offline_copy_age", "restore_estimate"]
variable_defaults: {"offline_copy_age": "9 days", "restore_estimate": "10 to 15 days"}
---
# Backup status report after encryption: most copies gone

## Purpose
Turns "we have backups" into a real recovery decision. It tests whether the organization knows what its backups actually cover, whether restoring means losing days of data, how restoration is prioritized, and whether management accepts a long recovery or reconsiders paying. It also raises the evidence-versus-recovery tension.

## Template
{organization_short} infrastructure -- backup status assessment -- version 1 (preliminary)

Summary: the primary backup platform is unusable. Recovery depends on the offline copy.

1. Backup server: encrypted. Configuration and catalogue lost; jobs deleted using an administrator account before encryption.
2. Storage snapshots: deleted on all virtualization hosts. Local shadow copies removed on servers.
3. Cloud backup copies: retention policy changed to 1 day and copies deleted with the same administrator account. Provider support says recovery is "unlikely".
4. Offline copy: tape/disconnected disk set from {offline_copy_age} ago, physically stored off site. Integrity not yet verified. Last full restore test: never; partial test 14 months ago.
5. {critical_system}: included in the offline copy; restoration requires rebuilding the virtualization platform first.

Estimated time to restore core services: {restore_estimate}, assuming the offline copy is clean. Data created since the copy will be lost unless recovered from other sources.

Open questions: was the offline copy taken after the attacker's initial access? Do we wait for forensic imaging before wiping hosts?

## Variants
- **Immutable copy**: an immutable cloud copy survived; recovery is days, not weeks, if the restore process works.
- **Infected copy**: the offline copy contains the attacker's tools and persistence; restoring it reintroduces the threat.
- **Missing scope**: the copy covers servers but not the cloud-hosted ERP database, managed by a supplier.
- **Hypervisor-level attack**: the attacker encrypted datastores directly, so every virtual server failed at once.
- **In the Library**: TTX-Zone inject INJ-RAN-03, ready to copy into an MSEL.

## Realism notes
- Ransomware operators target backups first: deleting shadow copies, wiping backup servers and catalogues, changing cloud retention, and attacking the virtualization layer.
- Restores are slower than expected; untested restores fail; rebuilding infrastructure precedes restoring data.
- Organizations with working backups are the ones that most often refuse to pay.
- Expected good outcome: verify the offline copy in isolation, check it predates the intrusion, prioritize restoration by business impact, preserve evidence before wiping, and record the decision on data loss.
