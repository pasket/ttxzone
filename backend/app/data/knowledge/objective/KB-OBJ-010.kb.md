---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-OBJ-010"
kind: "objective"
title: "Preserve evidence before rebuilding and keep the chain of custody"
summary: "An objective for legal and forensic readiness: before an affected system is wiped or rebuilt, the evidence an investigation needs is preserved, a chain of custody is started and legal counsel is involved before anything is shared outside."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: ["legal_forensics"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["HIPAA", "PCI_DSS"]
requirements: ["ISO27035-2", "HIPAA-308-A6", "PCI-DSS-12-10-2"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
---
# Preserve evidence before rebuilding and keep the chain of custody

## Objective

Before wiping or rebuilding an affected system, the team preserves the evidence a later investigation needs (memory, disk, logs), starts a chain-of-custody record, and informs legal counsel before evidence is shared with any third party; the decision on reporting to law enforcement is taken by counsel and the crisis committee.

## Success criterion

Memory, disk or log captures are requested before rebuilding; a chain-of-custody record is started; legal counsel is told before evidence is shared outside; a single point of contact with law enforcement is named; the decision on reporting a crime is recorded with its timing.

## Evidence

The chain-of-custody record, the list of captures, and the decision log entries on law enforcement and on engaging an external forensic provider under retainer.

## Regulatory mapping

Evidences the response and lessons-learned phases of ISO/IEC 27035-2 (ISO27035-2), the security incident procedures of the HIPAA Security Rule (HIPAA-308-A6), and the forensic and evidence-preservation elements of a PCI DSS incident response plan tested yearly (PCI-DSS-12-10-2).

## Common pitfalls

Restoring service first and losing the evidence; engaging a forensic firm without counsel, so its reports are not privileged where that matters; and nobody knowing whether the retainer covers the incident. An inject where the business pushes to rebuild immediately tests the trade-off.
