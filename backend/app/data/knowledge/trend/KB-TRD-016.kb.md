---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-016"
kind: "trend"
title: "Hybrid threats: sabotage, proxies and cyber operations blended below the threshold of war"
summary: "State services combine cyberattacks with physical sabotage of cables, rail and depots, arson and threats carried out by proxies recruited online, hoax bomb emails, satellite navigation jamming and hijacked cameras watching transport hubs, all deniable and aimed at eroding trust."
language: "en"
sectors: ["cross-sector", "transport-logistics", "energy-utilities", "telecom", "public-administration"]
families: ["physical_hybrid", "wiper_destructive", "ddos"]
capabilities: ["crisis_decision_making", "cross_unit_coordination", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1190", "enterprise:T1498", "enterprise:T1485", "enterprise:T1491.002", "ics:T0883"]
attack_groups: ["G0034", "G0007"]
related: ["KB-TRD-007", "KB-TRD-004", "KB-TRD-020", "KB-CAS-001"]
source_class: "government-assessment"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Hybrid threats: sabotage, proxies and cyber operations blended below the threshold of war

## Overview
Hybrid campaigns mix cyber, physical and information operations so that each incident looks small, accidental or criminal, while together they test a society's resilience. Intelligence services recruit "throwaway" agents through messaging apps and criminal intermediaries, paying small sums for graffiti, surveillance photos, arson at warehouses, damage to rail signalling or threats against individuals. Undersea cables and pipelines are damaged by ships dragging anchors. Satellite navigation jamming and spoofing disrupt aviation and shipping in whole regions. Hoax bomb emails close schools and public buildings in waves. On the cyber side, groups such as Sandworm Team carry out destructive attacks timed with military or political moments, and APT28 has hijacked internet cameras near ports, rail crossings and border posts to watch logistics flows. Hacktivist personas provide deniability and amplification. For an organization, the key challenge is recognizing that an apparently physical or technical failure may be part of a hostile campaign, and coordinating with authorities without paralysing operations.

## Indicative figures
- Dozens of sabotage, arson and attempted sabotage incidents attributed to state-directed proxies across the region within a single year.
- Proxies are typically recruited online and paid small amounts, often in cryptocurrency, per task.
- Waves of hoax bomb threats reached hundreds of schools and public buildings in several countries within days.
- Destructive operations against internet providers caused outages of several hours; a satellite network attack disabled remote monitoring of thousands of wind turbines far from the conflict.
- Navigation jamming affects air and sea traffic daily in some areas near conflict zones.

## Typical attack chain
1. **Reconnaissance**: hijacked cameras and open sources to observe infrastructure and logistics (ics:T0883 for exposed devices).
2. **Recruitment**: tasks offered through messaging channels to people with no visible link to the sponsor.
3. **Action**: physical damage (cables, signalling, depots) or hoax threats; in parallel, cyber operations such as destructive attacks on exposed systems (T1190, T1485) or DDoS and defacements (T1498, T1491.002).
4. **Amplification**: claims by hacktivist personas and disinformation that exaggerates the impact or blames the authorities.
5. **Repeat and escalate**: probing response times and public reaction.

## Realistic timings
- Physical and cyber events can coincide within hours, but the link is usually established days or weeks later, if ever.
- Cable or rail repairs take days to weeks; navigation interference is intermittent and long-running.
- Authorities may ask organizations for information and discretion before any public attribution.
- Public attribution, when it comes, follows months of investigation.

## Exercise hooks
- A fibre cut isolates a site on the same day the organization's website is hit by DDoS and a hacktivist channel claims both.
- Security staff find a small camera pointed at the loading bay; a former contractor was paid online to install it.
- A hoax bomb email forces evacuation of the headquarters during the crisis committee meeting.
- Ask who liaises with police and intelligence services, and how the organization decides whether an "accident" is reported as a possible attack.
- Discuss staff safety and insider recruitment risk.
