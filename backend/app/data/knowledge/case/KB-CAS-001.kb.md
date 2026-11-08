---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-001"
kind: "case"
title: "Coordinated wiper attack on a distributed energy fleet and a heat plant"
summary: "A state-linked actor uses stolen VPN access and factory-default passwords to destroy remote terminal units across dozens of renewable sites and to push a wiper through group policy at a combined heat and power plant, during a winter cold spell."
language: "en"
sectors: ["energy-utilities", "ot-manufacturing"]
families: ["wiper_destructive", "ot_ics"]
capabilities: ["detection_triage_escalation", "crisis_decision_making", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1133", "enterprise:T1078", "enterprise:T1090.003", "enterprise:T1003.003", "enterprise:T1484.001", "enterprise:T1485", "enterprise:T1561", "ics:T0883", "ics:T1694.001", "ics:T0809", "ics:T1693.002", "ics:T0816", "ics:T0829", "ics:T0827"]
attack_groups: ["G0034", "G0035"]
related: ["KB-TRD-001"]
source_class: "sector-incident-report"
period: "2025"
reviewed: "2026-10-30"
---
# Coordinated wiper attack on a distributed energy fleet and a heat plant

## Archetype
A European energy ecosystem: a fleet of a few dozen wind and solar sites, each with a perimeter firewall, remote terminal units (RTUs), protection relays and a local HMI, remotely monitored by distribution operators; and a large combined heat and power (CHP) plant supplying district heating to several hundred thousand customers. An opportunistic manufacturing company is hit the same day by the same actor. The attack is purely destructive: no ransom, no demand. It lands during a winter cold spell, just before a year-end holiday, when staffing is thin and heat demand peaks. Attribution later points, with moderate confidence, to state-linked clusters that ATT&CK tracks as Sandworm Team and Dragonfly.

## Relative timeline
- **About 9 months before**: quiet intrusion at the CHP plant; the attacker steals the directory's credential database and studies the industrial automation systems, then goes silent.
- **4 days before**: automated scanning and login attempts against the RTUs at every renewable site, testing factory-default accounts.
- **Hours before**: reconnaissance with remote administration scripts on the CHP plant's network; a malicious group policy object is staged on the domain controllers.
- **Day 0, early morning (T+0)**: wiper binaries are dropped on HMI workstations and domain controllers.
- **T+12 min**: the wiper is distributed through group policy across the CHP plant's domain.
- **T+15 min to T+2 h**: at the renewable sites, a partly automated sequence logs into RTUs and relays with default credentials, deletes system files or uploads corrupt firmware, device by device in ascending IP order; it stops in a segment as soon as one device resists.
- **T+5 h**: a second, modified wiper is launched at the CHP plant, with attempts over remote desktop to reconfigure server disk arrays; a script-based wiper runs at the manufacturing company.
- **Following days**: field crews visit every affected site to replace or re-flash devices; forensic work is hampered because the wiper destroyed evidence and network traffic was not recorded.

## Decision points
- Operators simultaneously lose telemetry and remote control of dozens of sites: technical fault or attack? Who declares a cyber incident, and how fast?
- Should every site be switched to local or manual operation, and are there enough people to staff them during a holiday cold spell?
- Can telemetry that comes back be trusted, or could the attacker still be issuing commands?
- Disconnect remote access for the whole fleet (losing remaining visibility) or keep it to coordinate?
- When does the incident reach the national authorities and the grid operator, and who speaks to the public about heating continuity?
- In which order are sites restored when spare RTUs and field technicians are scarce?

## Impacts
- Loss of view and loss of control over every affected renewable site; generation itself continues because field equipment keeps running without communications.
- Several RTUs, relays and serial device servers are destroyed beyond on-site repair and must be replaced.
- At the CHP plant, endpoint protection detects the overwriting through decoy files and halts the wiper after it has started on more than 100 machines; heat supply is preserved.
- An estimated capacity of around 1 GW was exposed to an attacker able to stop it at once; on a grid with less inertia, losing it suddenly could have destabilized frequency.

## Lessons
- Single-factor VPN accounts on internet-facing firewalls and factory-default passwords on OT devices turned one perimeter foothold into a fleet-wide destructive capability.
- Standardization cuts both ways: the same firewall model and the same RTU configuration at every site let one technique scale to all of them.
- Response plans for distributed assets must cover the simultaneous loss of many remote sites: manual operation, field dispatch, spare parts and offline copies of configurations.
- Decide in advance which questions an OT incident will need answered (were commands issued, can telemetry be trusted) and collect the data now: OT command logs, IT-OT boundary traffic, remote access audit trails.
- A long, quiet presence months earlier was the real warning sign; credential theft on the domain controllers should trigger a full hunt in the OT environment.

## Inject ideas
- Simultaneous loss of communications with many sites, first reported by the control room as a telecom outage.
- A field technician reports an RTU stuck in a reboot loop and asks whether to replace it or preserve it for forensics.
- Endpoint protection alerts at the plant: mass file modification on HMIs and servers (INJ-WIP-01).
- Payroll and email also go down when the wiper reaches corporate systems (INJ-WIP-C01).
- The grid operator asks for the capacity at risk and the expected restoration time.
- The press asks whether heating is at risk during the cold spell.
- Threat intelligence links the activity to a state-linked group: does attribution change the response or the communication?
- **In the Library**: the TTX-Zone scenario "ot-wiper" plays this case end to end.
