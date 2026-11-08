---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-014"
kind: "trend"
title: "Public administration and local government: the most targeted, the slowest to recover"
summary: "Public bodies receive the largest share of reported incidents, mostly denial of service, but ransomware against municipalities and regional bodies causes the real damage: weeks without digital services, months of backlog, and stolen citizen data; state espionage targets ministries quietly."
language: "en"
sectors: ["public-administration"]
families: ["ransomware", "ddos", "data_breach"]
capabilities: ["continuity_recovery", "internal_external_comms", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1133", "enterprise:T1078", "enterprise:T1566.001", "enterprise:T1486", "enterprise:T1490", "enterprise:T1567.002", "enterprise:T1498"]
attack_groups: ["G0007"]
related: ["KB-TRD-001", "KB-TRD-007"]
source_class: "government-assessment"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Public administration and local government: the most targeted, the slowest to recover

## Overview
Public administration is the sector with the most reported incidents in regional reporting. Most are hacktivist DDoS against electronic offices and ministry websites, visible but usually short. The damaging incidents are ransomware attacks on municipalities, provincial and regional bodies, universities and public agencies with small IT teams, old systems, many exposed services and limited budgets. When they hit, citizens cannot register, pay taxes, request permits or reach social services; staff fall back to paper and appointments; payroll and supplier payments stall. Citizen databases (tax, social services, census, police reports) are stolen and published. At the other end, state groups such as APT28 run quiet espionage campaigns against ministries and agencies through phishing and exposed systems. National SOC networks and shared services for local entities exist precisely because small municipalities cannot defend alone.

## Indicative figures
- Public administration accounts for over a third of reported incidents in regional threat reporting, the large majority of them DDoS.
- Roughly 30 to 45 % of government breaches involve ransomware; local and regional governments are over 40 % of government ransomware victims.
- Initial containment typically takes one to three weeks; full recovery and backlog clearance take months, and average recovery from a breach in some national surveys exceeds seven months.
- National CSIRTs handle hundreds of thousands of incidents per year; around 10 to 15 % are rated very high or critical.
- Regional public SOCs report year-on-year increases of 40 % or more in attacks handled.

## Typical attack chain
1. **Entry**: exposed remote access without MFA (T1133), reused credentials (T1078) or phishing of staff (T1566.001).
2. **Spread**: shared domain across departments, sometimes with schools and utilities of the same municipality.
3. **Theft**: citizen records and internal documents copied out (T1567.002).
4. **Impact**: encryption of servers, file shares and backups (T1486, T1490); electronic office and website down.
5. **Pressure**: publication of citizen data; DDoS or media pressure in parallel (T1498).

## Realistic timings
- Electronic office down from day 0; essential services (civil registry, social services, emergency coordination) need manual workarounds within hours.
- Payroll and supplier payments become critical within one to two weeks.
- Recovery depends on provincial or national support services; queues form when several entities are hit.
- Political and media pressure peaks in the first days and returns whenever data is published.

## Exercise hooks
- The town hall's electronic office and internal systems are encrypted on the first day of the tax payment period.
- The mayor's office wants to hold a press conference before the scope is known.
- Citizens' social services files appear on a leak site; some include minors.
- Ask what the municipality can do alone and what it must request from the regional or national support service.
- Test continuity of payroll, permits and emergency coordination without digital systems.
