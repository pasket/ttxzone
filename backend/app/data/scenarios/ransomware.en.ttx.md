---
format: "ttx-zone.scenario"
format_version: 1
language: "en"
title: "Ransomware with double extortion"
exported_at: "2026-10-12T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware with double extortion

A criminal group encrypts the core business systems and threatens to publish stolen data. The crisis committee decides on containment, notification and communication while the incident unfolds over three days.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Committee takes command
- **OBJ-02** Early warning decided
- **OBJ-03** Coherent public message

## Scenario

Early on a Monday the service desk receives calls about files that won't open. Within hours the main business applications are encrypted, a ransom note appears and the attackers claim to hold customer data.

## Phases and injects

### PH-01 Detection and escalation

Monday, 07:40. Several departments report encrypted files.

- **INJ-01** (T+5′) Service desk flooded with calls
- **INJ-02** (T+25′) The ransom note

### PH-02 Containment and notification

Monday, 13:00. Backups are partly affected; the attackers publish a sample.

- **INJ-03** (T+60′) Backups partly encrypted
- **INJ-04** (T+80′) Is this reportable?
- **INJ-05** (contingent) The CSIRT calls

### PH-03 Public pressure

Wednesday. A journalist asks for comment on the leaked data.

- **INJ-06** (T+120′) A journalist calls

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Attacker (sender)
- **ACT-03** National CSIRT
- **ACT-04** External legal counsel
- **ACT-05** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 1,
  "language": "en",
  "exported_at": "2026-10-12T00:00:00Z",
  "exercise": {
    "name": "Ransomware with double extortion",
    "description": "A criminal group encrypts the core business systems and threatens to publish stolen data. The crisis committee decides on containment, notification and communication while the incident unfolds over three days."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Security operations",
      "Communications",
      "Legal",
      "Compliance officer",
      "Security operations lead",
      "Crisis committee chair",
      "Incident lead",
      "Head of communications"
    ],
    "third_parties": [],
    "perimeter": "Corporate IT, the crisis committee and the communications and legal teams.",
    "out_of_scope": "Technical recovery of systems and negotiation with the attackers.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "RED HARBOUR",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Slow escalation to the crisis committee",
        "finding": "In the last major incident the committee was convened four hours after detection.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Untested early-warning duty",
        "finding": "The 24-hour early warning to the national CSIRT has never been exercised.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "No holding statement for data leaks",
        "finding": "There is no pre-approved message for a public leak of customer data.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Committee takes command",
        "statement": "The crisis committee is convened and assigns an incident lead within 30 minutes of the ransom note.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Committee convened\nIncident lead named\nFirst containment decision logged",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Call log, committee minutes and the decision timeline.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Early warning decided",
        "statement": "The committee decides, with its rationale, whether an early warning to the national CSIRT is due before the end of the first day.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Notification duty assessed\nDecision and rationale documented",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Minutes recording the decision and its rationale; the notification draft if one was made.",
        "regulatory_requirement_ids": [
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Coherent public message",
        "statement": "Communications issues a holding statement agreed with Legal before the leak becomes public.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Holding statement drafted\nLegal review recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The holding statement draft and the record of its legal review.",
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
    "title": "Locked out on a Monday",
    "summary": "Early on a Monday the service desk receives calls about files that won't open. Within hours the main business applications are encrypted, a ransom note appears and the attackers claim to hold customer data.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Detection and escalation",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Monday, 07:40. Several departments report encrypted files.",
        "key_questions": [
          "Who decides to convene the crisis committee?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ]
      },
      {
        "code": "PH-02",
        "name": "Containment and notification",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 240,
        "situation_update": "Monday, 13:00. Backups are partly affected; the attackers publish a sample.",
        "key_questions": [
          "Is an early warning due, and who sends it?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-03",
        "name": "Public pressure",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Wednesday. A journalist asks for comment on the leaked data.",
        "key_questions": [
          "What do we say, and to whom first?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ]
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0102",
        "origin_name": "Wizard Spider",
        "code": "THR-01",
        "name": "Wizard Spider",
        "mitre_group_id": "G0102",
        "aliases": [],
        "description": "Financially motivated group running ransomware with data theft.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
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
        "title": "Service desk flooded with calls",
        "content": "Twelve tickets in ten minutes: shared drives show files ending in .lck and users cannot open them.",
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
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
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
            "description": "Security operations classifies it as a major incident and escalates.",
            "responsible_role": "Security operations lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The ransom note",
        "content": "A note on every encrypted server demands payment within 72 hours and claims 400 GB of customer data were stolen.",
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
          "Crisis committee"
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
            "code": "INJ-02-A1",
            "description": "The crisis committee is convened and names an incident lead.",
            "responsible_role": "Crisis committee chair",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Backups partly encrypted",
        "content": "The infrastructure team confirms that recent backups were deleted; only last month's offline copy is intact.",
        "offset_minutes": 60,
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
          "Crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
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
            "description": "The committee decides what to isolate and logs the decision.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Is this reportable?",
        "content": "Legal asks whether the incident meets the threshold for an early warning and who would send it.",
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
          "Crisis committee"
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
            "code": "INJ-04-A1",
            "description": "The committee decides on the early warning and records its rationale.",
            "responsible_role": "Compliance officer",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The CSIRT calls",
        "content": "The national CSIRT has seen the leak sample and asks whether you are affected.",
        "offset_minutes": null,
        "trigger_condition": "No early-warning decision 20 minutes after INJ-04.",
        "contingent_purpose": "Bring the notification duty back to the table.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Compliance officer"
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
            "description": "The committee confirms the early warning and who sends it.",
            "responsible_role": "Compliance officer",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "A journalist calls",
        "content": "A reporter has a sample of the leaked customer records and will publish in two hours, with or without your comment.",
        "offset_minutes": 120,
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
          "Communications"
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
            "code": "INJ-06-A1",
            "description": "Communications drafts a holding statement and Legal reviews it.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": []
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
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-02",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-03",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team: asks for reports and shares indicators.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "External legal counsel",
      "code": "ACT-04",
      "name": "External legal counsel",
      "type": "other",
      "description": "Outside lawyers advising on notifications, liability and communications.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-05",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    }
  ],
  "next_actor_number": 6,
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
      "origin_id": "crisis-committee",
      "origin_name": "Crisis committee",
      "name": "Crisis committee",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": []
}
```
