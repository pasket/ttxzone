---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-GLS-011"
kind: "glossary"
title: "Traffic Light Protocol (TLP)"
summary: "A labelling scheme that tells recipients how widely they may share information: red for named recipients only, amber for their organization on a need-to-know basis, green for their community, and clear for anyone."
language: "en"
sectors: ["cross-sector"]
families: []
capabilities: []
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: []
requirements: []
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
---
# Traffic Light Protocol (TLP)

## Definition

The Traffic Light Protocol marks documents and messages with a colour that sets their sharing limits: TLP:RED, only the people present or named; TLP:AMBER, the recipient's organization and its clients on a need-to-know basis (TLP:AMBER+STRICT, the organization only); TLP:GREEN, the recipient's community but not public channels; TLP:CLEAR, no limit. The label goes at the top and bottom of every page.

## In an exercise

Exercise design documents usually carry TLP:AMBER or stricter, because they describe the organization's weaknesses. The needs analysis, the MSEL and the session documents should show their label, and inject files that contain realistic logs deserve the same care as the real thing.

## Common confusions

TLP is a sharing convention, not a classification system with legal force, and it does not encrypt anything. It is also unrelated to inject severity: a red label means restricted sharing, not a critical alert.
