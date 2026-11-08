---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-002"
kind: "trend"
title: "Identity is the new perimeter: help-desk fraud, MFA bypass and stolen sessions"
summary: "Most intrusions now start with a legitimate login: credentials from infostealers, help-desk staff talked into resetting passwords and MFA, phishing kits that relay MFA in real time, stolen session tokens and abused SaaS integrations."
language: "en"
sectors: ["cross-sector"]
families: ["phishing_account_takeover", "ransomware", "cloud_compromise"]
capabilities: ["detection_triage_escalation", "incident_classification", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1078", "enterprise:T1110.003", "enterprise:T1566.004", "enterprise:T1621", "enterprise:T1539", "enterprise:T1550.004", "enterprise:T1528", "enterprise:T1098.005", "enterprise:T1114.003", "enterprise:T1564.008"]
attack_groups: ["G1015"]
related: ["KB-TRD-001", "KB-CAS-002", "KB-ART-002"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Identity is the new perimeter: help-desk fraud, MFA bypass and stolen sessions

## Overview
Attackers increasingly authenticate rather than exploit. The cheapest route is a valid account: credentials and browser session cookies harvested by infostealer malware and resold by access brokers, or obtained by calling the IT help desk while impersonating an employee and asking for a password and MFA reset. Phishing has moved to adversary-in-the-middle kits that proxy the real login page and relay the MFA prompt within seconds. Long-lived, unbound session tokens let an attacker return for days without a new MFA challenge. Non-human identities (service accounts, API keys, OAuth tokens held by SaaS integrations) are a growing blind spot. Groups such as Scattered Spider built their reputation on help-desk voice phishing followed by very fast moves into the cloud identity provider and the virtualization layer.

## Indicative figures
- Identity compromise (stolen credentials, brute force, token theft, phishing) is the leading root cause of intrusions, in roughly 40 to 70 % of incident-response cases depending on the dataset.
- Password spraying and brute force make up the vast majority (over 95 %) of attacks against identity platforms by volume; token theft, real-time MFA relay and MFA abuse are under 3 % but cause a disproportionate share of serious incidents.
- Valid-account abuse accounts for about a third of cloud incidents.
- Initial access brokers obtain their access mostly through credentials (around 80 %) and less through vulnerabilities (under 20 %).
- Help-desk-initiated intrusions have gone from the reset call to directory credential theft in about 3 hours.
- Large organizations carry thousands of stale but enabled accounts that keep full access.

## Typical attack chain
1. **Credentials**: infostealer logs bought from brokers, or password spraying against single sign-on and remote access (T1110.003, T1078).
2. **MFA**: a call to the help desk posing as an employee who "lost the phone" (T1566.004), push-notification fatigue (T1621), or an adversary-in-the-middle page that captures the session cookie (T1539).
3. **Persistence**: the attacker registers their own device or authenticator (T1098.005) and replays stolen session cookies (T1550.004).
4. **Discovery**: searches in document-sharing sites for network diagrams, passwords and VPN guides; access to the privileged access manager.
5. **Cloud and SaaS**: OAuth tokens of integrated applications stolen to reach connected data stores (T1528).
6. **Concealment**: mailbox forwarding and hiding rules to read and suppress security notifications (T1114.003, T1564.008).
7. **Monetization**: data theft, internal phishing from the compromised mailbox, fraud or ransomware.

## Realistic timings
- Help-desk call to first authentication: minutes. To discovery in document shares: within the first hour. To directory credential theft: about 3 hours in fast cases.
- Real-time MFA relay replays the captured code within seconds of the victim entering it.
- A stolen session cookie can stay valid for days or weeks if tokens are long-lived and not bound to the device.
- Infostealer infection to resale of the credentials: days; to use by a ransomware affiliate: often within the same week.

## Exercise hooks
- Open with an apparently routine help-desk ticket: an executive's MFA was reset after a phone call, and an hour later there is a new sign-in from an unusual country (KB-ART-002).
- Ask who has the authority to force a global sign-out and revoke all sessions in the middle of the business day, and what it will break.
- Test the help desk's identity verification procedure: would it have stopped the call?
- Add a SaaS twist: a third-party integration's token was stolen at the vendor, and the organization's customer data was read through it.
- Measure detection: which alert would have fired first, and who would have looked at it?
