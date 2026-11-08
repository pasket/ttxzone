---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-003"
kind: "case"
title: "Ransomware halts a vehicle manufacturer and ripples through its supply chain"
summary: "A ransomware attack stops production at a large vehicle manufacturer for weeks; thousands of suppliers and dealers lose their main customer, national output falls and the total cost reaches billions."
language: "en"
sectors: ["ot-manufacturing", "transport-logistics"]
families: ["ransomware", "supply_chain"]
capabilities: ["continuity_recovery", "third_party_supply_chain", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1078", "enterprise:T1486", "ics:T0826", "ics:T0828"]
attack_groups: []
related: ["KB-TRD-003", "KB-TRD-004"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Ransomware halts a vehicle manufacturer and ripples through its supply chain

## Archetype
A large European vehicle manufacturer with several plants running just-in-time production, a tiered network of thousands of suppliers (many small, with a single big customer) and a dealer network that depends on the manufacturer's systems for orders, parts and registrations. Production planning, logistics and plant execution systems share IT infrastructure with the corporate network. A ransomware attack forces the company to shut down its systems and stop every production line.

## Relative timeline
- **Day 0**: the attack is detected; the company shuts down its IT systems to contain it and stops production in all plants.
- **Days 1 to 7**: plants stay idle; dealers cannot order vehicles or parts; suppliers' deliveries are halted and their own lines stop for lack of call-offs.
- **Weeks 2 to 4**: smaller suppliers face cash-flow crises and temporary layoffs; government and banks discuss support for the supply chain.
- **Weeks 4 to 6 onwards**: phased restart of systems and plants, slowed by the need to validate production systems and resynchronize the supply chain.
- **Following months**: national vehicle output for the month falls by around 30 %, with a visible effect on national economic figures.

## Decision points
- Shut down all systems and stop every plant immediately, or try to isolate and keep some lines running?
- What do we tell thousands of suppliers who need to know whether to keep producing, and through which channel if email is down?
- Should the manufacturer pay suppliers for undelivered parts to keep them alive, and who authorizes it?
- In which order are plants, logistics and dealer systems restored?
- How is the restart validated: clean systems, trustworthy data, safe production?
- Who speaks to government, unions and the press about jobs and the wider economy?

## Impacts
- Weeks without production at the manufacturer.
- Over 5,000 organizations in the supply and distribution chain affected; many small suppliers pushed toward insolvency.
- Estimated total cost up to around two billion, among the most expensive cyber incidents ever recorded in its country.
- A measurable drop in national manufacturing output and a political debate on support for the supply chain.

## Lessons
- In just-in-time manufacturing, a cyber incident at the hub becomes a supply-chain and economic crisis within days.
- Plants that share infrastructure with corporate IT stop when IT is shut down; segmentation and the ability to run production in isolation matter.
- Crisis communication must reach suppliers and dealers when corporate systems are offline: keep out-of-band contact lists and channels.
- Financial continuity of critical suppliers is part of recovery planning.
- Recovery planning must cover restarting the ecosystem, not only the company.

## Inject ideas
- A plant manager asks whether to stop the line now or finish the shift.
- A tier-1 supplier's CEO calls: should they keep producing parts that cannot be delivered?
- Dealers cannot register vehicles already sold to customers; customers complain on social media.
- The labor representatives ask about the workers sent home.
- A government ministry requests a briefing on the impact on the national supply chain.
- The restart plan must choose which plant comes back first.
- **In the Library**: the TTX-Zone scenario "manufacturing-standstill" plays this case end to end.
