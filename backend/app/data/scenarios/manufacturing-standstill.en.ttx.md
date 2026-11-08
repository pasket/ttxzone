---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Ransomware stops a manufacturer and its supply chain"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware stops a manufacturer and its supply chain

Ransomware forces a manufacturer running just-in-time production to shut down its systems and stop every plant. Suppliers lose their call-offs, dealers cannot order, and small suppliers face a cash crisis. The exercise tests the shutdown and restart decisions, communication with the supply chain without email, and who speaks about jobs and the economy.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Controlled stop and restart
- **OBJ-02** Supply chain kept informed
- **OBJ-03** Authorities and public informed

## Scenario

At the 06:00 shift change, {organization} detects encryption on the servers that plan production and logistics. Plant systems share the same network.

## Phases and injects

### PH-01 Shutdown

Wednesday, 06:00 shift change. Encryption on the planning servers.

- **INJ-01** (T+5′) Encryption on the planning servers
- **INJ-02** (T+30′) Can plant 2 keep going?

### PH-02 Idle plants

Three days later. Plants idle; suppliers and dealers are waiting.

- **INJ-03** (T+55′) Should suppliers keep producing?
- **INJ-04** (T+80′) Dealers cannot order
- **INJ-05** (T+95′) Incident notification at 72 hours

### PH-03 Restart

Two weeks later. Systems are being rebuilt; small suppliers are struggling.

- **INJ-06** (T+115′) A small supplier is running out of cash
- **INJ-07** (T+140′) Ready to restart?
- **INJ-08** (T+155′) Jobs and the economy

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Employee
- **ACT-03** Critical supplier
- **ACT-04** Customer
- **ACT-05** Competent authority
- **ACT-06** Incident response provider (retainer)
- **ACT-07** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ransomware stops a manufacturer and its supply chain",
    "description": "Ransomware forces a manufacturer running just-in-time production to shut down its systems and stop every plant. Suppliers lose their call-offs, dealers cannot order, and small suppliers face a cash crisis. The exercise tests the shutdown and restart decisions, communication with the supply chain without email, and who speaks about jobs and the economy."
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
      "Manufacturing",
      "Purchasing",
      "Sales",
      "Communications",
      "Legal",
      "Crisis committee chair",
      "Head of manufacturing",
      "Purchasing director",
      "Sales director",
      "Compliance officer",
      "Chief Financial Officer",
      "IT director",
      "Head of communications",
      "Chief Executive Officer"
    ],
    "third_parties": [
      "Suppliers",
      "Dealers"
    ],
    "perimeter": "Plants, production planning and logistics, suppliers and dealers, and the crisis committee.",
    "out_of_scope": "Technical recovery of plant systems.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "IRON GATE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Plant systems share the corporate network",
        "finding": "Planning, logistics and plant execution share infrastructure; a corporate incident stops production.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "No channel to suppliers without email",
        "finding": "Thousands of suppliers receive call-offs only through systems that would be down.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Incident reporting untested",
        "finding": "The notification to the competent authority has never been exercised.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Controlled stop and restart",
        "statement": "The committee decides the scope of the shutdown and the restart order, with validation criteria.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Shutdown scope decided\nRestart order and checks agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Committee minutes and the restart plan.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Supply chain kept informed",
        "statement": "Suppliers and dealers get clear instructions through an alternative channel, and support for suppliers is decided.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Instructions sent to suppliers and dealers\nSupplier support decided",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Messages sent and the payment decision.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Authorities and public informed",
        "statement": "The incident is notified to the competent authority, and a spokesperson addresses government, unions and press.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notification sent\nSpokesperson named",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Notification and the public statement.",
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
    "title": "Every line stopped",
    "summary": "At the 06:00 shift change, {organization} detects encryption on the servers that plan production and logistics. Plant systems share the same network.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Shutdown",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Wednesday, 06:00 shift change. Encryption on the planning servers.",
        "key_questions": [
          "Stop every plant, or try to keep some lines?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Encryption at the shift change"
      },
      {
        "code": "PH-02",
        "name": "Idle plants",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Three days later. Plants idle; suppliers and dealers are waiting.",
        "key_questions": [
          "How do we reach thousands of suppliers without email?"
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
        "headline": "Suppliers and dealers in the dark"
      },
      {
        "code": "PH-03",
        "name": "Restart",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 20160,
        "situation_update": "Two weeks later. Systems are being rebuilt; small suppliers are struggling.",
        "key_questions": [
          "What do we restart first, and how do we trust it?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Rebuilding, and suppliers in trouble"
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
        "description": "Unidentified ransomware affiliate.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "ics",
            "technique_id": "T0826"
          },
          {
            "domain": "ics",
            "technique_id": "T0828"
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
        "title": "Encryption on the planning servers",
        "content": "The SOC: files are being encrypted on the production planning and logistics servers. The plants' execution systems are in the same domain.",
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
          "Security operations",
          "Crisis committee"
        ],
        "delivery_method": "security_tool",
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
            "description": "Decides whether to shut down all systems and stop every plant.",
            "responsible_role": "Crisis committee chair",
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
        "title": "Can plant 2 keep going?",
        "content": "The plant 2 manager: lines are stopping with half-built vehicles on them. 'Our line controllers are still working. Can we isolate the plant and keep going?'",
        "offset_minutes": 30,
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
          "Head of manufacturing",
          "Crisis committee"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0828"
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
            "description": "Decides whether any line keeps running, and on what conditions.",
            "responsible_role": "Head of manufacturing",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Should suppliers keep producing?",
        "content": "A tier-1 supplier: no call-offs for three days, trucks are waiting at your gates and their own lines are full. Should they keep producing or stop?",
        "offset_minutes": 55,
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
          "Purchasing director"
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
            "description": "Sends suppliers instructions through an alternative channel.",
            "responsible_role": "Purchasing director",
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
        "title": "Dealers cannot order",
        "content": "The dealer association: dealers cannot order vehicles or parts, nor complete registrations. Customers are cancelling.",
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
          "Sales director"
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
            "description": "Gives dealers a manual process and a contact.",
            "responsible_role": "Sales director",
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
        "origin": "system",
        "origin_id": "INJ-REG-03",
        "origin_name": "Incident notification at 72 hours",
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Incident notification at 72 hours",
        "content": "The competent authority reminds {organization} that the incident notification is due and asks for the impact on production and on the supply chain.",
        "offset_minutes": 95,
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
          "Compliance officer",
          "Legal"
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
            "description": "Sends the notification with the impact on production.",
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
        "title": "A small supplier is running out of cash",
        "content": "A small supplier for which you are the only big customer: without payments for three weeks it will lay off staff next week. It asks to be paid for the parts it could not deliver.",
        "offset_minutes": 115,
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
          "Chief Financial Officer",
          "Purchasing director"
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
            "description": "Decides whether to pay suppliers for undelivered parts, and who authorizes it.",
            "responsible_role": "Chief Financial Officer",
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
        "title": "Ready to restart?",
        "content": "The incident response provider: planning and logistics servers are rebuilt and clean; plant systems and dealer systems are still being checked. Production data may be out of sync.",
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
          "Crisis committee",
          "IT director"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Agrees the restart order and the validation checks.",
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
        "code": "INJ-08",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Jobs and the economy",
        "content": "A business journalist: unions say thousands of jobs at suppliers are at risk and the government is asking for figures. Who at {organization} will speak?",
        "offset_minutes": 155,
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
            "code": "INJ-08-A1",
            "description": "Agrees who speaks to government, unions and press.",
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
    "next_inject_number": 9,
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
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-03",
      "name": "Critical supplier",
      "type": "supplier",
      "description": "A supplier the business depends on, affected by or involved in the incident.",
      "channel": "phone"
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
      "origin_id": "competent-authority",
      "origin_name": "Competent authority",
      "code": "ACT-05",
      "name": "Competent authority",
      "type": "authority",
      "description": "The cybersecurity authority the organization reports incidents to.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Incident response provider (retainer)",
      "code": "ACT-06",
      "name": "Incident response provider (retainer)",
      "type": "supplier",
      "description": "The external response and forensics team, usually under a retainer activated during the incident: findings, reports and containment advice.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-07",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    }
  ],
  "next_actor_number": 8,
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
      "origin_id": "supply-chain",
      "origin_name": "Supply chain",
      "name": "Supply chain",
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
