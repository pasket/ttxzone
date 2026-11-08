---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-004"
kind: "trend"
title: "Industrial environments: ransomware through IT, exposed devices and state pre-positioning"
summary: "Operations stop mainly because IT ransomware reaches the systems OT depends on, not because of exotic ICS malware; exposed HMIs and default passwords invite hacktivists, and state actors quietly map utilities for later use."
language: "en"
sectors: ["ot-manufacturing", "energy-utilities"]
families: ["ot_ics", "ransomware", "physical_hybrid"]
capabilities: ["detection_triage_escalation", "cross_unit_coordination", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["ics:T0822", "ics:T0886", "ics:T0883", "ics:T1694.001", "ics:T0859", "ics:T0864", "ics:T0836", "ics:T0829", "ics:T0827", "ics:T0828", "enterprise:T1133", "enterprise:T1486"]
attack_groups: ["G1017"]
related: ["KB-CAS-001", "KB-ART-004"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Industrial environments: ransomware through IT, exposed devices and state pre-positioning

## Overview
Most operational outages in plants and utilities come from ordinary IT intrusions, not from industrial malware. Affiliates log into VPN portals, firewalls or vendor tunnels with stolen or default credentials, move laterally with standard administration tools, and encrypt the hypervisors that host SCADA, HMI, historian and engineering workloads. Operators lose view and control without anyone touching a controller. Ransomware against industrial organizations keeps growing, with manufacturing the main target. In parallel, hacktivists scan for internet-exposed HMIs and controllers with default passwords and tamper with parameters, and state-linked groups such as Volt Typhoon pre-position in utilities, stealing network diagrams, GIS data and operating instructions while "living off the land" (and off the plant: abusing native engineering protocols and functions).

## Indicative figures
- Ransomware victims among industrial organizations roughly doubled from about 1,700 to over 3,000 per year across the period, from more than 100 active groups; manufacturing accounts for one half to two thirds of them.
- In industrial ransomware response cases, about a quarter led to a complete site shutdown and three quarters to some operational disruption.
- Typical outage after an OT-affecting incident: at least one week, up to about three weeks; precautionary shutdowns stop production for days.
- More than half of OT security incidents start in the IT environment; internet-exposed devices, engineering workstations and transient devices (vendor laptops, USB media) follow at around 25 to 35 % each.
- Tens of thousands of industrial devices answer industrial protocols directly on the internet; remote access protocols toward external addresses are common in OT networks.
- Around 45 % of industrial sites lack OT-native network visibility; most cannot detect abuse of native administration tools, and command logging is rarely enabled.
- About 30 % of OT investigations start from an unexplained operational issue rather than an alert.

## Typical attack chain
1. **Remote access**: VPN, firewall or vendor tunnel accessed with stolen or default credentials and no MFA (enterprise T1133, ics T0822).
2. **Lateral movement**: remote desktop, SMB, remote management and SSH toward OT-boundary servers (ics T0886), using valid accounts (ics T0859).
3. **Shared infrastructure**: the hypervisors hosting SCADA and HMI virtual machines are encrypted (enterprise T1486), causing loss of view and control (ics T0829, T0827).
4. **Exposed devices**: internet-reachable HMIs and controllers (ics T0883) accessed with factory defaults (ics T1694.001); parameters changed (ics T0836).
5. **Transient assets**: an infected maintenance laptop bridges the air gap (ics T0864).
6. **Business impact**: production and revenue lost while systems are rebuilt and validated (ics T0828).

## Realistic timings
- IT intrusion to OT impact: hours to days; the decision to shut down production as a precaution is often taken within the first hours.
- Restoring OT after hypervisor encryption: about one to three weeks, longer if field devices must be replaced or re-flashed on site.
- Hacktivist tampering with an exposed HMI: minutes, usually announced on social media with screenshots.
- State pre-positioning: months to years of quiet access before any visible action.

## Exercise hooks
- The plant manager wants to stop production as a precaution because IT has ransomware: who decides, on what criteria, and who pays for the lost day?
- Operators lose view of the process but the plant keeps running: can it be run manually, and for how long (KB-ART-004)?
- A hacktivist group posts a screenshot of one of the organization's HMIs: real access or bluff, and what is said publicly?
- Safety first: who certifies that control logic and safety systems are intact before restarting?
- Vendor access: the integrator's remote tunnel is the suspected entry point, and they need it to help recover.
