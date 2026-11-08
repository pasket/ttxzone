---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-015"
kind: "trend"
title: "Infostealers and access brokers: the supply chain of initial access"
summary: "Commodity infostealers spread through fake CAPTCHA pages, copy-paste lures and malicious ads, harvest passwords and session cookies, often from personal devices, and brokers resell the access cheaply to ransomware and extortion groups."
language: "en"
sectors: ["cross-sector"]
families: ["phishing_account_takeover", "ransomware", "cloud_compromise"]
capabilities: ["detection_triage_escalation", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1583.008", "enterprise:T1189", "enterprise:T1204.004", "enterprise:T1555.003", "enterprise:T1539", "enterprise:T1650", "enterprise:T1078", "enterprise:T1133"]
attack_groups: []
related: ["KB-TRD-002", "KB-TRD-001"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Infostealers and access brokers: the supply chain of initial access

## Overview
Many serious intrusions begin weeks earlier with an infostealer infection that nobody noticed. The victim is lured to run a command themselves: a fake CAPTCHA or "verify you are human" page that copies a script to the clipboard and asks them to paste it into the Run dialog, a malicious ad for popular software at the top of search results, a fake update or a cracked application. The malware takes everything stored in the browser (passwords, session cookies, tokens, autofill data) and sends it to the operator in minutes. Infections on personal or family computers where employees also log into corporate webmail, single sign-on or VPN are especially valuable, because no corporate tool sees them. The logs are sold in bulk; access brokers sort out corporate access and resell it, cheaply, to ransomware affiliates and extortion groups. Takedowns disrupt individual stealers, but the market recovers in weeks.

## Indicative figures
- Stolen or compromised credentials are the entry point in roughly 40 to 70 % of intrusions, depending on the dataset.
- About 80 % of access offered by brokers is credential-based; under 20 % comes from vulnerability exploitation.
- Most corporate network accesses sell for under about three thousand.
- Copy-paste lures (fake CAPTCHA and similar) became the most common initial access method in some response datasets (close to half of cases); fake CAPTCHA incidents rose several-fold year on year.
- A single fake-CAPTCHA campaign on compromised websites caused thousands of confirmed infections.
- A large share of corporate credentials in stealer logs come from unmanaged devices.
- Coordinated takedowns cut the lifespan of stealer command servers from about seven weeks to under three, but did not end the trade.

## Typical attack chain
1. **Lure**: malicious ad or compromised website (T1583.008, T1189) showing a fake CAPTCHA that tells the user to paste a command (T1204.004).
2. **Theft**: browser passwords and session cookies harvested (T1555.003, T1539).
3. **Resale**: logs sold; a broker verifies corporate access and sells it (T1650).
4. **Use**: an affiliate logs in to VPN, webmail or SSO with the credentials or replays the cookie (T1078, T1133).
5. **Follow-on**: data theft, fraud or ransomware.

## Realistic timings
- Infection to exfiltration of browser data: seconds to minutes.
- Log to sale: hours to days; to use by a buyer: days to weeks.
- Session cookies can bypass MFA until they expire or are revoked.
- Many organizations learn of the infection only during the post-incident investigation.

## Exercise hooks
- The threat-intelligence provider reports that credentials and cookies of three employees appear in a recent stealer log, one of them an administrator.
- An employee admits running a "verification" command on a home laptop used for webmail.
- Ask what the response is: password reset only, or revoke all sessions and check activity for weeks back?
- Discuss policy on personal devices accessing corporate services.
- Use it as the hidden prologue of a ransomware scenario: Players discover later that access was bought.
