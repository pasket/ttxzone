---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-007"
kind: "trend"
title: "Hacktivist DDoS and claimed OT intrusions driven by geopolitics"
summary: "Pro-state hacktivist collectives flood public administration, banks and transport websites with denial-of-service traffic after political decisions, amplify every claim on messaging channels, and increasingly boast about tampering with exposed industrial control panels."
language: "en"
sectors: ["public-administration", "finance", "transport-logistics", "energy-utilities"]
families: ["ddos", "ot_ics"]
capabilities: ["detection_triage_escalation", "internal_external_comms", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1583.005", "enterprise:T1498.001", "enterprise:T1499.002", "enterprise:T1491.002", "ics:T0883", "ics:T0814"]
attack_groups: ["G1027"]
related: ["KB-TRD-004", "KB-ART-006"]
source_class: "government-assessment"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Hacktivist DDoS and claimed OT intrusions driven by geopolitics

## Overview
Ideological and pro-state hacktivist groups respond to political events (military aid, sanctions, elections, arrests of their members) with campaigns against the countries involved. Their main weapon is distributed denial of service, organized through volunteer networks that download a shared attack tool and receive daily target lists, sometimes rewarded with small payments. Targets are chosen for visibility: ministries, tax and customs portals, banks, airports, ports, public transport and city councils. Most attacks cause little real disruption, but every attempt is announced on messaging channels with screenshots from website-monitoring services, aiming for media coverage and a feeling of insecurity. Increasingly, the same channels claim intrusions into industrial systems, usually internet-exposed control panels of water, energy or building systems with default or no passwords. Some personas are fronts for state services, as with CyberAv3ngers, linked to the targeting of industrial controllers in water and fuel systems.

## Indicative figures
- Denial of service makes up roughly three quarters of reported incidents in some regional datasets, and around 80 % of those are attributed to hacktivists.
- Only a small fraction (around 2 %) of hacktivist DDoS attacks causes an actual service interruption; most are absorbed or last minutes.
- Public administration is the most targeted sector in regional reporting (over a third of incidents); in finance, banks take most attacks (over half), followed by finance-related government portals (about a fifth).
- Campaigns can run near-daily for months against one country after a triggering event.
- Claimed attacks on industrial systems rose sharply (about 50 %) in some months of the period, mostly against small exposed installations.

## Typical attack chain
1. **Trigger**: a political announcement or the arrest of members; the group publishes a target list for the next days.
2. **Resources**: volunteers run the shared tool; rented botnets and proxies add volume (T1583.005).
3. **Flooding**: network floods and, more effectively, application-layer requests against search, login or booking functions (T1498.001, T1499.002).
4. **Claim**: screenshots of "site down" results posted within minutes, often before or regardless of actual impact.
5. **Escalation for visibility**: defacement of a weak site (T1491.002) or a video of someone operating an exposed control panel (ics:T0883, ics:T0814).
6. **Repeat**: new waves when the target recovers or responds publicly.

## Realistic timings
- Notice: a target list can appear on the group's channel hours before the attack; many organizations never look.
- Individual waves: minutes to a few hours; campaigns: days to weeks.
- Mitigation through a scrubbing service or content delivery network: minutes if contracted and pre-configured, hours to days if contracted during the attack.
- Media interest peaks within the first day, even when the outage lasted minutes.

## Exercise hooks
- The organization appears on a hacktivist target list the evening before an important public event (KB-ART-006).
- The online portal is slow during the deadline day of a public service; is it an attack, real demand, or both?
- A journalist asks about a video showing someone changing setpoints on what looks like the organization's control panel.
- Test the contract and runbook with the DDoS mitigation provider: who calls, who can reroute traffic, how long it takes.
- Discuss communication: say nothing, deny, or explain that service is degraded but data is safe?
