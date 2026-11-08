---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-001"
kind: "trend"
title: "Ransomware tempo: from first login to extortion in hours"
summary: "Extortion intrusions now move from initial access to domain compromise in hours, start through stolen identities rather than exploits, steal data in most cases and strike outside business hours; encryption is no longer guaranteed."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware", "data_breach"]
capabilities: ["detection_triage_escalation", "crisis_decision_making", "continuity_recovery"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1078", "enterprise:T1110", "enterprise:T1566", "enterprise:T1219", "enterprise:T1003.003", "enterprise:T1685", "enterprise:T1490", "enterprise:T1567.002", "enterprise:T1486"]
attack_groups: []
related: []
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-30"
---
# Ransomware tempo: from first login to extortion in hours

## Overview
Extortion crews have compressed their timelines. Attackers rarely "break in" any more; they log in with credentials bought from access brokers, harvested by infostealers, phished through adversary-in-the-middle kits, or obtained by talking the help desk into a password or MFA reset. Once inside they head straight for the directory and the virtualization layer, steal data first and encrypt last, if at all. Better endpoint detection has made full encryption less certain, so many intrusions end as pure data-theft extortion. The defender's window to detect, decide and contain is measured in hours, often overnight.

## Indicative figures
Ranges across several large incident-response and threat-intelligence datasets for the period; use them as orders of magnitude, not precise values.
- Median attacker dwell time: about 2 to 14 days depending on the dataset; most intrusions are detected within a week, around half within 48 hours.
- Breakout time (first lateral movement after access): about 30 minutes on average; the fastest cases take under a minute.
- Hand-off from the initial access broker to the ransomware affiliate: seconds in the median case, no longer hours.
- First attempt on the directory servers: a median of about 3 to 4 hours after initial access.
- Root cause: identity compromise (valid credentials, brute force, token theft, phishing) in roughly 40 to 70 % of cases; exploitation of internet-facing devices in about 15 to 20 %.
- Data exfiltration happens in roughly 50 to 80 % of ransomware cases; pure data-theft extortion without encryption in about 10 to 15 %.
- About 4 in 5 detections involve no malware at all, only legitimate tools and accounts.
- Over 40 % of ransomware attacks touch both on-premises and cloud resources.
- Unpaid victims whose data was taken see it published, in about half of cases, roughly three weeks after exfiltration.

## Typical attack chain
1. **Access**: valid accounts (T1078) from brokers or infostealers, password spraying against remote access (T1110), phishing or voice phishing of the help desk (T1566).
2. **Foothold**: a legitimate remote monitoring and management tool installed by the attacker or by a deceived employee (T1219).
3. **Credentials**: dump of the directory database (T1003.003), sometimes by mounting a domain controller's virtual disk on a machine the defenders don't monitor.
4. **Defense impairment**: endpoint protection disabled with vulnerable signed drivers or dedicated "EDR killer" tools (T1685).
5. **Exfiltration**: bulk transfer with synchronization or file-transfer utilities to commercial cloud storage (T1567.002).
6. **Recovery sabotage**: shadow copies, backup jobs and hypervisor snapshots deleted (T1490).
7. **Impact**: encryption of the hypervisor's datastores, taking every guest server down at once (T1486), followed by the extortion demand.

## Realistic timings
- Use a compressed but credible story clock: access at T+0, directory credentials by T+3 h, exfiltration running by T+4 to 6 h, encryption that same night or within 1 to 3 days.
- Roughly 85 to 90 % of ransomware deployments happen outside business hours; the busiest window is about 23:00 to 03:00 local time, with a slight peak on Thursdays and Fridays. Exfiltration also runs mostly off-hours.
- Data publication on the leak site, if unpaid: around 2 to 4 weeks after exfiltration.
- Full recovery of an encrypted virtualized estate: days for priority services, weeks to months for everything else.

## Exercise hooks
- Start the scenario at night or before a long weekend: who is on call, who can authorize isolating the hypervisors at 02:00? (INJ-RAN-01)
- Make the backups unreliable to force the continuity discussion (INJ-RAN-03).
- Run a branch where encryption fails but the data was already taken: does the organization still treat it as a crisis, and which notification clocks start?
- Seed an early, ambiguous signal (an unusual help-desk MFA reset, a remote access tool on a server) and test whether anyone escalates before the impact.
- Publish a sample on the leak site later in the session to test communications and legal coordination (INJ-RAN-06).
