---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Wiper attack on a distributed energy fleet"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Wiper attack on a distributed energy fleet

A state-linked actor destroys remote terminal units across dozens of renewable sites and pushes a wiper through the domain of a heat plant, during a winter cold spell just before a holiday. Operations, cybersecurity and management must keep the service running without remote control, decide what to restore first and inform the authorities.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Cyber incident declared
- **OBJ-02** Safe operation without remote control
- **OBJ-03** Authorities and public informed

## Scenario

Before dawn, two days before a holiday, the control room of {organization} starts losing contact with its remote generation sites one after another. A few hours later, endpoint protection at the heat plant reports mass file deletion. Nobody has asked for anything: the attack is purely destructive.

## Phases and injects

### PH-01 Loss of view

05:30, winter, two days before a holiday. The control room loses contact with remote sites one after another.

- **INJ-01** (T+5′) The control room loses contact with many remote sites
- **INJ-02** (T+30′) A device rebooting in a loop

### PH-02 The plant is wiped

07:00. Endpoint protection at the heat plant reports mass file deletion on operator stations and servers.

- **INJ-03** (T+55′) Mass deletion at the heat plant
- **INJ-04** (T+85′) The system operator asks what is at risk

### PH-03 Restore and report

Day 2. Field crews confirm destroyed devices; the authorities and the press are calling.

- **INJ-05** (T+115′) The national CSIRT asks for the early warning
- **INJ-06** (T+135′) Is the heating at risk?
- **INJ-07** (T+150′) Not enough spares for every site

## Simulated actors

- **ACT-01** Employee
- **ACT-02** SOC
- **ACT-03** Electricity system operator
- **ACT-04** National CSIRT
- **ACT-05** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Wiper attack on a distributed energy fleet",
    "description": "A state-linked actor destroys remote terminal units across dozens of renewable sites and pushes a wiper through the domain of a heat plant, during a winter cold spell just before a holiday. Operations, cybersecurity and management must keep the service running without remote control, decide what to restore first and inform the authorities."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "detection_triage_escalation",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Control room",
      "Operations",
      "OT security",
      "Security operations",
      "Communications",
      "Legal",
      "Head of operations",
      "OT security lead",
      "Plant manager",
      "CISO",
      "Operations director",
      "Compliance officer",
      "Head of communications"
    ],
    "third_parties": [
      "Electricity system operator"
    ],
    "perimeter": "Remote generation sites, the heat plant, the control room and the crisis committee.",
    "out_of_scope": "Hands-on recovery of field devices.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "COLD HARBOUR",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "OT alarms not escalated to cybersecurity",
        "finding": "Communication failures are routinely treated as telecom faults; nobody owns the decision to call them a cyber incident.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "No plan for losing many sites at once",
        "finding": "Continuity plans cover one site at a time, not the simultaneous loss of remote view and control across the fleet.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Untested notification for an essential service",
        "finding": "The early warning to the authorities and the information owed to the system operator have never been exercised.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Cyber incident declared",
        "statement": "Operations escalates the loss of communications to cybersecurity and an incident is declared within 60 minutes, even with the cause unknown.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Escalation to cybersecurity logged\nIncident declared with a named lead",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Control room log and the decision timeline.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Safe operation without remote control",
        "statement": "The team decides how the affected sites run locally and in which order they are restored, with the criteria written down.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Local operation decided\nRestoration order and criteria agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Committee minutes and the restoration plan.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Authorities and public informed",
        "statement": "The committee decides what to notify, to whom and when, and what to tell the system operator and the public about supply.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Early warning decided\nPublic message approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Notification draft and the approved statement.",
        "regulatory_requirement_ids": [
          "NIS2-23"
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
    "title": "Dark sites in a cold spell",
    "summary": "Before dawn, two days before a holiday, the control room of {organization} starts losing contact with its remote generation sites one after another. A few hours later, endpoint protection at the heat plant reports mass file deletion. Nobody has asked for anything: the attack is purely destructive.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Loss of view",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "05:30, winter, two days before a holiday. The control room loses contact with remote sites one after another.",
        "key_questions": [
          "Telecom fault or attack: who decides?"
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
        "headline": "Remote sites go dark"
      },
      {
        "code": "PH-02",
        "name": "The plant is wiped",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 90,
        "situation_update": "07:00. Endpoint protection at the heat plant reports mass file deletion on operator stations and servers.",
        "key_questions": [
          "Can we keep heat and power flowing without our systems?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Mass deletion at the heat plant"
      },
      {
        "code": "PH-03",
        "name": "Restore and report",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1440,
        "situation_update": "Day 2. Field crews confirm destroyed devices; the authorities and the press are calling.",
        "key_questions": [
          "What do we restore first, and what do we say?"
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
        "headline": "Day 2: scarce spares, many questions"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0034",
        "origin_name": "Sandworm Team",
        "code": "THR-01",
        "name": "Sandworm Team",
        "mitre_group_id": "G0034",
        "aliases": [],
        "description": "State-linked actor focused on destructive attacks against energy infrastructure.",
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
            "technique_id": "T1485"
          },
          {
            "domain": "ics",
            "technique_id": "T0829"
          },
          {
            "domain": "ics",
            "technique_id": "T0816"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": "system",
        "origin_id": "INJ-ICS-03",
        "origin_name": "The control room loses contact with many remote sites",
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The control room loses contact with many remote sites",
        "content": "Shift alarm summary: remote units not responding at 27 of 34 sites, alarms raised in sequence over 40 minutes. Telemetry frozen, remote commands rejected. The telecom provider reports no incident. Operator note: telecom fault suspected.",
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
          "Control room",
          "Operations"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0829"
          },
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0827"
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
            "description": "Operations escalates to cybersecurity, not only to the telecom provider, and an incident is declared.",
            "responsible_role": "Head of operations",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "A device rebooting in a loop",
        "content": "A field technician calls from one site: the remote unit answers, drops, and reboots again. 'Do I swap it for the spare or leave it as it is for you to look at?' Meanwhile two sites report unknown protection relay status.",
        "offset_minutes": 30,
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
          "OT security",
          "Operations"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0107",
            "technique_id": "T0816"
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
            "description": "OT security decides whether to preserve the device for forensics before replacing it.",
            "responsible_role": "OT security lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Operations switches the affected sites to local or manual operation.",
            "responsible_role": "Head of operations",
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
        "title": "Mass deletion at the heat plant",
        "content": "Endpoint protection at the heat plant: files being overwritten on operator stations and domain controllers; the wiper is spreading through group policy. Decoy files stopped it on part of the machines, but more than a hundred are affected.",
        "offset_minutes": 55,
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
          "Plant manager"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0004",
            "technique_id": "T1484.001"
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
            "description": "Cybersecurity isolates the plant's corporate network from its control systems.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "The plant confirms heat supply holds and staffs manual operation if needed.",
            "responsible_role": "Plant manager",
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
        "title": "The system operator asks what is at risk",
        "content": "The electricity system operator calls: it sees dozens of your sites without telemetry and asks how much capacity is at risk, whether you still control it and when you expect to restore remote operation.",
        "offset_minutes": 85,
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
          "Operations director",
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
            "code": "INJ-04-A1",
            "description": "Gives the system operator an estimate and a single contact.",
            "responsible_role": "Operations director",
            "expected_within_minutes": 15,
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
        "code": "INJ-05",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The national CSIRT asks for the early warning",
        "content": "The national CSIRT has received reports of attacks on energy operators and asks whether {organization} is affected, for the early warning and for any indicators you can share.",
        "offset_minutes": 115,
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
          "Compliance officer",
          "CISO"
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
            "code": "INJ-05-A1",
            "description": "Decides and sends the early warning with what is known.",
            "responsible_role": "Compliance officer",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Is the heating at risk?",
        "content": "A regional radio journalist calls: listeners report that 'the energy company has been hacked' and asks whether homes will lose heating during the cold spell.",
        "offset_minutes": 135,
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
            "code": "INJ-06-A1",
            "description": "Approves a public message on supply continuity.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 15,
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
        "title": "Not enough spares for every site",
        "content": "Field operations report: 19 remote units must be replaced, there are 6 spares and three crews on duty over the holiday. They need to know which sites go first.",
        "offset_minutes": 150,
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
          "Crisis committee",
          "Operations"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Agrees the restoration order and writes down the criteria.",
            "responsible_role": "Crisis committee",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
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
      "origin_id": "electricity-operator",
      "origin_name": "Electricity system operator",
      "code": "ACT-03",
      "name": "Electricity system operator",
      "type": "other",
      "description": "The transmission system operator coordinating the grid during the incident.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-04",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team: asks for reports and shares indicators.",
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
      "origin_id": "wiper",
      "origin_name": "Wiper",
      "name": "Wiper",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "ot-ics",
      "origin_name": "OT / ICS",
      "name": "OT / ICS",
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
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
