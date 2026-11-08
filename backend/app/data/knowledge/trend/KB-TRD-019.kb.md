---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-019"
kind: "trend"
title: "Vulnerability exploitation at machine speed: zero-days and n-days on the edge"
summary: "Exploitation of vulnerabilities, above all in firewalls, VPNs and other edge devices, is a leading way in; mass exploitation of edge flaws now starts on or before the day of disclosure, while organizations take weeks to patch and often never check whether they were compromised in between."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware", "data_breach", "supply_chain"]
capabilities: ["detection_triage_escalation", "incident_classification", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1595.002", "enterprise:T1588.005", "enterprise:T1190", "enterprise:T1133", "enterprise:T1505.003"]
attack_groups: []
related: ["KB-TRD-005", "KB-ART-012", "KB-TRD-013"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Vulnerability exploitation at machine speed: zero-days and n-days on the edge

## Overview
The time between a vulnerability becoming known and attackers exploiting it at scale has collapsed. Scanning for a newly announced flaw starts within minutes; for edge devices (firewalls, VPN gateways, remote-access appliances, load balancers, file-transfer servers), mass exploitation frequently begins before or on the day the vulnerability is published, because state groups and criminals already had it as a zero-day. These devices sit outside endpoint protection, keep logs for days at most, and hold credentials for the whole network. Defenders patch slower: weeks for the most critical, months or never for the rest. Patching closes the door but doesn't remove a web shell or a new account planted before. For an exercise, the realistic dilemma is not "patch or not", but "we patched yesterday: were we already inside?".

## Indicative figures
- Exploitation of vulnerabilities is the initial access in roughly a fifth of breaches overall, growing year on year, and in most espionage breaches (up to about 70 %).
- Edge devices went from a few percent to over a fifth of exploitation actions in one year.
- Scanning for a newly disclosed vulnerability begins within about 15 minutes.
- Median time to mass exploitation of known exploited vulnerabilities is around five days; for edge devices, zero days, with about half exploited on or before publication.
- Organizations fully remediate only about half of edge vulnerabilities, with a median of about a month; around 30 % remain unmitigated.
- For industrial control system vulnerabilities, median time to a public exploit is a few weeks.

## Typical attack chain
1. **Discovery**: internet-wide scanning for vulnerable versions (T1595.002).
2. **Weaponization**: exploits bought, shared or developed (T1588.005).
3. **Exploitation**: code execution on the edge device or exposed application (T1190).
4. **Persistence**: web shells, new accounts, modified device images (T1505.003).
5. **Use**: harvested VPN credentials and sessions to enter the network (T1133); follow-on espionage, data theft or ransomware.

## Realistic timings
- Disclosure to first scanning: minutes. To mass exploitation: zero to five days.
- Patch available to patch applied in a typical organization: weeks; change windows and fear of downtime delay edge devices further.
- Device logs often cover 24 hours to 7 days, so evidence of pre-patch exploitation may already be gone.
- Compromise discovered later through a CSIRT notice, a threat-intelligence match or the follow-on attack.

## Exercise hooks
- The CSIRT announces exploitation of the organization's VPN product; the patch requires a reboot during business hours (KB-ART-012).
- The vendor's integrity tool flags unknown files on an appliance patched two days ago.
- The firewall logs only go back 48 hours; the vulnerability was exploited in the wild for two weeks before disclosure.
- Ask who can authorize emergency downtime of remote access for the whole company.
- Discuss assets nobody owns: an appliance installed by a supplier years ago.
