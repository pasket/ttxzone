---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-018"
kind: "trend"
title: "Transport and logistics: when one supplier's outage stops ports, airports and fleets"
summary: "Transport depends on a few shared systems (check-in and baggage platforms, port community systems, fleet management, booking): an attack or faulty update at one supplier causes queues, manual operations and backlogs for days, while data theft, extortion and state espionage on logistics flows continue in the background."
language: "en"
sectors: ["transport-logistics"]
families: ["ransomware", "supply_chain", "data_breach", "ddos"]
capabilities: ["continuity_recovery", "third_party_supply_chain", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1199", "enterprise:T1190", "enterprise:T1567.002", "enterprise:T1486", "enterprise:T1498"]
attack_groups: ["G0007"]
related: ["KB-TRD-003", "KB-CAS-003", "KB-TRD-016"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Transport and logistics: when one supplier's outage stops ports, airports and fleets

## Overview
Transport and logistics run on tight schedules and shared digital platforms: passenger processing systems used by many airlines at an airport, port community and terminal operating systems, rail signalling and traffic management, fleet and warehouse management, booking and ticketing. An attack on one of these suppliers, or even a faulty software update, produces long queues, paper check-ins, ships waiting at anchor and trucks backed up for days, affecting companies that were never attacked. Logistics firms are also attractive ransomware and data theft targets because downtime is so costly. State groups such as APT28 have targeted logistics companies supporting military aid and hijacked cameras near ports and rail crossings to watch shipments. Hacktivist DDoS against airport and transport websites is frequent but usually short.

## Indicative figures
- In confirmed transport incidents, data theft is the most common impact (around two thirds), with extortion and ransomware in about a third.
- Outages of major port or terminal systems have taken from several days to weeks to recover, with losses in the millions.
- A single faulty endpoint software update grounded or delayed flights and forced manual operations across many countries within hours.
- Attacks on logistics firms rose sharply year on year in some datasets.

## Typical attack chain
1. **Entry**: through a shared supplier or managed provider (T1199), or an exposed application (T1190).
2. **Theft**: shipment, customer and partner data (T1567.002).
3. **Impact**: encryption of booking, terminal or warehouse systems (T1486); in parallel, DDoS on public websites (T1498).
4. **Cascade**: dependent operators switch to manual processes; backlogs grow by the hour.

## Realistic timings
- Manual fallback (paper boarding passes, manual baggage tagging, phone-based gate operations) must start within the first hour.
- Each hour of outage at a hub adds hours or days of backlog; recovery of normal flow lags system restoration.
- Supplier-side recovery: days to weeks; the dependent operator controls none of it.
- Public and media pressure is immediate, with images of queues on social media.

## Exercise hooks
- The shared check-in and boarding platform at the main airport is down after a ransomware attack on its supplier; the airline's own systems work.
- The port community system is unavailable; trucks cannot get gate appointments and ships cannot unload.
- A logistics customer demands to know whether its shipment data was stolen.
- Ask what the manual fallback really looks like, how long staff can sustain it, and who communicates with passengers or customers.
- Discuss contracts and service levels with critical shared platforms.
