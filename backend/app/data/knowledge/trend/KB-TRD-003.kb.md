---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-003"
kind: "trend"
title: "Supply chain and third-party compromise: one breach, many victims"
summary: "Attackers reach many organizations through one supplier: managed service providers, SaaS integrations and their tokens, software updates, open-source packages and shared service providers whose outage halts thousands of customers."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["supply_chain", "cloud_compromise", "ransomware"]
capabilities: ["third_party_supply_chain", "regulatory_notification", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1199", "enterprise:T1195.001", "enterprise:T1195.002", "enterprise:T1528", "enterprise:T1530", "enterprise:T1213"]
attack_groups: []
related: ["KB-CAS-003", "KB-CAS-004", "KB-ART-003"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Supply chain and third-party compromise: one breach, many victims

## Overview
The supplier has become the most efficient target. A managed service provider, a SaaS platform that stores customers' integration tokens, a software vendor's update channel or a popular open-source package gives an attacker a path into hundreds of downstream organizations at once. At the same time, concentration makes availability fragile: a ransomware attack or a technical failure at one shared provider (cloud, payments, logistics, a sector-specific application) stops thousands of customers who were never attacked themselves. European regulation now makes the customer responsible for managing its suppliers' risk and reporting incidents that start with a third party, yet few organizations actually assess their suppliers regularly.

## Indicative figures
- Supply-chain vectors represent around 10 % of observed threat activity in Europe, and their share has been growing.
- About 9 in 10 security leaders report more third-party incidents; only a few percent claim full visibility of their supply chain.
- Only around 15 % of industrial organizations assess supplier cyber risk formally and periodically; in general business surveys, under 15 % review even their immediate suppliers yearly.
- Three providers hold over 60 % of global cloud infrastructure; several major cloud and content-delivery outages each disrupted thousands of services in the period.
- A single ransomware attack on a large manufacturer affected over 5,000 organizations in its supply and distribution chain.
- Open-source campaigns compromised hundreds of packages at once with self-propagating credential stealers.
- Espionage through suppliers is often discovered 6 months to several years after it began.

## Typical attack chain
1. **Supplier foothold**: the supplier's own identity or development environment is compromised (stolen credentials, a code repository, a build pipeline).
2. **Trust abuse**: the attacker uses the supplier's legitimate access to customers (T1199), such as remote management tools, VPN tunnels or support accounts.
3. **Poisoned software**: a malicious update or a compromised dependency is distributed to customers (T1195.002, T1195.001), sometimes only to a handful of selected targets.
4. **Token theft**: OAuth tokens and API keys stored by a SaaS provider are taken and used to access customers' data stores (T1528).
5. **Collection**: customer data is pulled from cloud storage and business applications such as CRM, ERP and document repositories (T1530, T1213).
6. **Impact**: extortion of each customer, espionage, or the supplier's own outage cascading downstream.

## Realistic timings
- Compromise at the supplier to customer notification: weeks to months; the supplier often learns of it from a customer, a researcher or law enforcement.
- Mass exploitation of a supplier platform: data from dozens or hundreds of customers within days.
- A shared-provider outage hits every customer within minutes; recovery ranges from hours (configuration errors) to weeks or months (ransomware with rebuilds).
- Regulatory reporting clocks may start for the customer as soon as it becomes aware of a significant impact, even if the incident happened at the supplier (in the EU, an early warning within 24 hours is the baseline).

## Exercise hooks
- The incident starts outside the building: a supplier's security notification arrives with few details and a vague timeline (KB-ART-003).
- Which suppliers have privileged access today, and can their access be cut without stopping the business?
- Is it reportable? Run the regulatory notification discussion when the facts belong to someone else.
- Contracts: what does the supplier owe in notice, cooperation and logs, and who holds that contract?
- Alternative operation: how long can the organization work without the supplier's service, and what is the manual fallback?
