---
format: "ttx-zone.scenario"
format_version: 5
language: "en"
title: "Hacktivist DDoS during the sales peak"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Hacktivist DDoS during the sales peak

A hacktivist group announces and then launches a denial-of-service attack on the online shop during its busiest weekend, followed by an extortion demand. The team keeps checkout open, uses its protection provider and talks to customers before rumours do.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Keep checkout open
- **OBJ-02** Use the provider
- **OBJ-03** Tell customers before rumours do

## Scenario

On the eve of the biggest sales weekend of the year, a hacktivist channel lists your brand among its targets. The next morning traffic to the shop explodes.

## Phases and injects

### PH-01 Warning

Thursday, 18:00. Sales start tomorrow at 08:00.

- **INJ-01** (T+5′) A target list with your name

### PH-02 Under fire

Friday, 08:20. Traffic is forty times normal and climbing.

- **INJ-02** (T+45′) Checkout times out
- **INJ-03** (T+65′) Two options, both costly
- **INJ-04** (T+85′) Is customer data safe?
- **INJ-05** (contingent) 'They've been hacked and stolen our cards'

### PH-03 Extortion

Friday, 15:00. The shop is up behind mitigation; complaints keep coming.

- **INJ-06** (T+120′) Pay or it doubles tomorrow

## Simulated actors

- **ACT-01** Hacktivist channel
- **ACT-02** SOC
- **ACT-03** Hosting and DDoS protection provider
- **ACT-04** Media
- **ACT-05** Customer

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Hacktivist DDoS during the sales peak",
    "description": "A hacktivist group announces and then launches a denial-of-service attack on the online shop during its busiest weekend, followed by an extortion demand. The team keeps checkout open, uses its protection provider and talks to customers before rumours do."
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
      "continuity_recovery",
      "third_party_supply_chain",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Security operations",
      "Security operations lead",
      "Incident lead",
      "E-commerce",
      "Head of e-commerce",
      "Communications",
      "Head of communications",
      "Customer service"
    ],
    "third_parties": [],
    "perimeter": "The online shop, its hosting and DDoS protection, communications and customer service.",
    "out_of_scope": "Network engineering of the mitigation and any contact with the attackers.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "BLUE LANTERN",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "DDoS runbook never used",
        "finding": "The DDoS runbook was written at contract signature and has never been activated.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Unclear options with the provider",
        "finding": "Nobody knows which mitigation options the contract includes or what they cost the business.",
        "affected_capability": "third_party_supply_chain",
        "priority": "medium"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "Rumours outran us last time",
        "finding": "During a past outage, social media claimed a data theft hours before any statement.",
        "affected_capability": "internal_external_comms",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Keep checkout open",
        "statement": "Checkout is available again within 60 minutes of the attack starting, with the provider's mitigation active.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "DDoS runbook activated\nProvider mitigation requested\nCheckout available within 60 minutes of scenario time",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Runbook activation and provider ticket, with their times.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Use the provider",
        "statement": "The team reaches the protection provider through the contracted channel, compares the mitigation options with their business impact and decides.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Provider reached through the contracted channel\nOptions compared with their business impact\nDecision and owner recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The provider ticket and the decision log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Tell customers before rumours do",
        "statement": "Within 30 minutes of the first press or social media question, a status message is published and customer service uses the same wording.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Status message published\nNo claim of data theft without evidence\nCustomer service briefed with the same message",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The status message and the customer service briefing.",
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
    "title": "Black weekend",
    "summary": "On the eve of the biggest sales weekend of the year, a hacktivist channel lists your brand among its targets. The next morning traffic to the shop explodes.",
    "attack_version": "19.2",
    "duration_minutes": 160,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Warning",
        "start_offset": 0,
        "end_offset": 40,
        "incident_jump_minutes": 0,
        "situation_update": "Thursday, 18:00. Sales start tomorrow at 08:00.",
        "key_questions": [
          "Who owns the DDoS runbook tonight?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Your brand is on a target list"
      },
      {
        "code": "PH-02",
        "name": "Under fire",
        "start_offset": 40,
        "end_offset": 110,
        "incident_jump_minutes": 840,
        "situation_update": "Friday, 08:20. Traffic is forty times normal and climbing.",
        "key_questions": [
          "Which mitigation costs us least in sales?"
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
            "due": false
          }
        ],
        "headline": "Checkout times out"
      },
      {
        "code": "PH-03",
        "name": "Extortion",
        "start_offset": 110,
        "end_offset": 160,
        "incident_jump_minutes": 300,
        "situation_update": "Friday, 15:00. The shop is up behind mitigation; complaints keep coming.",
        "key_questions": [
          "What do we tell customers and staff now?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Pay or it doubles tomorrow"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Hacktivist collective",
        "mitre_group_id": null,
        "aliases": [],
        "description": "A politically motivated group renting botnet capacity for denial-of-service campaigns.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1583.005"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1498"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1499"
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
        "title": "A target list with your name",
        "content": "Tomorrow we take down the shops that profit while others suffer. Target list attached. Your brand is third.",
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
          "Incident lead"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0042",
            "technique_id": "T1583.005"
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
            "description": "The incident lead confirms who owns the DDoS runbook and the provider contacts for the weekend.",
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
        "artifact": {
          "kind": "social_post",
          "sender": "Hacktivist channel",
          "sender_address": "@op_blackweekend",
          "recipient": "",
          "subject": "",
          "timestamp": "Thursday 17:52",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Checkout times out",
        "content": "Application-layer requests from tens of thousands of addresses hit the search and checkout pages. Checkout times out for most customers.",
        "offset_minutes": 45,
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
          "Security operations"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1499"
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
            "description": "Security operations activates the DDoS runbook and requests the provider's mitigation.",
            "responsible_role": "Security operations lead",
            "expected_within_minutes": 10,
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
        "title": "Two options, both costly",
        "content": "The provider has absorbed the volumetric flood, but the application attack persists. Options: a challenge page for every visitor (roughly a third fewer conversions) or blocking whole regions where some of your customers live.",
        "offset_minutes": 65,
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
          "Head of e-commerce"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1498"
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
            "description": "The head of e-commerce compares the options with the provider and decides, recording the owner.",
            "responsible_role": "Head of e-commerce",
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
        "title": "Is customer data safe?",
        "content": "A consumer affairs journalist asks whether the outage is a cyber attack and whether customer data has been stolen.",
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
          "Head of communications"
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
            "description": "Communications publishes a status message and briefs customer service with the same wording.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 30,
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
        "title": "'They've been hacked and stolen our cards'",
        "content": "Three hours trying to pay. Friend in IT says they've been hacked and our cards are gone. Thanks for nothing.",
        "offset_minutes": null,
        "trigger_condition": "No status message 30 minutes after INJ-04.",
        "contingent_purpose": "Let the rumour fill the silence.",
        "fires_at_minute": 60,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Communications",
          "Customer service"
        ],
        "delivery_method": "media",
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
            "description": "Communications corrects the rumour with confirmed facts only.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Annoyed customer",
          "sender_address": "@shopper_dani",
          "recipient": "",
          "subject": "",
          "timestamp": "Friday 10:41",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Pay or it doubles tomorrow",
        "content": "What you saw today was a test. Pay two bitcoin by midnight or tomorrow's attack will be twice as big. The address is below.",
        "offset_minutes": 120,
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
            "code": "INJ-06-A1",
            "description": "The incident lead records the position on the demand, the protection planned for tomorrow and the report to the police.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Communications updates the status message and the internal note for staff.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Op Black Weekend",
          "sender_address": "opbw@mail.example.net",
          "recipient": "Security team",
          "subject": "Tomorrow will be worse",
          "timestamp": "Friday 14:55",
          "location": ""
        }
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-01",
      "name": "Hacktivist channel",
      "type": "threat_actor",
      "description": "Posts target lists, boasts and the extortion demand.",
      "channel": "document"
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
      "origin_id": "cloud-provider",
      "origin_name": "Cloud provider",
      "code": "ACT-03",
      "name": "Hosting and DDoS protection provider",
      "type": "supplier",
      "description": "Hosts the shop and runs the contracted DDoS mitigation.",
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
      "origin_id": "ddos",
      "origin_name": "DDoS",
      "name": "DDoS",
      "color": "rose",
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
