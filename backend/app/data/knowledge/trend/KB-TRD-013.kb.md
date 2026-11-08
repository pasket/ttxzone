---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-013"
kind: "trend"
title: "Telecommunications: long-term state espionage in carrier networks and destructive attacks"
summary: "State groups live for months or years inside carriers' core and edge routers and lawful-intercept systems, collecting traffic and metadata; in conflict zones, operators suffer destructive attacks that cut service to millions, while subscriber data breaches feed fraud."
language: "en"
sectors: ["telecom"]
families: ["data_breach", "wiper_destructive", "supply_chain"]
capabilities: ["detection_triage_escalation", "continuity_recovery", "cross_unit_coordination"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1190", "enterprise:T1584.008", "enterprise:T1556.004", "enterprise:T1601.001", "enterprise:T1602.002", "enterprise:T1040", "enterprise:T1557", "enterprise:T1485"]
attack_groups: ["G1045", "G0034"]
related: ["KB-TRD-005", "KB-TRD-004"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Telecommunications: long-term state espionage in carrier networks and destructive attacks

## Overview
Carriers are strategic targets: their networks carry everyone else's communications and hold the systems used for lawful interception. Salt Typhoon became the best-known example of a group living inside several major carriers for a long time, reaching core routers, lawful-intercept platforms and the call records of selected people. The entry point is usually network equipment: unpatched edge routers and firewalls, management interfaces exposed to the internet, weak or shared credentials. Once inside, attackers modify device firmware or authentication, dump configurations, capture traffic and use compromised routers, including customers' home and small-office devices, as relay networks to hide other operations. In conflict zones, groups such as Sandworm Team have destroyed operators' systems, cutting mobile and internet service to millions. Subscriber data breaches and SIM swapping feed fraud against the operator's customers.

## Indicative figures
- Espionage campaigns in carrier networks have lasted from several months to multiple years before detection.
- A single destructive attack on a mobile operator in a conflict zone cut service for millions of subscribers for days.
- Disruptions to internet providers claimed by hacktivist fronts lasted hours; several providers were hit in one coordinated operation.
- Relay networks built from compromised small-office routers comprise thousands of devices.

## Typical attack chain
1. **Entry**: exploitation of edge devices and exposed management interfaces (T1190).
2. **Foothold on network devices**: changed authentication, patched firmware images (T1556.004, T1601.001).
3. **Collection**: configuration dumps (T1602.002), packet capture and access to lawful-intercept or call-record systems (T1040, T1557).
4. **Relay**: compromised routers used as infrastructure for other operations (T1584.008).
5. **Destruction** (conflict scenario): wiping of core systems and backups (T1485).

## Realistic timings
- Exploitation of newly disclosed network-device flaws starts within days.
- Detection often comes from an external party (a government agency or a partner), not from the operator's own monitoring.
- Evicting an attacker from network equipment means replacing or reimaging devices across the core: weeks to months, with planned service windows.
- Restoring service after destructive attacks: days for basic voice and data, weeks for full service.

## Exercise hooks
- A government agency informs the operator, under confidentiality, that a foreign group has been in its core network for over a year.
- Engineers find a router image whose hash doesn't match the vendor's; replacing it means a night-time outage in a city.
- Customers complain of SIM swaps after a call-centre data breach.
- Ask who in the operator can talk to the authority that owns the lawful-intercept systems, and what can be shared with customers.
- Discuss notification: whose data was accessed, and who must be told?
