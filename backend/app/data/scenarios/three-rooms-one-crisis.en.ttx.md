---
format: "ttx-zone.scenario"
format_version: 9
language: "en"
title: "Three rooms, one crisis"
exported_at: "2026-11-28T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "20.1"
---

# Three rooms, one crisis

A poisoned open-source dependency in a regional citizen-services platform takes down the electronic office of dozens of town halls. A town hall, the regional agency and the water utility each decide in their own room with part of the picture, then have to speak as one.

> TTX-Zone exercise template. Import it from Library → Exercise templates. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Essential services on paper
- **OBJ-02** One shared picture
- **OBJ-03** Notify on time, speak once

## Scenario

Tuesday, 09:05. In {region}, {digital_agency} runs the citizen-services platform for {town_hall_count} town halls: the electronic office, the residents' register and an AI assistant. {water_utility} hosts its customer portal there. Overnight, a build pulled a tampered open-source dependency.

## Phases and injects

### PH-01 An ordinary Tuesday

Tuesday, 09:05. An ordinary morning in the three administrations.

- **INJ-01** (T+5′) A dependency that reads too much
- **INJ-02** (T+12′) The registry is being read
- **POL-03** (T+17′) The platform
  - Do you shut the platform down for every town hall?
    - Shut it down now, for all {town_hall_count}
      - The actor loses the platform at once. Every town hall goes to paper within the hour, and most learn it from their own staff.
    - Keep it up under watch, cut the stolen keys
      - Services continue and you learn what the actor wants. If records leave while you watch, you will explain why.
    - Shut down only the register and the assistant
      - The known path closes and the electronic office stays. What you did not know was connected stays connected.
- **INJ-04** (T+12′) Emergency aid is due tomorrow
- **POL-05** (T+17′) The payments
  - Do you pay tomorrow's emergency aid without the register?
    - Pay everyone on last month's list, on paper
      - Families get their aid on time. Some payments will be wrong, and the auditor will ask who signed.
    - Delay until the register is back
      - Every payment will be correct. {aid_households} households wait, and nobody can say for how long.
    - Social workers confirm the cases they know, pay those
      - The most urgent cases are paid tomorrow. Three people can't confirm {aid_households} households in a day.
- **INJ-06** (T+12′) Same sign-in, different system
- **POL-07** (T+17′) The notice
  - Do you issue a precautionary notice to residents?
    - Issue a precautionary notice now
      - Residents hear it from you first. Supermarkets run out of bottled water by noon, and the town hall learns it from the radio.
    - Move the plant to manual operation and say nothing yet
      - Readings are checked by hand and the water is safe. If it leaks that you doubted and stayed quiet, the story is the silence.
    - Wait for evidence before doing anything
      - No alarm, no cost. If the readings were touched, you had the warning and did nothing.

### PH-02 Three messages

Tuesday, 13:00. The platform has been under attack for four hours and each administration has taken its own decision.

- **INJ-08** (T+45′) Regional radio is on the line
- **INJ-09** (contingent) Three answers on air
- **INJ-10** (T+65′) The national CSIRT asks

### PH-03 One voice

Thursday, 10:00. Two days later, residents' records appear online.

- **INJ-11** (T+90′) A sample of the register is online
- **POL-12** (T+95′) Who speaks
  - Residents of {town_hall_count} towns are asking. Who tells them, and how?
    - One joint spokesperson, one statement for all three
      - Residents hear one story. It takes two hours to agree, and the mayor is not the one on camera.
    - Each administration speaks, on agreed lines
      - Each mayor answers their own residents. By the second day, {town_hall_count} voices have drifted apart.
    - File what the law requires and add nothing
      - Legally tidy. The forum poster tells the story instead.
- **DSC-13** (T+110′) Hot wash

## Simulated actors

- **ACT-01** Agency SOC
- **ACT-02** Platform operations
- **ACT-03** Social services
- **ACT-04** Plant operations
- **ACT-05** Media
- **ACT-06** National CSIRT
- **ACT-07** Exercise control

## Placeholders

- `{region}` The region the three administrations belong to. (e.g. Valdoria)
- `{digital_agency}` The regional agency that runs the shared citizen-services platform. Written as a name, without an article. (e.g. Valdoria Digital Agency)
- `{town}` The town whose town hall plays in the first room. (e.g. Sotoverde)
- `{water_utility}` The water utility that hosts its customer portal on the platform. Written as a name, without an article. (e.g. Valdoria Water)
- `{town_hall_count}` How many town halls depend on the platform, as a number. (e.g. 62)
- `{aid_households}` How many households are due emergency aid tomorrow, as a number. (e.g. 340)
- `{leaked_records}` How many residents' records appear in the leaked sample, as a number. (e.g. 2,000)

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 9,
  "language": "en",
  "exported_at": "2026-11-28T00:00:00Z",
  "exercise": {
    "name": "Three rooms, one crisis",
    "description": "A poisoned open-source dependency in a regional citizen-services platform takes down the electronic office of dozens of town halls. A town hall, the regional agency and the water utility each decide in their own room with part of the picture, then have to speak as one."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "cross_unit_coordination",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Mayor's office",
      "Social services",
      "Municipal IT",
      "Agency director",
      "Agency CISO",
      "Platform operations",
      "Regional cabinet",
      "Utility director",
      "Plant operations",
      "Communication"
    ],
    "third_parties": [
      "National CSIRT",
      "Media"
    ],
    "perimeter": "The crisis cells of the town hall of {town}, {digital_agency} and {water_utility}, and the decisions they share.",
    "out_of_scope": "The technical recovery of the platform.",
    "max_duration_hours": 2,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "REAL WORLD",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Essential services depend on a shared platform",
        "finding": "Essential services to residents depend on a platform the town hall does not operate, and there is no rehearsed way to run them without it.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "No joint decision has been rehearsed",
        "finding": "A decision that affects several administrations at once has never been rehearsed.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Nobody owns the notification of a shared incident",
        "finding": "It is not agreed who notifies, or who speaks, when the incident belongs to three administrations.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Essential services on paper",
        "statement": "Each administration decides within 20 minutes how its essential service to residents continues without the platform, and names who is accountable.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Each room decides how its essential service continues\nEach decision has a named accountable person\nThe decision is taken within 20 minutes of the inject",
        "achieve_at_least": null,
        "time_box_minutes": 20,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Decision log of each room.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "One shared picture",
        "statement": "The three administrations agree a common situation picture and a single statement within 15 minutes of the first media request.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "The three administrations talk to each other before answering the media\nOne statement is agreed, with a named spokesperson\nIt happens within 15 minutes of the request",
        "achieve_at_least": null,
        "time_box_minutes": 15,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Decision log and the statement.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Notify on time, speak once",
        "statement": "The early warning is filed within the 24-hour window by a named owner, and residents receive one consistent message.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "A named owner files the early warning within 24 hours\nThe town hall and the utility confirm who notifies for them\nResidents receive one consistent message",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Notification record and the public statement.",
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
    "title": "Three rooms, one crisis",
    "summary": "Tuesday, 09:05. In {region}, {digital_agency} runs the citizen-services platform for {town_hall_count} town halls: the electronic office, the residents' register and an AI assistant. {water_utility} hosts its customer portal there. Overnight, a build pulled a tampered open-source dependency.",
    "attack_version": "20.1",
    "duration_minutes": 120,
    "time_compression": 1,
    "phases": [
      {
        "code": "PH-01",
        "name": "An ordinary Tuesday",
        "start_offset": 0,
        "end_offset": 40,
        "incident_jump_minutes": 0,
        "situation_update": "Tuesday, 09:05. An ordinary morning in the three administrations.",
        "key_questions": [
          "Who decides for your administration?",
          "Who else needs to know what you have just decided?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "A dependency that reads too much"
      },
      {
        "code": "PH-02",
        "name": "Three messages",
        "start_offset": 40,
        "end_offset": 85,
        "incident_jump_minutes": 195,
        "situation_update": "Tuesday, 13:00. The platform has been under attack for four hours and each administration has taken its own decision.",
        "key_questions": [
          "Who speaks for the three of you?",
          "Who files the early warning, and for whom?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "The media ask, and the clock runs"
      },
      {
        "code": "PH-03",
        "name": "One voice",
        "start_offset": 85,
        "end_offset": 120,
        "incident_jump_minutes": 2655,
        "situation_update": "Thursday, 10:00. Two days later, residents' records appear online.",
        "key_questions": [
          "Who tells the residents, and how?"
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
        "headline": "Residents' records are online"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Unidentified actor",
        "mitre_group_id": null,
        "aliases": [],
        "description": "An actor that reached the platform's cloud accounts through a tampered open-source dependency in a build.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1087.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1530"
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
        "title": "A dependency that reads too much",
        "content": "The build of the residents' AI assistant pulled a tampered open-source dependency last night. Cloud access keys from that pipeline are being used from an address we don't know.",
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
          "Agency CISO",
          "Mayor's office",
          "Utility director"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Each room names who decides for it.",
            "responsible_role": "Agency director",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The registry is being read",
        "content": "The actor is listing the residents' register database. Shutting the platform down stops the electronic office of {town_hall_count} town halls.",
        "offset_minutes": 12,
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
          "Agency director",
          "Agency CISO"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1087.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Decides what happens to the platform and tells the town halls.",
            "responsible_role": "Agency director",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The platform",
        "content": "The actor is in the platform and {town_hall_count} town halls depend on it.",
        "offset_minutes": 17,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Close the vote confirming the option the room chose, then show the result: the room reads its consequence. The next inject holds whichever option wins. Each decision adds to the meters: show their summary in the hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Do you shut the platform down for every town hall?",
        "poll_options": [
          "Shut it down now, for all {town_hall_count}",
          "Keep it up under watch, cut the stolen keys",
          "Shut down only the register and the assistant"
        ],
        "poll_outcomes": [
          "The actor loses the platform at once. Every town hall goes to paper within the hour, and most learn it from their own staff.",
          "Services continue and you learn what the actor wants. If records leave while you watch, you will explain why.",
          "The known path closes and the electronic office stays. What you did not know was connected stays connected."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2
          },
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 2
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Emergency aid is due tomorrow",
        "content": "The electronic office and the register don't respond. Emergency aid for {aid_households} households is paid tomorrow, and eligibility is checked against the register.",
        "offset_minutes": 12,
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
          "Mayor's office",
          "Social services"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Decides how tomorrow's aid is paid and who signs it.",
            "responsible_role": "Mayor's office",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The payments",
        "content": "The register is down and the aid is due tomorrow.",
        "offset_minutes": 17,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Close the vote confirming the option the room chose, then show the result: the room reads its consequence. The next inject holds whichever option wins. Each decision adds to the meters: show their summary in the hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Do you pay tomorrow's emergency aid without the register?",
        "poll_options": [
          "Pay everyone on last month's list, on paper",
          "Delay until the register is back",
          "Social workers confirm the cases they know, pay those"
        ],
        "poll_outcomes": [
          "Families get their aid on time. Some payments will be wrong, and the auditor will ask who signed.",
          "Every payment will be correct. {aid_households} households wait, and nobody can say for how long.",
          "The most urgent cases are paid tomorrow. Three people can't confirm {aid_households} households in a day."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 1,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 3,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 3
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Same sign-in, different system",
        "content": "Our customer portal runs on the agency's platform, and plant staff sign in to remote monitoring through the same identity provider. Readings look normal. We can't prove nobody touched them.",
        "offset_minutes": 12,
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
          "Utility director",
          "Plant operations"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decides how the plant is operated until the readings can be trusted.",
            "responsible_role": "Utility director",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-03"
        ],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-07",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The notice",
        "content": "The readings look normal and nobody can vouch for them.",
        "offset_minutes": 17,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Close the vote confirming the option the room chose, then show the result: the room reads its consequence. The next inject holds whichever option wins. Each decision adds to the meters: show their summary in the hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-03"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Do you issue a precautionary notice to residents?",
        "poll_options": [
          "Issue a precautionary notice now",
          "Move the plant to manual operation and say nothing yet",
          "Wait for evidence before doing anything"
        ],
        "poll_outcomes": [
          "Residents hear it from you first. Supermarkets run out of bottled water by noon, and the town hall learns it from the radio.",
          "Readings are checked by hand and the water is safe. If it leaks that you doubted and stayed quiet, the story is the silence.",
          "No alarm, no cost. If the readings were touched, you had the warning and did nothing."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 3,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Regional radio is on the line",
        "content": "We go on air at 14:00. Is the platform down, is the aid paid tomorrow, and is the water safe? One answer, please.",
        "offset_minutes": 45,
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
          "Communication",
          "Mayor's office",
          "Regional cabinet",
          "Utility director"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "From here on, project each inject in the main room with everyone together.",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "The three administrations agree a single statement before answering.",
            "responsible_role": "Communication",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "Three answers on air",
        "content": "Town hall: 'back tomorrow'. Region: 'shut down until further notice'. Water company: no comment.",
        "offset_minutes": null,
        "trigger_condition": "No single statement 15 minutes after INJ-08.",
        "contingent_purpose": "Show the table what three separate answers look like from outside.",
        "fires_at_minute": 20,
        "branch_from_code": "INJ-08",
        "branch_action_code": "INJ-08-A1",
        "rejoin_code": "INJ-10",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Communication",
          "Mayor's office",
          "Regional cabinet",
          "Utility director"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Names one spokesperson and corrects the three messages.",
            "responsible_role": "Regional cabinet",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The national CSIRT asks",
        "content": "We have reports from three entities about what looks like one incident. Who files the early warning, and for whom?",
        "offset_minutes": 65,
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
          "Agency CISO",
          "Mayor's office",
          "Utility director"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "A named owner files the early warning within the 24-hour window.",
            "responsible_role": "Agency CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "The town hall and the utility confirm who notifies for them.",
            "responsible_role": "Mayor's office",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-11",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "A sample of the register is online",
        "content": "A sample of {leaked_records} residents' records from {region} is on a leak forum. The poster says there is more.",
        "offset_minutes": 90,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Agency CISO",
          "Mayor's office",
          "Communication"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1530"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Decides who tells the residents, and with which message.",
            "responsible_role": "Regional cabinet",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-12",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Who speaks",
        "content": "Residents' records are online and {town_hall_count} town halls are being asked.",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Project it in the main room with everyone together. Close the vote confirming the option chosen, then show the result: the table reads its consequence. Each decision adds to the meters: show their summary in the hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Residents of {town_hall_count} towns are asking. Who tells them, and how?",
        "poll_options": [
          "One joint spokesperson, one statement for all three",
          "Each administration speaks, on agreed lines",
          "File what the law requires and add nothing"
        ],
        "poll_outcomes": [
          "Residents hear one story. It takes two hours to agree, and the mayor is not the one on camera.",
          "Each mayor answers their own residents. By the second day, {town_hall_count} voices have drifted apart.",
          "Legally tidy. The forum poster tells the story instead."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 1,
            "m3": 1,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Hot wash",
        "content": "What would you do differently in the first hour?",
        "offset_minutes": 110,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Mayor's office",
          "Agency director",
          "Utility director"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Write down each improvement with an owner for the after-action report.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 14,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Service to residents"
      },
      {
        "key": "m2",
        "name": "Public trust"
      },
      {
        "key": "m3",
        "name": "Legal exposure"
      },
      {
        "key": "m4",
        "name": "Load on the teams"
      }
    ]
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "Agency SOC",
      "type": "soc",
      "description": "The agency's security operations centre.",
      "channel": "ticket"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-02",
      "name": "Platform operations",
      "type": "internal",
      "description": "The team that runs the platform.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-03",
      "name": "Social services",
      "type": "internal",
      "description": "The town hall's social services.",
      "channel": "in_person"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-04",
      "name": "Plant operations",
      "type": "internal",
      "description": "The utility's plant operations.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-05",
      "name": "Media",
      "type": "media",
      "description": "Regional radio and local news.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-06",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team.",
      "channel": "email"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-07",
      "name": "Exercise control",
      "type": "other",
      "description": "The exercise's own voice: briefings and the hot wash.",
      "channel": "briefing"
    }
  ],
  "next_actor_number": 8,
  "tags": [
    {
      "origin": "system",
      "origin_id": "supply-chain",
      "origin_name": "Supply chain",
      "name": "Supply chain",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "cloud",
      "origin_name": "Cloud",
      "name": "Cloud",
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
      "origin_id": "communications",
      "origin_name": "Communications",
      "name": "Communications",
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
  "uses_rooms": true,
  "rooms": [
    {
      "code": "RM-01",
      "name": "Town hall",
      "description": "The town hall of {town}: the mayor's crisis cell."
    },
    {
      "code": "RM-02",
      "name": "Regional government",
      "description": "{digital_agency} and the regional cabinet."
    },
    {
      "code": "RM-03",
      "name": "Water utility",
      "description": "{water_utility}: management and plant operations."
    }
  ],
  "next_room_number": 4,
  "files": [],
  "placeholders": [
    {
      "name": "region",
      "description": "The region the three administrations belong to.",
      "suggested": "Valdoria"
    },
    {
      "name": "digital_agency",
      "description": "The regional agency that runs the shared citizen-services platform. Written as a name, without an article.",
      "suggested": "Valdoria Digital Agency"
    },
    {
      "name": "town",
      "description": "The town whose town hall plays in the first room.",
      "suggested": "Sotoverde"
    },
    {
      "name": "water_utility",
      "description": "The water utility that hosts its customer portal on the platform. Written as a name, without an article.",
      "suggested": "Valdoria Water"
    },
    {
      "name": "town_hall_count",
      "description": "How many town halls depend on the platform, as a number.",
      "suggested": "62"
    },
    {
      "name": "aid_households",
      "description": "How many households are due emergency aid tomorrow, as a number.",
      "suggested": "340"
    },
    {
      "name": "leaked_records",
      "description": "How many residents' records appear in the leaked sample, as a number.",
      "suggested": "2,000"
    }
  ]
}
```
