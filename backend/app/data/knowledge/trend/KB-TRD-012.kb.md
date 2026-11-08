---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-012"
kind: "trend"
title: "Financial services: DDoS, fraud, third-party ICT risk and the regulator's clock"
summary: "Banks and insurers face constant denial of service tied to geopolitics, payment fraud aimed at customers and staff, exposure through ICT providers and APIs, and state espionage, all under incident reporting rules measured in hours."
language: "en"
sectors: ["finance"]
families: ["ddos", "bec_fraud", "supply_chain", "data_breach"]
capabilities: ["regulatory_notification", "third_party_supply_chain", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1498", "enterprise:T1499.002", "enterprise:T1566.004", "enterprise:T1657", "enterprise:T1199", "enterprise:T1190", "enterprise:T1078"]
attack_groups: []
related: ["KB-TRD-006", "KB-TRD-007", "KB-ART-007"]
source_class: "trade-magazine"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Financial services: DDoS, fraud, third-party ICT risk and the regulator's clock

## Overview
Financial entities are attacked on every front at once. Hacktivists flood online banking and payment portals whenever their country's government takes a political stance. Fraud rings target customers with phishing, smishing and calls from fake bank staff, and target employees with executive impersonation. Ransomware and data theft come in through ICT providers, outsourced call centres and the APIs that connect banks with fintech partners. State groups spy on banks and supervisors. What makes the sector distinct is regulation: operational resilience rules require classifying ICT incidents quickly, reporting major ones within hours, managing third-party ICT risk contractually, and proving to the supervisor that critical functions can continue. A technically minor incident can become a regulatory one.

## Indicative figures
- European financial entities faced on the order of 1,500 attack attempts per organization per week, up about 30 % in a year.
- Banks absorb most attacks on the sector (around 40 to 60 % depending on the dataset), followed by finance-related government portals.
- Among reported attacks on the sector, more than half caused some interruption of operations, about a third led to exposure or sale of confidential data, and a similar share caused direct financial losses.
- The average duration of network-layer DDoS attacks on banking services grew several-fold year on year.
- Almost all financial entities report at least one security incident linked to their APIs.
- Phishing, smishing and voice fraud are the main vectors of customer fraud.

## Typical attack chain
DDoS: target announced by hacktivists, waves against login and payment pages (T1498, T1499.002); customers cannot pay or access accounts.

Fraud: fake bank calls or messages to customers and staff (T1566.004), payment diverted to mule accounts (T1657).

Third party: compromise of an ICT provider or fintech partner (T1199) or an exposed API (T1190), then valid credentials used to reach customer data (T1078).

## Realistic timings
- Financial regulation requires an initial notification within hours of classifying a major ICT incident, and at most a day after detection; intermediate and final reports follow within days and weeks.
- Classification itself is a decision under time pressure: criteria include clients affected, duration, geographic spread, data losses and economic impact.
- DDoS waves last minutes to hours; customer-facing impact during payroll or tax days multiplies complaints.
- A provider's incident may only reach the bank days after it began.

## Exercise hooks
- Online banking is slow on payroll day while a hacktivist channel claims responsibility (KB-ART-006).
- The card processing provider reports an incident; the bank must decide whether it is a major ICT incident and notify the supervisor.
- Customers report calls from "the bank's fraud department" that know their recent transactions.
- Ask who classifies incidents against the regulatory criteria, and who signs the notification.
- Test the exit strategy for a critical ICT provider: could the bank switch if the provider failed for a week?
