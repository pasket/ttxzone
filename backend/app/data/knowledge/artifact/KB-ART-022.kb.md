---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-022"
kind: "artifact"
title: "Threat intelligence alert: a campaign targeting your sector, with a hit on your domain"
summary: "The threat-intelligence provider warns of an active campaign against the organization's sector, describes the actor's techniques with a confidence level, lists indicators, and notes that a look-alike of the organization's domain was registered two days ago."
language: "en"
sectors: ["cross-sector"]
families: ["phishing_account_takeover", "ransomware"]
capabilities: ["detection_triage_escalation", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1583.001", "enterprise:T1566.004", "enterprise:T1219", "enterprise:T1078"]
attack_groups: []
related: ["KB-TRD-002", "KB-TRD-015"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "email"
actor: "threat-intel-provider"
variables: ["organization", "sector", "lookalike_domain", "report_id"]
variable_defaults: {"lookalike_domain": "it-support-login.example.com", "report_id": "TI-FLASH-0412"}
---
# Threat intelligence alert: a campaign targeting your sector, with a hit on your domain

## Purpose
A proactive start: nothing has happened yet, or it has and nobody noticed. It tests whether intelligence reaches people who act, whether the team turns indicators and techniques into concrete checks and controls within hours, and how it treats probabilistic language ("likely") when deciding to escalate.

## Template
Subject: [FLASH {report_id}] Active social-engineering campaign against the {sector} sector -- relevance: high

Summary
We assess it is likely (60-90 %) that a financially motivated group is conducting an active campaign against organizations in the {sector} sector. Over the past ten days we have observed at least six intrusions following the same pattern.

Observed pattern
1. Registration of look-alike domains mimicking the target's IT support or single sign-on page.
2. Calls to employees and the IT help desk impersonating internal IT staff, asking users to visit the domain and install a remote support tool.
3. Use of the remote tool and captured credentials to access corporate systems; data theft within hours; ransomware in some cases.

Relevance to {organization}
The domain {lookalike_domain}, registered two days ago, imitates your single sign-on portal. We have not observed it in use yet.

Indicators
- Domains: {lookalike_domain}, sso-helpdesk.example.net
- IP addresses: 192.0.2.77, 198.51.100.140
- Caller ID patterns: internal-looking numbers spoofed from external lines

Recommended actions: block the indicators, warn the help desk and staff, restrict unapproved remote-access tools, and review sign-ins from new devices in the last 14 days.

## Variants
- **Already used**: the look-alike domain appears in proxy logs from three employees yesterday.
- **Low confidence**: the alert is rated "possible (40-60 %)"; does it justify waking people up?
- **Peer victim**: the provider adds that a direct competitor was hit last night.
- **Lost in the inbox**: the alert went to a shared mailbox and is found the day after the intrusion.
- **In the Library**: TTX-Zone inject INJ-PHI-04, ready to copy into an MSEL.

## Realism notes
- Good intelligence alerts combine indicators with the actor's behaviour and an explicit confidence level; teams often act only on the indicators and miss the behaviour.
- Look-alike domain registration is a cheap, early signal that is easy to monitor.
- Probabilistic language is standard ("likely", "possible"); the exercise can explore how much certainty decision-makers want.
- Expected good outcome: block indicators, brief the help desk the same day, hunt for the behaviour, take down the domain, and record what was done.
