---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Deepfake CFO and urgent transfers"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Deepfake CFO and urgent transfers

Attackers clone the face and voice of the Chief Financial Officer and, on a video call with several 'colleagues', convince a regional finance manager to make urgent, confidential transfers. The exercise tests payment verification, the response once the fraud is discovered, and whether it is also a cyber incident.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Out-of-band check
- **OBJ-02** Fast recovery attempt
- **OBJ-03** Scope and duties settled

## Scenario

A regional finance manager of {organization} receives an email from the CFO about a confidential acquisition that needs urgent payments. She suspects phishing, until she joins a video call where the CFO and two colleagues confirm it.

## Phases and injects

### PH-01 The request

Thursday, 10:15. A regional finance manager receives an email from the CFO.

- **INJ-01** (T+5′) A confidential request from the CFO
- **INJ-02** (T+25′) Emails impersonating senior executives

### PH-02 The call

12:30. The video call confirms everything; the first transfers are ready.

- **INJ-03** (T+55′) The CFO on camera
- **INJ-04** (T+80′) The bank sees an unusual pattern

### PH-03 Discovery

Five days later. Headquarters knows nothing about the deal.

- **INJ-05** (T+105′) Nobody knows about the deal
- **INJ-06** (T+130′) Was anything compromised?
- **INJ-07** (T+150′) The board wants to know what to say

## Simulated actors

- **ACT-01** Attacker (sender)
- **ACT-02** National CSIRT
- **ACT-03** The organisation's bank
- **ACT-04** Employee
- **ACT-05** Incident response provider (retainer)
- **ACT-06** Board chair

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Deepfake CFO and urgent transfers",
    "description": "Attackers clone the face and voice of the Chief Financial Officer and, on a video call with several 'colleagues', convince a regional finance manager to make urgent, confidential transfers. The exercise tests payment verification, the response once the fraud is discovered, and whether it is also a cyber incident."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "detection_triage_escalation",
      "legal_forensics"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Finance",
      "Treasury",
      "Legal",
      "Security operations",
      "Communications",
      "Regional finance manager",
      "Finance director",
      "Crisis committee chair",
      "CISO",
      "Chief Executive Officer"
    ],
    "third_parties": [
      "Bank"
    ],
    "perimeter": "The payment process, the finance teams, the crisis committee, legal and security.",
    "out_of_scope": "Technical analysis of the deepfake.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "PAPER MOON",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Payment checks rely on recognizing the executive",
        "finding": "Urgent payments are approved when the request comes from a known executive; there is no out-of-band check.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Slow reaction to fraudulent payments",
        "finding": "In a past fraud, the bank was asked to recall the money a day after the discovery.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "Fraud and cyber incidents handled apart",
        "finding": "There is no agreed way to decide whether a fraud is also a cyber incident with notification duties.",
        "affected_capability": "legal_forensics",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Out-of-band check",
        "statement": "Finance verifies any urgent, confidential payment request through a known channel before paying.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Request verified through a known channel\nLarge urgent transfers held for a second approval",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Payment log and the verification record.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Fast recovery attempt",
        "statement": "Within 30 minutes of discovery the team freezes, recalls and reports in a set order, with one lead.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Recall requested\nPolice report filed\nLead named",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Bank correspondence and the decision timeline.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Scope and duties settled",
        "statement": "The team determines whether any system was compromised and which notifications, insurer claims and messages apply.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Cyber incident decision recorded\nInsurer notified",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Legal assessment and committee minutes.",
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
    "title": "Seeing is believing",
    "summary": "A regional finance manager of {organization} receives an email from the CFO about a confidential acquisition that needs urgent payments. She suspects phishing, until she joins a video call where the CFO and two colleagues confirm it.",
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
        "situation_update": "Thursday, 10:15. A regional finance manager receives an email from the CFO.",
        "key_questions": [
          "Who would she call to check, and how?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "A confidential deal needs urgent payments"
      },
      {
        "code": "PH-02",
        "name": "The call",
        "start_offset": 50,
        "end_offset": 100,
        "incident_jump_minutes": 120,
        "situation_update": "12:30. The video call confirms everything; the first transfers are ready.",
        "key_questions": [
          "What check would have exposed the call?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "The CFO on camera confirms it"
      },
      {
        "code": "PH-03",
        "name": "Discovery",
        "start_offset": 100,
        "end_offset": 160,
        "incident_jump_minutes": 7200,
        "situation_update": "Five days later. Headquarters knows nothing about the deal.",
        "key_questions": [
          "Freeze, recall, police, insurer: in what order?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Nobody at headquarters knows about the deal"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Fraud group",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Unidentified fraud group that clones executives' faces and voices from public videos.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1593"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1683.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1684.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
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
        "title": "A confidential request from the CFO",
        "content": "'I need your help with a confidential acquisition we will announce next week. Legal will send the details. Several payments must go out today; please keep this between us for now.' The sender looks like the CFO's address, with one letter changed.",
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
          "Regional finance manager"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0005",
            "technique_id": "T1684.001"
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
            "description": "Checks the request with the CFO through a known channel.",
            "responsible_role": "Regional finance manager",
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
        "origin_id": "INJ-BEC-02",
        "origin_name": "Emails impersonating senior executives",
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Emails impersonating senior executives",
        "content": "The national CSIRT warns of a wave of emails and video calls impersonating senior executives to order urgent payments, some with cloned voices and faces.",
        "offset_minutes": 25,
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
          "Finance director",
          "Security operations"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Warns the finance teams and restates the verification rule.",
            "responsible_role": "Finance director",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The CFO on camera",
        "content": "The video call opens: the CFO and two colleagues from headquarters, cameras on. The CFO thanks her, explains the deal and asks for fifteen transfers to five accounts today. The image freezes now and then; 'bad hotel Wi-Fi', he says.",
        "offset_minutes": 55,
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
          "Regional finance manager",
          "Treasury"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0042",
            "technique_id": "T1683.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0005",
            "technique_id": "T1684.001"
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
            "description": "Asks something only the real CFO could answer, or calls back on a known number.",
            "responsible_role": "Regional finance manager",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Holds the batch of large urgent transfers for a second approval.",
            "responsible_role": "Treasury",
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
        "title": "The bank sees an unusual pattern",
        "content": "The bank's relationship manager calls: several large transfers to new beneficiaries in two countries are queued, unusual for this office. 'Do you confirm them?'",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Treasury"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Stops the pending transfers and asks the bank to recall those already sent.",
            "responsible_role": "Treasury",
            "expected_within_minutes": 10,
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
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Nobody knows about the deal",
        "content": "The regional manager mentions 'the acquisition' to headquarters. The CFO's office has never heard of it. Fifteen transfers, five accounts, tens of millions over five days.",
        "offset_minutes": 105,
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
          "Crisis committee",
          "Treasury",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Names a lead, asks the bank for an urgent recall and reports to the police.",
            "responsible_role": "Crisis committee chair",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Notifies the insurer.",
            "responsible_role": "Legal",
            "expected_within_minutes": 30,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Was anything compromised?",
        "content": "The incident response provider reports: a look-alike domain was registered a month ago, and one employee's mailbox has a forwarding rule nobody recognizes. No malware found so far.",
        "offset_minutes": 130,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Legal"
        ],
        "delivery_method": "briefing",
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
            "description": "Decides whether it is a reportable cyber incident and records why.",
            "responsible_role": "Legal",
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
        "title": "The board wants to know what to say",
        "content": "The board chair calls: auditors have asked about 'a payment fraud' and the chair wants to know what will be said to staff, auditors and, if needed, the market.",
        "offset_minutes": 150,
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
          "Chief Executive Officer",
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
            "description": "Agrees what to tell staff, auditors and the board.",
            "responsible_role": "Chief Executive Officer",
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
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-01",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-02",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team: asks for reports and shares indicators.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "bank",
      "origin_name": "The organisation's bank",
      "code": "ACT-03",
      "name": "The organisation's bank",
      "type": "other",
      "description": "The bank: suspicious transfers, fund recalls and recovery deadlines.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-04",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
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
      "origin_id": "board-chair",
      "origin_name": "Board chair",
      "code": "ACT-06",
      "name": "Board chair",
      "type": "internal",
      "description": "The chair of the board when the board isn't playing: demands answers and calls meetings.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 7,
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
      "origin_id": "executive",
      "origin_name": "Executive",
      "name": "Executive",
      "color": "indigo",
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
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
