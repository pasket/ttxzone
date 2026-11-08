---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-005"
kind: "case"
title: "Nationwide blackout of unknown cause: continuity first, cyber hypothesis open"
summary: "A sudden collapse of the national power grid leaves a whole region without electricity for most of a day; telecoms, payments, transport and public services fail in cascade, a cyberattack is suspected for hours before being ruled out, and disinformation fills the gap."
language: "en"
sectors: ["cross-sector", "energy-utilities", "telecom", "transport-logistics"]
families: ["generic", "ot_ics"]
capabilities: ["continuity_recovery", "crisis_decision_making", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-CAS-001", "KB-TRD-004", "KB-ART-004"]
source_class: "trade-magazine"
period: "2025"
reviewed: "2026-10-31"
---
# Nationwide blackout of unknown cause: continuity first, cyber hypothesis open

## Archetype
Any organization in a country whose transmission grid collapses within seconds at midday, with no warning, taking neighbouring areas with it. The organization is not the grid operator: it is a bank, a hospital, a logistics company, a public administration or a manufacturer that suddenly depends on generators, batteries and paper. Nobody knows the cause for hours. Because the grid is critical infrastructure and the geopolitical climate is tense, the first question from executives, media and the public is whether it is a cyberattack. The case is useful precisely because it isn't one: it tests continuity, crisis communication and decision-making under uncertainty, without a technical adversary to chase.

## Relative timeline
- **T+0**: power drops everywhere at once. Data centres switch to UPS and generators; offices, shops, traffic lights and trains stop. Card payments and ATMs fail; airlines halt operations; public offices close counters.
- **T+15 min**: continuity plans are activated across the economy; staff can still call and message, but voice and data quality degrade.
- **T+1 h to T+3 h**: speculation about a cyberattack spreads on social media; authorities say all hypotheses are open. Some organizations shut down systems "just in case".
- **T+3 h to T+6 h**: mobile and fixed networks fail as site batteries run out; generator fuel and refuelling logistics become the bottleneck; people are trapped in trains and lifts.
- **T+6 h to T+12 h**: officials say there is no evidence of a cyberattack; power returns region by region through the night.
- **T+18 h to T+24 h**: most supply restored; organizations restart systems, reconcile transactions and assess damage.
- **Following days**: disinformation campaigns blame specific energy sources; price spikes; investigations and parliamentary questions about resilience and supplier dependencies.

## Decision points
- Shut down IT systems preventively because "it might be cyber", or keep running on backup power?
- Which services are kept alive on limited generator fuel, and for how long?
- How do we reach staff, customers and suppliers when phones and internet fail?
- Send people home, keep them, or protect those trapped in transit?
- What do we say publicly when nobody, including the authorities, knows the cause?
- When power returns, restart everything at once or in a controlled sequence with integrity checks?

## Impacts
- Hours without payments, transport, telecoms and many public services across an entire country.
- Organizations without tested generators or fuel contracts stop completely; those with them discover dependencies on suppliers who didn't.
- Lost and inconsistent transactions; equipment damaged by uncontrolled shutdowns and restarts.
- Loss of public trust and a wave of disinformation that outlives the outage.

## Lessons
- Continuity plans must assume loss of power and telecoms at the same time, for longer than a few hours.
- Resilience depends on the whole supply chain: providers, subcontractors and their own backup arrangements.
- A cyber hypothesis must be investigated without paralysing the response: assign someone to it, keep running on the rest.
- Prepare holding statements for incidents of unknown cause; silence is filled by rumours.
- Practice controlled restarts: systems, data integrity and industrial processes.

## Inject ideas
- The control room reports that the national grid is down; generators started, fuel autonomy is 8 hours (KB-ART-004, variant "plant-level").
- A board member asks whether to disconnect from the internet because "it's surely a cyberattack".
- Mobile coverage disappears; the crisis committee has no way to reach the field teams.
- A viral post claims a hacker group has taken down the grid and will hit banks next.
- Power is back; the operations director wants every system restarted immediately to recover lost revenue.
- A key supplier announces it cannot deliver for several days because its own site had no backup power.
- **In the Library**: the TTX-Zone scenario "nationwide-blackout" plays this case end to end.
