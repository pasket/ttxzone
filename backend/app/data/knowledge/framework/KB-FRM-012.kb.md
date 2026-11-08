---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-FRM-012"
kind: "framework"
title: "PCI DSS: an incident response plan reviewed and tested every year"
summary: "The card industry's data security standard, a contractual obligation for merchants and service providers that handle card data, requires an incident response plan reviewed and tested at least once every twelve months."
language: "en"
sectors: ["retail-ecommerce", "finance"]
families: []
capabilities: ["detection_triage_escalation", "legal_forensics", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: []
frameworks: ["PCI_DSS"]
requirements: ["PCI-DSS-12-10-2"]
source_class: "regulatory-text"
period: "2025"
reviewed: "2026-10-31"
---
# PCI DSS: an incident response plan reviewed and tested every year

## Scope

Any merchant or service provider that stores, processes or transmits payment card data, or can affect its security. It is not a law but a contractual standard enforced through the card brands and acquiring banks, with validation by self-assessment or by a qualified assessor depending on volume.

## What it expects from exercises

Requirement 12.10.1 asks for an incident response plan ready to be activated, covering roles, communication with the card brands and acquirers, containment, business recovery, data backup and legal requirements; requirement 12.10.2 asks that it be reviewed, updated as needed and tested at least once every twelve months. A tabletop of a suspected card data compromise is the usual test.

## Notification duties

The plan must include notifying the payment brands and the acquirer according to their rules, which typically expect prompt notice of a suspected compromise, preservation of evidence and, often, an investigation by an approved forensic investigator. Data protection and state breach laws may apply in parallel.

## Evidence to keep

The incident response plan, the record of its annual test with findings and updates, training records for responders, and the procedure for alerts from security monitoring. An assessor will ask to see the last test and what changed afterwards.

## Exercise hooks

Start from a bank's notice that cards used at the merchant show fraud (a common point of compromise), or from injected code on a checkout page. Test evidence preservation versus taking the shop offline, and the call to the acquirer. Map objectives to PCI-DSS-12-10-2.
