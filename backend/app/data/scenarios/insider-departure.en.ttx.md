---
format: "ttx-zone.scenario"
format_version: 5
language: "en"
title: "A departing engineer takes the crown jewels"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# A departing engineer takes the crown jewels

An engineer who has just resigned to join a competitor copies design files and customer pricing. Security, HR and Legal must act together without tipping him off or losing the evidence.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Escalate the data-loss alert
- **OBJ-02** Evidence that holds up
- **OBJ-03** One plan for HR, Legal and Security

## Scenario

A data-loss alert flags an engineer syncing gigabytes to personal cloud storage late at night. HR confirms he resigned last week to join a competitor and leaves on Friday.

## Phases and injects

### PH-01 Unusual download

Tuesday, 08:30. The overnight data-loss alerts are waiting in the queue.

- **INJ-01** (T+5′) Data-loss alert: 18 GB to personal cloud
- **INJ-02** (T+25′) He resigned last week

### PH-02 Quiet investigation

Wednesday, 10:00. The forensic provider has looked at the laptop's activity remotely.

- **INJ-03** (T+60′) A copy to USB, too
- **INJ-04** (T+80′) Walk him out now
- **INJ-05** (contingent) The laptop goes dark

### PH-03 Consequences

Friday. The engineer has left; a customer calls about a competitor's offer.

- **INJ-06** (T+120′) A customer recognizes its prices

## Simulated actors

- **ACT-01** SOC
- **ACT-02** HR business partner
- **ACT-03** Incident response provider (retainer)
- **ACT-04** Customer
- **ACT-05** Police cybercrime unit

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "A departing engineer takes the crown jewels",
    "description": "An engineer who has just resigned to join a competitor copies design files and customer pricing. Security, HR and Legal must act together without tipping him off or losing the evidence."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "pending_aar_actions"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "legal_forensics",
      "cross_unit_coordination"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Security operations",
      "Security operations lead",
      "Incident lead",
      "Human resources",
      "Legal",
      "Legal counsel",
      "Engineering management"
    ],
    "third_parties": [],
    "perimeter": "Corporate endpoints and cloud storage, the HR leaver process and the legal response.",
    "out_of_scope": "Disciplinary decisions about real people and the technical forensic analysis itself.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "GREY HERON",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "No watch on leavers' data movement",
        "finding": "Data-loss alerts are not linked to the list of people who have resigned.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Evidence lost in a past HR case",
        "finding": "A laptop was reimaged before Legal asked for it, and a claim against a former employee was dropped.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "previous_aar",
        "title": "HR and Security act separately",
        "finding": "The last exercise found HR suspends access on its own schedule, without telling Security.",
        "affected_capability": "cross_unit_coordination",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Escalate the data-loss alert",
        "statement": "Within 30 minutes of the alert, security operations links it to the user, opens an incident and escalates it to the incident lead.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Alert linked to a named user\nIncident record opened\nIncident lead informed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The incident record and the escalation message, with their scenario times.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Evidence that holds up",
        "statement": "Before the engineer is confronted, the devices and accounts involved are preserved with a chain of custody, and the decision on reporting to the police is recorded.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Device images requested before the confrontation\nChain-of-custody record started\nDecision on reporting to the police recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The chain-of-custody record and the decision log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "One plan for HR, Legal and Security",
        "statement": "HR, Legal and Security agree one sequence for suspending access, the exit meeting and recovering devices, each step with an owner.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Joint meeting held\nSequence of actions agreed\nOwner named for each action",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The agreed plan and its owners.",
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
    "title": "Friday is his last day",
    "summary": "A data-loss alert flags an engineer syncing gigabytes to personal cloud storage late at night. HR confirms he resigned last week to join a competitor and leaves on Friday.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Unusual download",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Tuesday, 08:30. The overnight data-loss alerts are waiting in the queue.",
        "key_questions": [
          "Who needs to know before anyone talks to the employee?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "18 GB leave a laptop at midnight"
      },
      {
        "code": "PH-02",
        "name": "Quiet investigation",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Wednesday, 10:00. The forensic provider has looked at the laptop's activity remotely.",
        "key_questions": [
          "What must be preserved before access is cut?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "A USB copy and a pushy manager"
      },
      {
        "code": "PH-03",
        "name": "Consequences",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Friday. The engineer has left; a customer calls about a competitor's offer.",
        "key_questions": [
          "Do we report it to the police, and who decides?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "A customer recognizes its prices"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Departing employee",
        "mitre_group_id": null,
        "aliases": [],
        "description": "An insider with legitimate access who copies data before leaving.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1052.001"
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
        "title": "Data-loss alert: 18 GB to personal cloud",
        "content": "Between 23:40 and 01:15, a laptop assigned to a senior design engineer synced 18 GB from the product design repository to a personal cloud storage account.",
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
          "Security operations"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
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
            "description": "Security operations links the alert to the user, opens an incident and escalates it.",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "He resigned last week",
        "content": "HR confirms the engineer resigned last Monday to join a direct competitor. His last day is Friday and he still has full access, by default, until then.",
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
          "Incident lead"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "The incident lead convenes HR, Legal and Security before anyone contacts the employee.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "The incident lead records the escalation and the people informed.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 15,
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
        "title": "A copy to USB, too",
        "content": "The forensic provider reports a USB drive connected on Monday evening; file names match the design repository and a customer pricing spreadsheet. The laptop is due back to IT on Friday for reimaging.",
        "offset_minutes": 60,
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
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1052.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Legal asks for the laptop and accounts to be preserved, with a chain of custody, before any reimaging.",
            "responsible_role": "Legal counsel",
            "expected_within_minutes": 20,
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
        "title": "Walk him out now",
        "content": "The engineering director wants his access cut this morning and to walk him out of the building, today, in front of the team.",
        "offset_minutes": 80,
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
          "Incident lead",
          "Engineering management"
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
            "code": "INJ-04-A1",
            "description": "HR, Legal and Security agree the sequence: preserve, suspend access, exit meeting, recover devices, each with an owner.",
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
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The laptop goes dark",
        "content": "Someone told him. The laptop drops off the network; the last telemetry shows a disk-wiping utility starting.",
        "offset_minutes": null,
        "trigger_condition": "No agreed sequence 20 minutes after INJ-04.",
        "contingent_purpose": "Show what happens when each team acts alone.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Security operations",
          "Incident lead"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "The incident lead stops parallel actions and restates one plan with owners.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
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
        "title": "A customer recognizes its prices",
        "content": "A long-standing customer forwards a competitor's offer that undercuts your confidential pricing by exactly two percent on every line, and asks what is going on.",
        "offset_minutes": 120,
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
          "Engineering management",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Legal and the incident lead decide on reporting to the police and on civil action, and record it.",
            "responsible_role": "Legal counsel",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-02"
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
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "SOC",
      "type": "soc",
      "description": "The security operations centre: alerts, findings and requests for decisions.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-02",
      "name": "HR business partner",
      "type": "internal",
      "description": "The HR partner for engineering: knows the leaver's dates and the exit process.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Incident response provider (retainer)",
      "code": "ACT-03",
      "name": "Incident response provider (retainer)",
      "type": "supplier",
      "description": "The external response and forensics team, usually under a retainer activated during the incident: findings, reports and containment advice.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Customer",
      "code": "ACT-04",
      "name": "Customer",
      "type": "customer",
      "description": "A customer noticing the impact and asking for explanations.",
      "channel": "email"
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
      "origin_id": "insider",
      "origin_name": "Insider threat",
      "name": "Insider threat",
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
      "origin_id": "mixed",
      "origin_name": "Mixed audience",
      "name": "Mixed audience",
      "color": "indigo",
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
