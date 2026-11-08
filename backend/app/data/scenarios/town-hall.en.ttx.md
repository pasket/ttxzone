---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Town hall encrypted"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Town hall encrypted

A ransomware affiliate enters a municipality through a supplier's remote access without MFA and encrypts servers and backups over a weekend. Digital services stop for weeks and residents' data is published after the town hall refuses to pay. The exercise tests essential public services on paper, the political and ransom decisions, and telling residents.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Essential services on paper
- **OBJ-02** Ransom and political decisions
- **OBJ-03** Residents informed

## Scenario

Monday, 08:00. Staff of {organization} find a ransom note on their screens. The website and the electronic office are down; the IT team has three people.

## Phases and injects

### PH-01 Monday morning

Monday, 08:00. A ransom note on every screen.

- **INJ-01** (T+5′) A ransom note on every screen
- **INJ-02** (T+25′) The backups are gone too
- **INJ-03** (T+40′) The ransom demand

### PH-02 Paper counters

Thursday. Counters reopen with paper forms; local media cover it daily.

- **INJ-04** (T+55′) Emergency payments are due tomorrow
- **INJ-05** (T+85′) The opposition wants answers

### PH-03 Residents' data

Two weeks later. Residents' records are published.

- **INJ-06** (T+115′) Residents' records are published
- **INJ-07** (T+140′) Residents at the counter

## Simulated actors

- **ACT-01** Employee
- **ACT-02** Attacker (sender)
- **ACT-03** National CSIRT
- **ACT-04** Media
- **ACT-05** Data protection authority

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Town hall encrypted",
    "description": "A ransomware affiliate enters a municipality through a supplier's remote access without MFA and encrypts servers and backups over a weekend. Digital services stop for weeks and residents' data is published after the town hall refuses to pay. The exercise tests essential public services on paper, the political and ransom decisions, and telling residents."
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
      "continuity_recovery",
      "crisis_decision_making",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Mayor",
      "IT",
      "Social services",
      "Citizen services",
      "Communications",
      "Data Protection Officer",
      "IT manager",
      "Head of social services",
      "Head of communications"
    ],
    "third_parties": [
      "Software supplier",
      "Public CSIRT"
    ],
    "perimeter": "Municipal services, the IT team, the mayor's office and communication with residents.",
    "out_of_scope": "The technical rebuild of the network.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "CITY LIGHTS",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Backups on the same network",
        "finding": "Backups can be encrypted with everything else; there is no paper procedure for essential services.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Weekend escalation and ransom position unclear",
        "finding": "Nobody knows who decides at a weekend, nor the municipality's position on paying.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Residents' notification untested",
        "finding": "The municipality has never told residents their data may be published.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Essential services on paper",
        "statement": "Payroll, social emergency payments and the civil registry keep working on paper while systems are rebuilt.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Essential services listed\nPaper procedures running",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Service continuity log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Ransom and political decisions",
        "statement": "The mayor decides on the ransom and on external support with a recorded rationale, and agrees what is said publicly and when.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Ransom decision and rationale recorded\nPublic line agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Committee minutes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Residents informed",
        "statement": "The breach is notified and residents are told, with support offered.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notification sent\nResidents' letter approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Breach record and the residents' letter.",
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
    "title": "Back to paper",
    "summary": "Monday, 08:00. Staff of {organization} find a ransom note on their screens. The website and the electronic office are down; the IT team has three people.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Monday morning",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Monday, 08:00. A ransom note on every screen.",
        "key_questions": [
          "Who decides, and do we pay?"
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
        "headline": "A ransom note on every screen"
      },
      {
        "code": "PH-02",
        "name": "Paper counters",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Thursday. Counters reopen with paper forms; local media cover it daily.",
        "key_questions": [
          "Which services cannot wait?"
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
        "headline": "Counters on paper, questions in council"
      },
      {
        "code": "PH-03",
        "name": "Residents' data",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 14400,
        "situation_update": "Two weeks later. Residents' records are published.",
        "key_questions": [
          "How do we tell residents?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Residents' data is published"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Ransomware affiliate",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Unidentified ransomware affiliate that came in through a supplier's remote access.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
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
        "title": "A ransom note on every screen",
        "content": "Staff arriving at the town hall find a ransom note on their screens. The website and the electronic office are down; the first residents are queuing at the counters.",
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
          "Mayor",
          "Crisis committee"
        ],
        "delivery_method": "phone",
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
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Convenes the crisis committee.",
            "responsible_role": "Mayor",
            "expected_within_minutes": 15,
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The backups are gone too",
        "content": "The IT manager (a team of three): the backups were on the same network and are encrypted. The attacker came in through a supplier's remote access account without MFA.",
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
          "IT",
          "Crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1133"
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
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Cuts the supplier's remote access.",
            "responsible_role": "IT manager",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Requests support from the public CSIRT.",
            "responsible_role": "IT manager",
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
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The ransom demand",
        "content": "The attackers' email: 300,000 in cryptocurrency within five days, or the residents' data will be published. 'Much cheaper than rebuilding everything.'",
        "offset_minutes": 40,
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
          "Mayor",
          "Crisis committee"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
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
            "description": "Decides whether to pay and records the rationale.",
            "responsible_role": "Mayor",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Emergency payments are due tomorrow",
        "content": "Social services: emergency payments to vulnerable families are due tomorrow and payroll runs on Friday. The applications are encrypted.",
        "offset_minutes": 55,
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
          "Social services",
          "Crisis committee"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Sets up paper processes for emergency payments and payroll.",
            "responsible_role": "Head of social services",
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The opposition wants answers",
        "content": "The local paper covers the incident every day, and opposition councillors demand an extraordinary council meeting. Did the town hall pay?",
        "offset_minutes": 85,
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
          "Mayor",
          "Head of communications"
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
            "description": "Agrees what the mayor says, and when.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 15,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Residents' records are published",
        "content": "The public CSIRT: the investigation confirms the theft of file shares and databases, and residents' records have appeared on the group's leak site.",
        "offset_minutes": 115,
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
          "Data Protection Officer",
          "Mayor"
        ],
        "delivery_method": "email",
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
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Notifies the data protection authority.",
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
        "title": "Residents at the counter",
        "content": "Citizen services are overwhelmed: residents ask whether their data is online and what they should do. The data protection authority asks how residents will be informed.",
        "offset_minutes": 140,
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
          "Data Protection Officer",
          "Citizen services"
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
            "code": "INJ-07-A1",
            "description": "Sends letters to residents and offers identity monitoring.",
            "responsible_role": "Data Protection Officer",
            "expected_within_minutes": 30,
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
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-04",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "data-protection-authority",
      "origin_name": "Data protection authority",
      "code": "ACT-05",
      "name": "Data protection authority",
      "type": "authority",
      "description": "The supervisory authority for personal data breaches.",
      "channel": "email"
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
      "origin_id": "data-breach",
      "origin_name": "Data breach",
      "name": "Data breach",
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
