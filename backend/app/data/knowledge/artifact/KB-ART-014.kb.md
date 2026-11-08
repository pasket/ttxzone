---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-014"
kind: "artifact"
title: "Police cybercrime unit: your data was found on a seized server"
summary: "A cybercrime investigator contacts the organization to say that its data and internal credentials were found on infrastructure seized in an international operation, asks for a contact person and evidence, and requests discretion while the investigation continues."
language: "en"
sectors: ["cross-sector"]
families: ["data_breach", "ransomware"]
capabilities: ["legal_forensics", "incident_classification", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-TRD-015", "KB-TRD-001"]
source_class: "practitioner-experience"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "email"
actor: "police-cybercrime"
variables: ["organization", "data_type", "case_reference", "data_volume"]
variable_defaults: {"case_reference": "CC-OP-7741", "data_volume": "about 40 GB"}
---
# Police cybercrime unit: your data was found on a seized server

## Purpose
A detection that comes from outside and with constraints attached. It tests how the organization handles a police request (verifying it is genuine, who responds, what can be shared), how it starts an investigation into a breach it didn't know about, and how it balances the request for discretion with its own notification obligations.

## Template
Subject: Investigation {case_reference} -- data belonging to {organization}

Good morning,

I am an investigator with the national police cybercrime unit. In the course of an international operation against a criminal group, servers used by the group were seized. During the analysis we identified {data_volume} of data apparently belonging to {organization}, including {data_type} and a list of usernames and passwords from your domain.

We would like to:
1. Arrange a meeting with a contact person from your organization within the next two days.
2. Receive any information you may have about incidents in the last six months, including indicators of compromise.
3. Agree on how to share a copy of the data so that you can confirm its origin.

Please treat this communication as confidential: public disclosure at this stage could affect the ongoing investigation. We understand that you may have legal obligations; we would be grateful if you could coordinate the timing with us.

To verify this request, you may call the unit's switchboard and ask for case {case_reference}.

Kind regards,
Cybercrime Unit

## Variants
- **Ransomware decryptor**: the police also recovered decryption keys and offer them to victims.
- **Phone call**: the contact arrives as a phone call to the switchboard, and the receptionist doesn't know whom to transfer it to.
- **Fake police**: the email is a phishing attempt using a police lure; verification is the point.
- **Old breach**: the data matches a breach the organization investigated and closed a year ago without finding exfiltration.
- **In the Library**: TTX-Zone inject INJ-DBR-12, ready to copy into an MSEL.

## Realism notes
- Law-enforcement takedowns of criminal infrastructure regularly produce victim notifications, often months after the theft.
- Police may ask for discretion, but this does not suspend notification duties; coordinate timing explicitly and document it.
- Always verify through an independent channel; criminals impersonate police too.
- Expected good outcome: verify the contact, appoint a single liaison with legal support, launch a compromise assessment, rotate the listed credentials, and assess notification duties with a clear record of the decision.
