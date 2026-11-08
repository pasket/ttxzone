---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-024"
kind: "artifact"
title: "Second-wave phishing from a colleague's mailbox during the incident"
summary: "While the team is still responding, staff receive an email from a real colleague's account, apparently from IT, asking everyone to 're-validate their account after the security incident' through a link that relays their password and MFA."
language: "en"
sectors: ["cross-sector"]
families: ["phishing_account_takeover"]
capabilities: ["detection_triage_escalation", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1534", "enterprise:T1557", "enterprise:T1539", "enterprise:T1114.003"]
attack_groups: []
related: ["KB-TRD-002", "KB-ART-010"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "response"
delivery_method: "email"
actor: "threat-actor"
variables: ["organization", "organization_short", "colleague_role", "phishing_link"]
variable_defaults: {"colleague_role": "an assistant in the finance department", "phishing_link": "https://sso-revalidate.example.com/login"}
---
# Second-wave phishing from a colleague's mailbox during the incident

## Purpose
Shows that an incident is not static: the attacker uses the confusion and the organization's own announcements to compromise more accounts. It tests whether internal communication has told staff how genuine instructions will arrive, how fast compromised accounts are disabled and sessions revoked, and whether the response team notices it is losing ground.

## Template
From: {colleague_role} (internal account)
To: All staff distribution list
Subject: URGENT -- account re-validation after the security incident

Dear colleagues,

As you know, {organization} is dealing with a security incident. The IT department has asked all employees to re-validate their accounts today to restore secure access. Accounts not re-validated by 17:00 will be disabled.

Please use the secure portal below and sign in with your usual credentials and authenticator:

{phishing_link}

Sorry for the inconvenience -- forwarding on behalf of IT.

Best regards,
{colleague_role}, {organization_short}

## Variants
- **Third wave**: a week later, after delayed resets, a new wave from another compromised account arrives, and this time no MFA prompt appears because sessions were never revoked.
- **SMS version**: staff receive text messages with the same lure on their personal phones.
- **Customers targeted**: the same lure is sent to customers, using the organization's branding and the news coverage.
- **Collaboration tool**: the message arrives as a chat message in the corporate collaboration platform.
- **In the Library**: TTX-Zone inject INJ-PHI-C01, ready to copy into an MSEL.

## Realism notes
- Attackers routinely send follow-up phishing from compromised internal mailboxes, using real names and documents, and add forwarding or hiding rules to conceal replies.
- Relay phishing kits capture credentials and MFA in real time; only revoking sessions and resetting credentials stops the attacker.
- Incidents and announcements make "security" lures more credible, not less.
- Expected good outcome: purge the message, disable the sender account and revoke sessions, identify who clicked, and send an internal message stating how genuine IT instructions will be delivered.
