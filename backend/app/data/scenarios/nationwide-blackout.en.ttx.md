---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Nationwide blackout of unknown cause"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Nationwide blackout of unknown cause

The national grid collapses at midday without warning. {organization} is not the grid operator: it suddenly depends on generators, batteries and paper, and nobody knows the cause for hours. Everyone asks whether it is a cyberattack. With no adversary to chase, the exercise tests continuity, decisions under uncertainty and crisis communication.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Essential services kept
- **OBJ-02** Decisions under uncertainty
- **OBJ-03** Clear communication

## Scenario

A weekday, 12:33. Power drops everywhere at once. The data centre of {organization} switches to generators; offices go dark, phones still work. On social media the word 'cyberattack' appears within minutes.

## Phases and injects

### PH-01 Lights out

A weekday, 12:33. Power drops everywhere at once.

- **INJ-01** (T+5′) The data centre is on generators
- **INJ-02** (T+25′) Shut everything down just in case?
- **INJ-03** (T+40′) Do we go home?

### PH-02 Batteries run out

15:30. Mobile networks are failing; fuel is the bottleneck.

- **INJ-04** (T+55′) Fuel arrives tomorrow
- **INJ-05** (T+80′) 'Were you hacked?'

### PH-03 Power returns

Night. Officials say there is no evidence of a cyberattack; power returns region by region.

- **INJ-06** (T+115′) No evidence of a cyberattack
- **INJ-07** (T+140′) Charged twice?

## Simulated actors

- **ACT-01** Employee
- **ACT-02** Critical supplier
- **ACT-03** Media
- **ACT-04** National CSIRT
- **ACT-05** Customer

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Nationwide blackout of unknown cause",
    "description": "The national grid collapses at midday without warning. {organization} is not the grid operator: it suddenly depends on generators, batteries and paper, and nobody knows the cause for hours. Everyone asks whether it is a cyberattack. With no adversary to chase, the exercise tests continuity, decisions under uncertainty and crisis communication."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_or_revised_plan",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "crisis_decision_making",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Facilities",
      "IT",
      "Human Resources",
      "Communications",
      "Operations director",
      "Continuity manager",
      "IT director",
      "Crisis committee chair",
      "Head of HR",
      "Head of communications"
    ],
    "third_parties": [
      "Fuel supplier"
    ],
    "perimeter": "Business continuity across sites, the data centre, staff safety and crisis communication.",
    "out_of_scope": "The cause of the blackout.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "BLACK SKY",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Continuity plans assume telecoms work",
        "finding": "Plans rely on phones and internet, and generator fuel lasts eight hours.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Preventive shutdowns without criteria",
        "finding": "In past outages, systems were shut down 'just in case' with no agreed criteria.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "No message for an incident of unknown cause",
        "finding": "There is no agreed line for speaking while the cause is unknown.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Essential services kept",
        "statement": "The committee decides which services run on generator power and for how long, and secures refuelling.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Priority services decided\nRefuelling arranged",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Continuity log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Decisions under uncertainty",
        "statement": "The committee decides on preventive shutdowns and a controlled restart, with written criteria.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Shutdown decision and criteria recorded\nRestart sequence agreed",
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
        "title": "Clear communication",
        "statement": "Staff, customers and the public get a consistent message that does not speculate about the cause.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Staff instructed\nPublic message approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Messages sent.",
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
    "title": "Lights out at midday",
    "summary": "A weekday, 12:33. Power drops everywhere at once. The data centre of {organization} switches to generators; offices go dark, phones still work. On social media the word 'cyberattack' appears within minutes.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Lights out",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "A weekday, 12:33. Power drops everywhere at once.",
        "key_questions": [
          "Is it cyber, and does it matter right now?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Power is out everywhere"
      },
      {
        "code": "PH-02",
        "name": "Batteries run out",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 180,
        "situation_update": "15:30. Mobile networks are failing; fuel is the bottleneck.",
        "key_questions": [
          "What do we keep alive on the fuel we have?"
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
        "headline": "Phones fail, fuel runs short"
      },
      {
        "code": "PH-03",
        "name": "Power returns",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 600,
        "situation_update": "Night. Officials say there is no evidence of a cyberattack; power returns region by region.",
        "key_questions": [
          "Restart everything at once, or in sequence?"
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
        "headline": "Power is coming back"
      }
    ],
    "threat_actors": [],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The data centre is on generators",
        "content": "Facilities: the grid is down at every site. The data centre is on generators with fuel for about eight hours; offices and lifts are without power; two people are trapped in a lift.",
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
          "Continuity manager",
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
            "code": "INJ-01-A1",
            "description": "Activates the continuity plan and sets priorities for generator power.",
            "responsible_role": "Continuity manager",
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
        "title": "Shut everything down just in case?",
        "content": "The IT director: social media says it is a cyberattack. Some companies are shutting down their systems. 'Should we switch everything off until we know?'",
        "offset_minutes": 25,
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
          "IT director"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Decides on preventive shutdown and records the criteria.",
            "responsible_role": "Crisis committee chair",
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
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Do we go home?",
        "content": "Staff are asking whether to go home. Trains are stopped, traffic lights are out and some colleagues live far away.",
        "offset_minutes": 40,
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
          "Human Resources"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Tells staff whether to go home, stay or shelter, and how to keep in touch.",
            "responsible_role": "Head of HR",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Fuel arrives tomorrow",
        "content": "The fuel supplier: every customer is asking for refuelling at once; the earliest delivery is tomorrow morning.",
        "offset_minutes": 55,
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
          "Crisis committee",
          "Continuity manager"
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
            "code": "INJ-04-A1",
            "description": "Decides which services keep running on the remaining fuel.",
            "responsible_role": "Crisis committee",
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "'Were you hacked?'",
        "content": "A journalist, on a crackling line: customers cannot reach {organization} and a viral post says its systems were hacked. Is it a cyberattack?",
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
            "code": "INJ-05-A1",
            "description": "Approves a message that does not speculate about the cause.",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "No evidence of a cyberattack",
        "content": "The national CSIRT: no evidence of a cyberattack so far; supply is being restored region by region. It recommends restarting systems in a controlled way and checking their integrity.",
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
          "IT director",
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
            "code": "INJ-06-A1",
            "description": "Decides the restart sequence and the integrity checks.",
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Charged twice?",
        "content": "Customers write in: transactions started during the blackout show as pending or charged twice.",
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
          "Operations director",
          "Communications"
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
            "code": "INJ-07-A1",
            "description": "Reconciles the transactions before reopening services.",
            "responsible_role": "Operations director",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Tells customers what happens with their pending transactions.",
            "responsible_role": "Head of communications",
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
    "next_threat_actor_number": 1
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
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-02",
      "name": "Critical supplier",
      "type": "supplier",
      "description": "A supplier the business depends on, affected by or involved in the incident.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-03",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
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
      "origin_id": "customer",
      "origin_name": "Customer",
      "code": "ACT-05",
      "name": "Customer",
      "type": "customer",
      "description": "A customer noticing the impact and asking for explanations.",
      "channel": "email"
    }
  ],
  "next_actor_number": 6,
  "tags": [
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
      "origin_id": "executive",
      "origin_name": "Executive",
      "name": "Executive",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "plan-validation",
      "origin_name": "Plan validation",
      "name": "Plan validation",
      "color": "moss",
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
