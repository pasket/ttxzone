---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-002"
kind: "artifact"
title: "Help-desk ticket: MFA reset after a phone call, then an unusual sign-in"
summary: "A routine-looking service ticket in which a help-desk analyst records resetting an executive's password and MFA on a phone request, followed by an automated sign-in alert an hour later."
language: "en"
sectors: ["cross-sector"]
families: ["phishing_account_takeover", "ransomware"]
capabilities: ["detection_triage_escalation", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1566.004", "enterprise:T1078", "enterprise:T1098.005"]
attack_groups: []
related: ["KB-TRD-002", "KB-CAS-002"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "ticket"
actor: "insider"
variables: ["organization_short", "requester_role", "ticket_id", "signin_location"]
variable_defaults: {"requester_role": "the Head of Finance", "ticket_id": "INC-104857", "signin_location": "a country where the organization has no staff"}
---
# Help-desk ticket: MFA reset after a phone call, then an unusual sign-in

## Purpose
An early, ambiguous signal that tests whether anyone connects a routine service request with a security alert. Used at the very start of an identity-led scenario, it checks detection and escalation habits, the help desk's verification procedure, and who can decide to revoke an executive's sessions.

## Template
Ticket {ticket_id} -- Category: Access / MFA -- Priority: P3 -- Status: Resolved

Caller identified as {requester_role} by phone (internal callback number not used: caller said they were travelling and had lost their phone). Verified with employee number and manager's name. Password reset, existing MFA methods removed, new authenticator registered by the caller during the call. User confirmed access to email and the {organization_short} portal. Closed on first contact.

Automated update (+58 min): identity platform alert "Sign-in from unfamiliar location" for the same account, from {signin_location}, new device, MFA satisfied. Alert severity: medium. No action taken; ticket remains resolved.

## Variants
- **Several resets**: two more privileged users (an IT administrator and a cloud engineer) were reset the same day by phone.
- **Real traveller**: the executive really is travelling; the alert is a false positive, and the scenario turns into testing proportionality.
- **Self-service**: no call at all, just a self-service MFA re-registration followed by mailbox forwarding rules.
- **Supplier help desk**: the reset was done by the outsourced IT provider, whose logs the organization cannot see directly.
- **In the Library**: TTX-Zone inject INJ-PHI-03, ready to copy into an MSEL.

## Realism notes
- Real tickets are terse, full of abbreviations and closed quickly; they are not written to look suspicious. Keep the verification step plausible but weak (data an attacker can find online).
- The alert is medium severity and lands in a queue: the point is that nobody reads both.
- Attackers often call at shift changes or late on a Friday, claiming urgency and seniority.
- Expected good outcome: someone links the reset to the alert, calls the executive on a known number, revokes sessions and escalates as a potential incident.
