---
format: "ttx-zone.scenario"
format_version: 5
language: "en"
title: "Supplier invoice fraud"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Supplier invoice fraud

A message that looks like it comes from a long-standing supplier asks to change its bank details. The payment goes out, and three days later the real supplier calls. The team stops the bleeding, tries to recover the money and works with the supplier.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Spot and stop the change
- **OBJ-02** Recall the payment
- **OBJ-03** Work with the supplier

## Scenario

A message in an existing email thread with the packaging supplier announces new bank details for its next invoice, due this week.

## Phases and injects

### PH-01 The request

Monday, 09:00. Accounts payable works through the week's invoices.

- **INJ-01** (T+5′) Updated bank details
- **INJ-02** (T+25′) Urgent: please pay today

### PH-02 The money is gone

Thursday, 10:00. The real supplier asks why it hasn't been paid.

- **INJ-03** (T+60′) We were never paid
- **INJ-04** (T+80′) A forwarding rule in our mailbox
- **INJ-05** (contingent) The funds have moved on

### PH-03 The supplier's side

Thursday, 14:00. The supplier's IT has found something.

- **INJ-06** (T+120′) It started with us

## Simulated actors

- **ACT-01** Supplier (impersonated)
- **ACT-02** Packaging supplier
- **ACT-03** SOC
- **ACT-04** The organisation's bank
- **ACT-05** Police cybercrime unit

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Supplier invoice fraud",
    "description": "A message that looks like it comes from a long-standing supplier asks to change its bank details. The payment goes out, and three days later the real supplier calls. The team stops the bleeding, tries to recover the money and works with the supplier."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "audit_finding"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "legal_forensics",
      "third_party_supply_chain"
    ],
    "levels": [
      "tactical",
      "operational"
    ],
    "participating_areas": [
      "Finance",
      "Finance lead",
      "Security operations",
      "Security operations lead",
      "Incident lead",
      "Legal",
      "Procurement"
    ],
    "third_parties": [],
    "perimeter": "Accounts payable, corporate email, the bank relationship and the supplier.",
    "out_of_scope": "Disciplinary measures and the bank's own investigation.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "SILVER QUAY",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Bank details changed by email",
        "finding": "An audit found bank detail changes accepted on email alone, without a call-back.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Slow recall last time",
        "finding": "A past fraudulent payment was reported to the bank the next day and could not be recovered.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "threat_intel",
        "title": "Suppliers as the weak link",
        "finding": "Several peers reported frauds that started in a supplier's compromised mailbox.",
        "affected_capability": "third_party_supply_chain",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Spot and stop the change",
        "statement": "Accounts payable verifies any bank detail change through a known phone number and reports the suspicious messages to security, which scopes the mailbox compromise.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Change verified through a known phone number\nSuspicious messages reported to security\nMailbox compromise scoped",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The call-back record, the report to security and the mailbox findings.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Recall the payment",
        "statement": "Within two hours of discovering the fraud, the bank is asked for a recall, the evidence is preserved and the police report is decided.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Bank recall requested\nMessages preserved as evidence\nPolice report decided",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The recall request, the preserved messages and the decision log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Work with the supplier",
        "statement": "The team contacts the supplier through a known channel, exchanges indicators and agrees how to warn other customers.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Supplier contacted through a known channel\nIndicators exchanged\nWarning to other customers agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The record of the call and the indicators shared.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "A real incident happens during the session.",
        "mitigation": "Anyone can stop the exercise with the stop keyword."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "New bank details",
    "summary": "A message in an existing email thread with the packaging supplier announces new bank details for its next invoice, due this week.",
    "attack_version": "19.2",
    "duration_minutes": 160,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "The request",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Monday, 09:00. Accounts payable works through the week's invoices.",
        "key_questions": [
          "How do we verify a change of bank details?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "New bank details, same thread"
      },
      {
        "code": "PH-02",
        "name": "The money is gone",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Thursday, 10:00. The real supplier asks why it hasn't been paid.",
        "key_questions": [
          "Who calls the bank, and how fast?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "The real supplier calls"
      },
      {
        "code": "PH-03",
        "name": "The supplier's side",
        "start_offset": 110,
        "end_offset": 160,
        "incident_jump_minutes": 180,
        "situation_update": "Thursday, 14:00. The supplier's IT has found something.",
        "key_questions": [
          "What do we share, and with whom?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "It started in their mailbox"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Invoice fraud crew",
        "mitre_group_id": null,
        "aliases": [],
        "description": "A criminal group that takes over mailboxes and impersonates suppliers to divert payments.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1114.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1534"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Updated bank details",
        "content": "Hello, as part of our move to a new bank, please use the account below for invoice 2291 and all future payments. The old account will be closed at the end of the week. Kind regards.",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Finance"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Accounts payable verifies the change by calling the supplier on the number on file.",
            "responsible_role": "Finance lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Accounts, packaging supplier",
          "sender_address": "accounts@packaging-suppiler.example",
          "recipient": "Accounts payable",
          "subject": "RE: Invoice 2291 — updated bank details",
          "timestamp": "Monday 08:47",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Urgent: please pay today",
        "content": "A second message in the same thread insists the payment is overdue and that production will stop if the invoice is not paid today to the new account.",
        "offset_minutes": 25,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Finance"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1534"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Finance reports the messages to security before paying anything.",
            "responsible_role": "Finance lead",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "We were never paid",
        "content": "The real supplier calls about invoice 2291: 248,000 euros, now overdue. Your system shows it paid on Monday, to the new account.",
        "offset_minutes": 60,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Finance lead"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Finance asks the bank for a recall at once and preserves the messages.",
            "responsible_role": "Finance lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "A forwarding rule in our mailbox",
        "content": "Security finds a rule in an accounts payable clerk's mailbox that forwards and hides every message from the supplier, and sign-ins from an unfamiliar country last week.",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Security operations"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1114.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Security operations resets the credentials, removes the rule and checks the other finance mailboxes.",
            "responsible_role": "Security operations lead",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The funds have moved on",
        "content": "The bank says most of the money left the receiving account yesterday for two other banks abroad; a recall is still possible for what remains, if requested now.",
        "offset_minutes": null,
        "trigger_condition": "No recall request 15 minutes after INJ-03.",
        "contingent_purpose": "Show how fast the window closes.",
        "fires_at_minute": 40,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Finance lead",
          "Incident lead"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "The incident lead has the recall requested and the police report filed today.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "It started with us",
        "content": "The supplier's IT confirms one of its mailboxes was taken over a month ago; the attackers wrote to several of its customers. It asks to coordinate.",
        "offset_minutes": 120,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Procurement",
          "Incident lead"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "The incident lead agrees with the supplier on indicators to exchange and a joint warning to its other customers.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-01",
      "name": "Supplier (impersonated)",
      "type": "threat_actor",
      "description": "Writes as the supplier from a look-alike address.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-02",
      "name": "Packaging supplier",
      "type": "supplier",
      "description": "The real supplier: long-standing, invoices monthly.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-03",
      "name": "SOC",
      "type": "soc",
      "description": "The security operations centre: alerts, findings and requests for decisions.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "bank",
      "origin_name": "The organisation's bank",
      "code": "ACT-04",
      "name": "The organisation's bank",
      "type": "other",
      "description": "The bank: suspicious transfers, fund recalls and recovery deadlines.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Police cybercrime unit",
      "code": "ACT-05",
      "name": "Police cybercrime unit",
      "type": "authority",
      "description": "Law enforcement investigating the attack and asking for evidence.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 6,
  "tags": [
    {
      "origin": "system",
      "origin_id": "bec",
      "origin_name": "BEC / CEO fraud",
      "name": "BEC / CEO fraud",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "legal-compliance",
      "origin_name": "Legal & compliance",
      "name": "Legal & compliance",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "supplier",
      "origin_name": "Supplier",
      "name": "Supplier",
      "color": "sand",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1,
  "files": []
}
```
