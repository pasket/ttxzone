---
format: "ttx-zone.scenario"
format_version: 8
language: "en"
title: "Two incidents, one campaign against the plant"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Two incidents, one campaign against the plant

A vehicle manufacturer deals with two apparently separate incidents: a compromised maintenance supplier with remote access to an assembly plant, and malware on a line-control server. Two teams work them in separate rooms until they meet as one campaign of sabotage, coercion, extortion and forged documents.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Decide on supplier access without certainty
- **OBJ-02** Protect people and evidence after the damage
- **OBJ-03** Handle coercion as a safety matter
- **OBJ-04** Govern the extortion decision
- **OBJ-05** Separate fact from forgery in public

## Scenario

{organization} builds vehicles at {assembly_plant} and runs its line-control systems from a shared manufacturing site. Robots and controllers are maintained remotely by {supplier}. Neither of the two teams knows yet that it is working on the same adversary.

## Phases and injects

### PH-01 Two quiet alarms

Day 1, morning. Each team sits in its own room and doesn't know what the other one is seeing.

- **INJ-01** (T+5′) The maintenance supplier reports a breach
- **INJ-02** (T+5′) Outbound traffic from a line-control server
- **INJ-03** (T+22′) Unplanned remote sessions at the plant
- **INJ-04** (contingent) A generic supplier account signs in at night
- **INJ-05** (T+25′) Unknown process under a contractor's account

### PH-02 Damage and coercion

Day 4. Before dawn, the plant's night shift calls the duty manager.

- **INJ-06** (T+50′) Robots collide on the assembly line
- **INJ-07** (T+50′) A manager asks for protection
- **INJ-08** (T+66′) A critical flaw in the line controllers
- **INJ-09** (T+68′) Malware with many modules, and confidential data gone
- **INJ-10** (T+82′) Altered firmware: it was an attack

### PH-03 One campaign

Day 12. Both incidents are now one. The Controller brings everyone to the main room.

- **INJ-11** (T+100′) Pay, or we show how we did it
- **POL-12** (T+110′) The countdown
  - The countdown is running and the actor holds genuine data. What do you do?
    - Refuse any contact and prepare for publication
      - A clear line that the police and most insurers welcome. The data comes out on the actor's schedule, and you need every statement ready.
    - Open a channel through a specialist to buy time, without promising payment
      - You gain hours and learn what the actor really holds. Staff and regulators may read it as negotiating, and the channel has to be run by the book.
    - Pay to stop the publication
      - It may delay the publication, but nothing guarantees it. Sanctions, insurance and the board all become problems, and you are now a paying target.
    - Go public first with what happened, before the actor does
      - You own the story for a day. You announce with incomplete facts, and each correction later will count against you.
- **INJ-13** (T+118′) Police call a sector meeting
- **INJ-14** (T+126′) Genuine and forged documents, together
- **INJ-15** (T+134′) The story spreads on social media
- **INJ-16** (T+142′) The share price falls

### PH-04 Closing the books

Three weeks later. Restoration is nearly complete.

- **DSC-17** (T+155′) Closing the crisis
- **DSC-18** (T+168′) Lessons from two rooms

## Simulated actors

- **ACT-01** Critical supplier
- **ACT-02** SOC
- **ACT-03** Cybersecurity team member
- **ACT-04** Incident response provider (retainer)
- **ACT-05** National CSIRT
- **ACT-06** Police cybercrime unit
- **ACT-07** Attacker (sender)
- **ACT-08** Threat intelligence provider
- **ACT-09** Media
- **ACT-10** Employee
- **ACT-11** Board chair

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "en",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Two incidents, one campaign against the plant",
    "description": "A vehicle manufacturer deals with two apparently separate incidents: a compromised maintenance supplier with remote access to an assembly plant, and malware on a line-control server. Two teams work them in separate rooms until they meet as one campaign of sabotage, coercion, extortion and forged documents."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "org_or_tech_change"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "third_party_supply_chain",
      "cross_unit_coordination",
      "crisis_decision_making",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Incident lead",
      "CISO",
      "Security operations",
      "Plant manager",
      "OT security",
      "Procurement",
      "Manufacturing systems",
      "Human resources",
      "Physical security",
      "Legal",
      "Data protection officer",
      "Communications",
      "CEO",
      "Crisis committee",
      "Investor relations"
    ],
    "third_parties": [],
    "perimeter": "Supplier access, plant and line-control systems, personal safety of staff, data breach handling and crisis communication.",
    "out_of_scope": "Vehicle recalls, product engineering and any real contact with authorities or the actor.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "IRON FINCH",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Supplier access has no off switch",
        "finding": "Nobody has rehearsed cutting a critical supplier's remote access while production depends on it.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Plant, IT and people teams work apart",
        "finding": "Incidents touching plant safety or a threatened employee have no agreed way of joining security, operations, human resources and physical security.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Extortion and forged documents untested",
        "finding": "The crisis committee has never decided how to answer extortion, nor how to prove which published documents are false.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decide on supplier access without certainty",
        "statement": "Before there is proof of impact, the team finds what the supplier can reach and decides who may keep access, weighing production against exposure.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Supplier accounts and paths listed\nDecision on access recorded with its owner\nDirect contact with the supplier's security lead",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The access inventory and the decision.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Protect people and evidence after the damage",
        "statement": "After physical damage at the plant, operations and security secure the area, keep the evidence and agree how lines can restart safely.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "People safe and area secured\nController and network evidence kept\nRestart conditions agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The evidence log and the restart conditions.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Handle coercion as a safety matter",
        "statement": "A threatened employee is protected and heard, with police and the investigation working together and without treating them first as a suspect.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Personal safety measures agreed\nPolice informed\nInvestigation kept confidential and evidence preserved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The handling record.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-04",
        "title": "Govern the extortion decision",
        "statement": "The crisis committee decides who owns the response to the extortion, with legal, insurance and police input, and meets its reporting duties.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decision owner named\nLegal, police and insurer consulted\nNotifications up to date",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The committee minutes.",
        "regulatory_requirement_ids": [
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-05",
        "title": "Separate fact from forgery in public",
        "statement": "The organization sorts genuine from forged documents, notifies what it must and answers with verified facts through one voice.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Method to verify documents agreed\nData breach decision recorded\nOne spokesperson and consistent messages",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The verification log and the statements.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "A real incident happens during the session.",
        "mitigation": "Anyone can stop the exercise with the stop keyword."
      },
      {
        "risk": "The two rooms lose track of each other before they converge.",
        "mitigation": "The Controller brings everyone to the main room at the start of the third phase."
      },
      {
        "risk": "The coercion inject is uncomfortable for someone at the table.",
        "mitigation": "The Facilitator warns about it in the briefing and keeps it to procedure."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Connected plant",
    "summary": "{organization} builds vehicles at {assembly_plant} and runs its line-control systems from a shared manufacturing site. Robots and controllers are maintained remotely by {supplier}. Neither of the two teams knows yet that it is working on the same adversary.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 10,
    "phases": [
      {
        "code": "PH-01",
        "name": "Two quiet alarms",
        "start_offset": 0,
        "end_offset": 45,
        "incident_jump_minutes": 0,
        "situation_update": "Day 1, morning. Each team sits in its own room and doesn't know what the other one is seeing.",
        "key_questions": [
          "What can this supplier reach today?",
          "Can we collect evidence from a server with no endpoint agent?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "A supplier in trouble and traffic that shouldn't exist"
      },
      {
        "code": "PH-02",
        "name": "Damage and coercion",
        "start_offset": 45,
        "end_offset": 95,
        "incident_jump_minutes": 2880,
        "situation_update": "Day 4. Before dawn, the plant's night shift calls the duty manager.",
        "key_questions": [
          "Who decides that a line is safe to restart?",
          "Is this one incident or two?"
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
        "headline": "Robots out of control and a manager under threat"
      },
      {
        "code": "PH-03",
        "name": "One campaign",
        "start_offset": 95,
        "end_offset": 150,
        "incident_jump_minutes": 13000,
        "situation_update": "Day 12. Both incidents are now one. The Controller brings everyone to the main room.",
        "key_questions": [
          "Who decides on the extortion?",
          "How do we prove that a document is false?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "Extortion, forged documents and a falling share price"
      },
      {
        "code": "PH-04",
        "name": "Closing the books",
        "start_offset": 150,
        "end_offset": 180,
        "incident_jump_minutes": 30000,
        "situation_update": "Three weeks later. Restoration is nearly complete.",
        "key_questions": [
          "What stays open after the crisis committee stands down?",
          "Who owns the lessons learned?"
        ],
        "objectives": [],
        "headline": "Out of crisis mode without losing sight"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Unidentified group",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Well-resourced group that combines supplier compromise, coercion of staff, sabotage of plant equipment, extortion and forged documents.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1199"
          },
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
            "technique_id": "T1041"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
          },
          {
            "domain": "ics",
            "technique_id": "T0836"
          },
          {
            "domain": "ics",
            "technique_id": "T0880"
          },
          {
            "domain": "ics",
            "technique_id": "T0879"
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
        "title": "The maintenance supplier reports a breach",
        "content": "Word reaches you through a joint-venture partner, not from {supplier} itself: its network has been compromised, apparently by malware. {supplier} maintains robots and controllers at {assembly_plant} remotely. Nobody can say yet whether customers are affected, and {supplier} has issued no statement.",
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
          "OT security",
          "Procurement"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1199"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Finds the contracts and the supplier's security contact.",
            "responsible_role": "Procurement",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Lists the supplier's accounts, VPN paths and the assets they reach.",
            "responsible_role": "OT security",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Decides whether supplier access is suspended before internal evidence appears.",
            "responsible_role": "Plant manager",
            "expected_within_minutes": 20,
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Outbound traffic from a line-control server",
        "content": "The SIEM flags an unusual volume of traffic from a line-control server towards a public address in {country_1}, with a poor but not damning reputation. The server has no EDR agent, so nobody can see what is running on it remotely, and it is connected to the production network that feeds the plants.",
        "offset_minutes": 5,
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
          "Manufacturing systems"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1041"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Keeps firewall, server and network logs before touching the server.",
            "responsible_role": "Security operations",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Explains what stops in production if the server is isolated.",
            "responsible_role": "Manufacturing systems",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
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
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Unplanned remote sessions at the plant",
        "content": "Scoping shows several hundred supplier users, a handful of generic accounts and some with direct VPN access to the network that manages the assembly lines. Monitoring now shows unplanned remote sessions into that network. They could be maintenance. {supplier} hasn't answered yet.",
        "offset_minutes": 22,
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
          "OT security",
          "Plant manager"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Checks each session against planned maintenance and keeps the logs.",
            "responsible_role": "OT security",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decides what happens to the generic accounts and the VPN tunnel.",
            "responsible_role": "Plant manager",
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
        "code": "INJ-04",
        "phase_code": "PH-01",
        "kind": "contingent",
        "title": "A generic supplier account signs in at night",
        "content": "A generic supplier account has just signed in to the line-management network at 03:12, outside any maintenance window, and it is still connected. Who can cut it, right now?",
        "offset_minutes": null,
        "trigger_condition": "Supplier access still open 15 minutes after INJ-03.",
        "contingent_purpose": "Force the access decision.",
        "fires_at_minute": 40,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "OT security",
          "Plant manager"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Authorises cutting the session and records who decided it.",
            "responsible_role": "Plant manager",
            "expected_within_minutes": 5,
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
        "code": "INJ-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Unknown process under a contractor's account",
        "content": "On site, the team finds an unknown process on the server running with the rights of an external administrator employed by a contractor. The administrator's account also reaches other servers. HR and the contract manager ask how they should approach the person.",
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
          "Manufacturing systems",
          "Human resources"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Restricts the account while keeping the evidence and lists what it accessed.",
            "responsible_role": "Security operations",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Agrees with Legal how the interview with the administrator is run.",
            "responsible_role": "Human resources",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
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
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Robots collide on the assembly line",
        "content": "Several robots on the body line at {assembly_plant} have struck vehicle frames and nearby equipment. Their safety interlocks should have stopped them on abnormal position and torque, and they didn't. Nobody was hurt. The cause could be a fault, a bad recipe or something else, and a local news site already has photographs.",
        "offset_minutes": 50,
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
          "Plant manager",
          "OT security"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0880"
          },
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0879"
          }
        ],
        "facilitator_notes": "Don't confirm a cyberattack yet. The team should ask whether the supplier and the unplanned sessions are related.",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Stops the affected cells and secures the area for people.",
            "responsible_role": "Plant manager",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Keeps controller, safety system and network evidence before any repair.",
            "responsible_role": "OT security",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Sets the conditions for restarting each line.",
            "responsible_role": "Plant manager",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
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
        "code": "INJ-07",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "A manager asks for protection",
        "content": "The contractor has explained that the software was installed under an approved change request, raised by an internal server manager. That manager now comes to HR and asks for help: an anonymous contact on a professional network threatened their family unless the request was raised. They have kept the messages and are frightened.",
        "offset_minutes": 50,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Human resources",
          "Physical security",
          "Legal"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "This inject can be uncomfortable. Keep the discussion on procedure and support, not on guilt.",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Agrees personal safety measures for the employee and their family.",
            "responsible_role": "Physical security",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Informs the police and keeps the messages and the change records.",
            "responsible_role": "Legal",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-07-A3",
            "description": "Limits who knows and decides how the employee is supported.",
            "responsible_role": "Human resources",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
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
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "A critical flaw in the line controllers",
        "content": "The national CSIRT warns of a critical, remotely exploitable vulnerability in a family of automation controllers, already exploited where devices are exposed. Most production cells at {organization} use it. Each update means stopping the cell, making it safe and validating it, so the full rollout would take many weeks unless more people are added, with more cost and more risk of errors.",
        "offset_minutes": 66,
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
          "OT security",
          "Plant manager"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Ranks the cells by exposure, safety and production weight.",
            "responsible_role": "OT security",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Decides on the patching pace and the controls for cells left unpatched.",
            "responsible_role": "Plant manager",
            "expected_within_minutes": 18,
            "objective_codes": [
              "OBJ-02"
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
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Malware with many modules, and confidential data gone",
        "content": "The forensic team reports multi-module malware with persistence, network sniffing, credential theft, lateral movement and denial of service against automation protocols. The server could see traffic from the assembly and end-of-line testing networks. Several gigabytes left for {country_1}: line architecture, automation recipes, intellectual property, supplier contracts, and customer identity and payment data.",
        "offset_minutes": 68,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Security operations",
          "Manufacturing systems",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1041"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Looks for the same artifacts across IT and plant networks.",
            "responsible_role": "Manufacturing systems",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-09-A2",
            "description": "Starts the data breach assessment with the data protection officer.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
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
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Altered firmware: it was an attack",
        "content": "Forensic analysis of the damaged cells finds unauthorised firmware that changed the position and torque limits at which the safety shutdown acts. The damage was a cyberattack. Hashes and a detection rule are ready to share.",
        "offset_minutes": 82,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "OT security",
          "Plant manager",
          "Incident lead"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0106",
            "technique_id": "T0836"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Classifies the event as a confirmed attack and escalates it.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Checks the remaining cells against the hashes before any restart.",
            "responsible_role": "OT security",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
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
        "code": "INJ-11",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Pay, or we show how we did it",
        "content": "The CEO receives an email: the sender claims control of the assembly infrastructure and of everything taken from the manufacturing network, and attaches a short video of a robot control screen. A leak page shows a countdown of 18 hours and a demand of {ransom_amount} in cryptocurrency. The threat intelligence provider links this to both incidents.",
        "offset_minutes": 100,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "CEO",
          "Crisis committee",
          "Legal"
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
        "facilitator_notes": "From here on, project each inject in the main room with everyone together.",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Names who owns the decision and who talks to the police and the insurer.",
            "responsible_role": "Crisis committee",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-11-A2",
            "description": "Reviews sanctions, notification and disclosure limits on any contact.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Unknown sender",
          "sender_address": "proof@mailbox.example.net",
          "recipient": "CEO",
          "subject": "We were on your line",
          "timestamp": "Day 12, 11:00",
          "location": ""
        },
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
        "title": "The countdown",
        "content": "Eighteen hours remain.",
        "offset_minutes": 110,
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
        "facilitator_notes": "Close the vote confirming the option chosen, then show the result: the table reads its consequence. The next inject holds whichever option wins. Each decision adds to the meters: show their summary in the hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "The countdown is running and the actor holds genuine data. What do you do?",
        "poll_options": [
          "Refuse any contact and prepare for publication",
          "Open a channel through a specialist to buy time, without promising payment",
          "Pay to stop the publication",
          "Go public first with what happened, before the actor does"
        ],
        "poll_outcomes": [
          "A clear line that the police and most insurers welcome. The data comes out on the actor's schedule, and you need every statement ready.",
          "You gain hours and learn what the actor really holds. Staff and regulators may read it as negotiating, and the channel has to be run by the book.",
          "It may delay the publication, but nothing guarantees it. Sanctions, insurance and the board all become problems, and you are now a paying target.",
          "You own the story for a day. You announce with incomplete facts, and each correction later will count against you."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2,
            "m5": 1
          },
          {
            "m2": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Police call a sector meeting",
        "content": "National police confirm that other manufacturers and suppliers have been hit by the same campaign, and invite {organization} to a closed meeting with peers and an external response firm. They ask who will attend and what you will share.",
        "offset_minutes": 118,
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
          "CISO",
          "Legal",
          "Crisis committee"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "Names the representative and agrees what information can be shared.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
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
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Genuine and forged documents, together",
        "content": "The countdown ends and files appear on the leak site. Many are genuine stolen documents. Mixed in with them are forged ones that claim {organization} hid safety defects, manipulated quality tests and bribed officials. The genuine ones make the fakes believable.",
        "offset_minutes": 126,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-08",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Communications",
          "Legal",
          "Crisis committee",
          "Security operations"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Agrees a method to tell genuine from forged documents and keeps every copy.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Warns key audiences that real data is being used to support false claims.",
            "responsible_role": "Communications",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-14-A3",
            "description": "Confirms the data breach decision with the data protection officer.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
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
        "code": "INJ-15",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The story spreads on social media",
        "content": "LEAKED: internal files show {organization} knew about safety defects and paid to hide them. Share before it gets deleted.",
        "offset_minutes": 134,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Communications",
          "CEO"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-15-A1",
            "description": "Approves verified facts, one spokesperson and which falsehoods to correct first.",
            "responsible_role": "Communications",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Motor news account",
          "sender_address": "@motor_leaks",
          "recipient": "",
          "subject": "",
          "timestamp": "Day 13, 11:00",
          "location": ""
        },
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
        "code": "INJ-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The share price falls",
        "content": "Shares have lost almost a quarter of their value since the disclosure, and major investors are asking questions. The board chair wants to know what can be said to the market, and who signs it.",
        "offset_minutes": 142,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CEO",
          "Investor relations",
          "Legal"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-16-A1",
            "description": "Prepares a factual update with Legal on production, data and recovery.",
            "responsible_role": "Investor relations",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-05"
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
        "code": "DSC-17",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Closing the crisis",
        "content": "Services are nearly restored and no new compromised assets have appeared. An independent report has separated the genuine documents from the forged ones. What must be finished before the crisis committee stands down, and how does oversight continue afterwards?",
        "offset_minutes": 155,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CEO",
          "Crisis committee"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Ask for residual risk, open notifications, the unpatched cells and the follow-up with the coerced employee.",
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
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-18",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Lessons from two rooms",
        "content": "Two teams worked the same adversary for days without knowing it. When could they have made the connection, what would have changed, and who owns the improvements to supplier access, change control and plant monitoring?",
        "offset_minutes": 168,
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
          "CISO",
          "Crisis committee",
          "Plant manager"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Note each improvement with an owner and a date for the after-action report.",
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
    "next_phase_number": 5,
    "next_inject_number": 19,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Production"
      },
      {
        "key": "m2",
        "name": "Threat actor risk"
      },
      {
        "key": "m3",
        "name": "Team stress"
      },
      {
        "key": "m4",
        "name": "Legal and brand"
      },
      {
        "key": "m5",
        "name": "Budget"
      }
    ]
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-01",
      "name": "Critical supplier",
      "type": "supplier",
      "description": "A supplier the business depends on, affected by or involved in the incident.",
      "channel": "phone"
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
      "origin_id": "cybersecurity-team-member",
      "origin_name": "Cybersecurity team member",
      "code": "ACT-03",
      "name": "Cybersecurity team member",
      "type": "internal",
      "description": "An analyst or engineer reporting what a security tool shows, when the cybersecurity team isn't playing.",
      "channel": "security_tool"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Incident response provider (retainer)",
      "code": "ACT-04",
      "name": "Incident response provider (retainer)",
      "type": "supplier",
      "description": "The external response and forensics team, usually under a retainer activated during the incident: findings, reports and containment advice.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-05",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team: asks for reports and shares indicators.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Police cybercrime unit",
      "code": "ACT-06",
      "name": "Police cybercrime unit",
      "type": "authority",
      "description": "Law enforcement investigating the attack and asking for evidence.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-07",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Threat intelligence provider",
      "code": "ACT-08",
      "name": "Threat intelligence provider",
      "type": "supplier",
      "description": "Monitors forums, leak sites and social media: reports exposed data and attacker activity.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-09",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-10",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Board chair",
      "code": "ACT-11",
      "name": "Board chair",
      "type": "internal",
      "description": "The chair of the board when the board isn't playing: demands answers and calls meetings.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 12,
  "tags": [
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
      "origin_id": "supply-chain",
      "origin_name": "Supply chain",
      "name": "Supply chain",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
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
      "origin_id": "hybrid",
      "origin_name": "Hybrid threat",
      "name": "Hybrid threat",
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
  "uses_rooms": true,
  "rooms": [
    {
      "code": "RM-01",
      "name": "Plant and supplier",
      "description": "Plant management, OT security and procurement."
    },
    {
      "code": "RM-02",
      "name": "Manufacturing systems",
      "description": "Security operations, manufacturing systems, human resources and physical security."
    }
  ],
  "next_room_number": 3,
  "files": []
}
```
