---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-005"
kind: "artifact"
title: "Journalist's request for comment with a publication deadline"
summary: "A reporter emails the press office saying they are about to publish a story on an incident at the organization, quoting an anonymous source and leaked details, and asks for a statement within the hour."
language: "en"
sectors: ["cross-sector"]
families: ["generic", "ransomware", "data_breach"]
capabilities: ["internal_external_comms", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-CAS-002", "KB-CAS-004", "KB-CAS-005"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "escalation"
delivery_method: "email"
actor: "media"
variables: ["organization", "critical_service", "reporter_role", "media_outlet", "leaked_detail", "publication_deadline"]
variable_defaults: {"reporter_role": "technology correspondent", "media_outlet": "a national business newspaper", "leaked_detail": "an internal message telling staff not to use their computers", "publication_deadline": "in one hour"}
---
# Journalist's request for comment with a publication deadline

## Purpose
Moves the incident from a technical problem to a public one, and usually earlier than the team expects. It tests whether a holding statement exists, who can approve it, how fast, and whether communications, legal and the incident lead tell the same story. It also exposes leaks: the journalist knows something that only staff should know.

## Template
Subject: Request for comment -- {organization} -- publishing {publication_deadline}

Hello,

I'm the {reporter_role} at {media_outlet}. We are preparing a story about a cyber incident affecting {organization}. According to a source inside the company, {critical_service} has been disrupted since this morning, and we have seen {leaked_detail}.

We would like to give you the opportunity to comment before we publish {publication_deadline}. In particular:

1. Can you confirm that {organization} has suffered a cyberattack?
2. Has any customer or employee data been stolen?
3. Have you received a ransom demand, and do you intend to pay?
4. When do you expect {critical_service} to be back to normal?

If we don't hear from you, we will state that {organization} did not respond to our request.

Best regards,
The {reporter_role}

## Variants
- **Leak-site source**: the journalist cites the attackers' leak site, which lists the organization and a sample of files.
- **Phone call**: the reporter calls the switchboard and gets put through to an employee who doesn't know what to say.
- **Attacker contact**: the journalist says the attackers contacted them directly and gave them a statement.
- **Wrong facts**: the story contains a serious error (for example, that patient or customer data was published) that the organization must decide whether to correct.
- **In the Library**: TTX-Zone inject INJ-GEN-03, ready to copy into an MSEL.

## Realism notes
- Real requests for comment give short deadlines and close with "did not respond"; that pressure is part of the exercise.
- The details in the email should be partly right and partly wrong, so Players must decide what to confirm without lying.
- Expected good outcome: a pre-approved holding statement released quickly, a single spokesperson, no speculation about the attacker or payment, and staff reminded not to talk to the press.
- Pair it with an internal inject about the source of the leak.
