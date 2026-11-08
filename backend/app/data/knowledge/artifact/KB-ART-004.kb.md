---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-004"
kind: "artifact"
title: "Control-room alarm summary: communications lost with many remote sites"
summary: "The shift operator's alarm summary when telemetry from dozens of remote sites drops at once and some field devices stop answering: it looks like a telecom fault, not an attack."
language: "en"
sectors: ["energy-utilities", "ot-manufacturing"]
families: ["ot_ics", "wiper_destructive"]
capabilities: ["detection_triage_escalation", "incident_classification", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["ics:T0829", "ics:T0827", "ics:T0815", "ics:T0816"]
attack_groups: []
related: ["KB-CAS-001", "KB-TRD-004"]
source_class: "sector-incident-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "security_tool"
actor: "insider"
variables: ["organization_short", "critical_service", "sites_affected", "sites_total"]
variable_defaults: {"sites_affected": "27", "sites_total": "34"}
---
# Control-room alarm summary: communications lost with many remote sites

## Purpose
The first sign of a destructive OT attack, presented the way operators actually see it: a flood of communication alarms. It tests whether the operations team escalates to cybersecurity, whether it can keep running without remote view and control, and who declares an incident when the cause is unknown.

## Template
{organization_short} control room -- {critical_service} -- shift alarm summary (auto-generated, last 30 min)

- COMM FAIL: remote terminal units not responding at {sites_affected} of {sites_total} remote sites (alarms raised in sequence over 40 minutes).
- Telemetry stale: last good values held on screen; quality flag "not updated".
- Remote commands: rejected or timed out at all affected sites.
- Two sites: protection relay status unknown; last message "device restarting".
- One site: RTU answers ping, then drops; local technician reports it is rebooting in a loop.
- Telecom provider network status page: no incident declared.

Operator note: production at affected sites assumed normal (no trips reported locally). Telecom fault suspected. Duty engineer and telecom provider called. Next check in 30 minutes.

## Variants
- **Plant-level**: instead of remote sites, all HMIs in one plant freeze and show a black screen; endpoint protection alerts arrive at the same time.
- **Partial recovery**: some sites come back with values that look wrong; can the data be trusted?
- **Weekend**: the summary lands with a skeleton crew, and the duty engineer is two hours away.
- **Simultaneous IT alerts**: the SOC reports mass file changes on domain controllers in the same hour.
- **In the Library**: TTX-Zone inject INJ-ICS-03, ready to copy into an MSEL.

## Realism notes
- Loss of communications rarely stops field equipment immediately: generation or production often continues, which is exactly why it can be misread as a telecom problem.
- The sequential pattern (sites dropping one after another in address order) is a clue to automation that operators may not notice.
- Operations teams default to engineering explanations; the escalation path to cybersecurity is often unclear or untested.
- Expected good outcome: treat it as a possible cyber event early, preserve evidence, switch affected sites to local operation, and decide on field dispatch with safety in mind.
