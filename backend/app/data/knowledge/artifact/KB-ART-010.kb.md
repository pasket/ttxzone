---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-010"
kind: "artifact"
title: "Chief executive's all-staff email sent before the crisis team agreed it"
summary: "Well-meaning but premature: the chief executive emails all staff from a possibly compromised mailbox, confirming a cyberattack, speculating on the attacker, promising that no data was stolen and giving a restoration date the IT team never committed to."
language: "en"
sectors: ["cross-sector"]
families: ["generic", "ransomware"]
capabilities: ["internal_external_comms", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-ART-005", "KB-CAS-002"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "email"
actor: "insider"
variables: ["organization", "critical_service", "restoration_promise"]
variable_defaults: {"restoration_promise": "by Monday morning"}
---
# Chief executive's all-staff email sent before the crisis team agreed it

## Purpose
Tests internal communication discipline and the crisis team's relationship with top management. The email is now public in practice (staff forward it, journalists receive it), contains claims that may prove false, and was sent through a channel the attacker may be reading. Players must decide how to correct course without undermining the chief executive.

## Template
From: Chief Executive Officer
To: All staff
Subject: Important: cyberattack on {organization}

Dear colleagues,

As many of you have noticed, {organization} has been the victim of a sophisticated cyberattack, most likely by a foreign criminal group. Our IT team reacted immediately and the situation is under control.

I want to reassure you that no customer or employee data has been stolen. {critical_service} will be fully restored {restoration_promise}.

In the meantime, please do not use your computers, and use your personal phones and email to stay in contact with your teams. If anyone from the press contacts you, feel free to tell them that we have everything under control.

Thank you for your patience and commitment.

Chief Executive Officer

## Variants
- **Leaked**: the email appears in a news article an hour later, quoted in full.
- **Answered by the attacker**: a reply-all arrives from an external address contradicting the "no data stolen" claim with a sample file.
- **Board member**: instead of the chief executive, a board member posts a similar message on a professional social network.
- **Too quiet**: the opposite problem; management forbids any internal communication, and rumours spread on staff chat groups.
- **In the Library**: TTX-Zone inject INJ-GEN-04, ready to copy into an MSEL.

## Realism notes
- Early internal messages often promise too much ("no data affected", "back tomorrow") and attribute too soon; they become evidence in later regulatory and legal scrutiny.
- Telling staff to use personal email and phones creates new data protection and security issues.
- Sending through the corporate mailbox during a compromise may tip off the attacker.
- Expected good outcome: a short corrective message agreed by the crisis team, a single source of truth for staff, an out-of-band channel, and a frank conversation with the chief executive about roles.
