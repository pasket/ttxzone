---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Retail ransomware that began with a help-desk call"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Retail ransomware that began with a help-desk call

A crew that excels at social engineering calls the outsourced IT help desk, gets an employee's password and MFA reset, and two months later encrypts the virtualization hosts of a retail chain over a long holiday weekend. Stores, online sales and warehouses stop; customer data is stolen. The exercise tests when a glitch becomes a crisis, trust in the outsourced help desk and the customer notification.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Crisis called and contained
- **OBJ-02** Help-desk trust restored
- **OBJ-03** Customers told

## Scenario

On the Saturday of a long weekend, stores of {organization} report that contactless payments fail and click-and-collect bookings are lost. The IT duty manager thinks it is a glitch.

## Phases and injects

### PH-01 Holiday Saturday

Saturday of a long weekend, 11:00. Stores report card payments failing.

- **INJ-01** (T+5′) Tills and click-and-collect fail
- **INJ-02** (T+25′) An MFA reset two months ago

### PH-02 Encryption

Sunday. The virtualization hosts are encrypted; online orders are unreliable.

- **INJ-03** (T+55′) The virtualization hosts are encrypted
- **INJ-04** (T+80′) The help desk provider pushes back
- **INJ-05** (T+95′) Warehouses stop, shelves empty

### PH-03 Customer data

Ten days later. The investigation confirms customer data was taken.

- **INJ-06** (T+115′) Customer data was taken
- **INJ-07** (T+140′) Same crew, other retailers

## Simulated actors

- **ACT-01** Employee
- **ACT-02** SOC
- **ACT-03** Attacker (sender)
- **ACT-04** Managed service provider
- **ACT-05** Incident response provider (retainer)
- **ACT-06** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Retail ransomware that began with a help-desk call",
    "description": "A crew that excels at social engineering calls the outsourced IT help desk, gets an employee's password and MFA reset, and two months later encrypts the virtualization hosts of a retail chain over a long holiday weekend. Stores, online sales and warehouses stop; customer data is stolen. The exercise tests when a glitch becomes a crisis, trust in the outsourced help desk and the customer notification."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "regulatory_notification",
      "third_party_supply_chain"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Security operations",
      "IT",
      "Store operations",
      "E-commerce",
      "Communications",
      "Data Protection Officer",
      "Legal",
      "IT duty manager",
      "CISO",
      "Service desk manager",
      "IT director",
      "Operations director",
      "Head of communications"
    ],
    "third_parties": [
      "Outsourced IT help desk"
    ],
    "perimeter": "Stores, online sales, warehouses, the outsourced help desk and the crisis committee.",
    "out_of_scope": "Negotiation with the attackers.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "EMPTY SHELF",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Store payment failures treated as glitches",
        "finding": "Nobody on duty at weekends can call a cyber crisis.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "The help desk resets MFA on a phone call",
        "finding": "The outsourced help desk verifies callers with data an attacker can find.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Customer data notification untested",
        "finding": "The retailer has never notified millions of customers about a breach.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Crisis called and contained",
        "statement": "The duty team turns the store glitches into a declared cyber incident within 60 minutes, and the committee decides what to switch off.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Incident declared with a lead\nContainment decision recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Duty log and committee minutes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Help-desk trust restored",
        "statement": "Resets by phone are suspended, a stronger verification is agreed with the provider and every administrator's MFA is re-enrolled.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Phone resets suspended\nNew verification agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Provider correspondence.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Customers told",
        "statement": "The team decides the notification to the authority and the message to affected customers, without complete facts.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notification decided\nCustomer notice approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Breach record and the customer notice.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
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
    "title": "A long weekend without tills",
    "summary": "On the Saturday of a long weekend, stores of {organization} report that contactless payments fail and click-and-collect bookings are lost. The IT duty manager thinks it is a glitch.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Holiday Saturday",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Saturday of a long weekend, 11:00. Stores report card payments failing.",
        "key_questions": [
          "Glitch or attack, and who decides on a holiday?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "Tills fail across the chain"
      },
      {
        "code": "PH-02",
        "name": "Encryption",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Sunday. The virtualization hosts are encrypted; online orders are unreliable.",
        "key_questions": [
          "Switch off online sales completely?"
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
        "headline": "The servers are encrypted"
      },
      {
        "code": "PH-03",
        "name": "Customer data",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 14400,
        "situation_update": "Ten days later. The investigation confirms customer data was taken.",
        "key_questions": [
          "What do we tell customers without all the facts?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Customer data was taken"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G1015",
        "origin_name": "Scattered Spider",
        "code": "THR-01",
        "name": "Scattered Spider",
        "mitre_group_id": "G1015",
        "aliases": [],
        "description": "Loose crew skilled at help-desk social engineering that rents a ransomware platform.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567"
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
        "title": "Tills and click-and-collect fail",
        "content": "A regional store manager calls the IT duty line: contactless payments fail in a dozen stores, click-and-collect bookings disappear and queues are growing. 'Is it the bank again?'",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "IT duty manager",
          "Store operations"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Escalates beyond routine support and alerts the crisis committee.",
            "responsible_role": "IT duty manager",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": "system",
        "origin_id": "INJ-PHI-03",
        "origin_name": "A resolved MFA ticket and an unusual sign-in",
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "An MFA reset two months ago",
        "content": "The SOC traces the failing systems to an administrator account. Its password and MFA were reset by the outsourced help desk two months ago after a phone call; since then it has signed in from unfamiliar locations and copied the directory database.",
        "offset_minutes": 25,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Security operations",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.004"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1003.003"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Declares a cyber incident and names a lead.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Suspends password and MFA resets by phone.",
            "responsible_role": "Service desk manager",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The virtualization hosts are encrypted",
        "content": "Overnight the virtualization hosts were encrypted. Store systems, the online shop and warehouse management run on them. A ransom note sits on every console.",
        "offset_minutes": 55,
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
          "Crisis committee",
          "IT"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Decides whether to switch off online sales completely to contain the attack.",
            "responsible_role": "Crisis committee",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The help desk provider pushes back",
        "content": "The outsourced help desk's account manager: 'We followed the procedure: the caller knew the employee number and the manager's name.' If you cut their remote access, they cannot support stores or staff.",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "IT director"
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
            "code": "INJ-04-A1",
            "description": "Agrees a new caller verification and re-enrols every administrator's MFA.",
            "responsible_role": "CISO",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Decides whether to cut the provider's remote access.",
            "responsible_role": "IT director",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Warehouses stop, shelves empty",
        "content": "The operations director: replenishment is stopped, 200 warehouse workers have nothing to do and some stores will run out of fresh products tomorrow. What runs on manual processes?",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Operations director",
          "Crisis committee"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Decides which operations run on manual processes.",
            "responsible_role": "Operations director",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Customer data was taken",
        "content": "The incident response provider confirms the theft of customer contact details, dates of birth and order histories. No card data or passwords.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Data Protection Officer",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decides the notification to the authority and to customers.",
            "responsible_role": "Data Protection Officer",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Same crew, other retailers",
        "content": "A journalist: two other retailers report attacks by the same crew. Is customer data affected at {organization}, and when will online sales be back?",
        "offset_minutes": 140,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Head of communications",
          "Crisis committee"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Approves the customer notice and the public statement.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 8,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-01",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "SOC",
      "type": "soc",
      "description": "The security operations centre: alerts, findings and requests for decisions.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-03",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "managed-service-provider",
      "origin_name": "Managed service provider",
      "code": "ACT-04",
      "name": "Managed service provider",
      "type": "supplier",
      "description": "The MSP running part of the infrastructure, possibly the way in.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Incident response provider (retainer)",
      "code": "ACT-05",
      "name": "Incident response provider (retainer)",
      "type": "supplier",
      "description": "The external response and forensics team, usually under a retainer activated during the incident: findings, reports and containment advice.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-06",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    }
  ],
  "next_actor_number": 7,
  "tags": [
    {
      "origin": "system",
      "origin_id": "ransomware",
      "origin_name": "Ransomware",
      "name": "Ransomware",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "phishing",
      "origin_name": "Phishing",
      "name": "Phishing",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "crisis-committee",
      "origin_name": "Crisis committee",
      "name": "Crisis committee",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "GDPR",
      "name": "GDPR",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
