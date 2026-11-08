---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Stolen SaaS integration tokens"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Stolen SaaS integration tokens

Attackers breach a SaaS vendor and use its stored integration tokens to export customers' CRM data, including support cases where staff pasted passwords and cloud keys. The exercise tests third-party visibility, scoping with limited logs, rotating secrets and the notification decision.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Integration exposure scoped
- **OBJ-02** Breach classified
- **OBJ-03** Notification decided

## Scenario

On a Monday morning the CRM platform used by {organization} revokes every token of a sales chatbot integration and publishes an advisory. The sales team just wants the chatbot back.

## Phases and injects

### PH-01 The vendor's advisory

Monday, 08:30. The CRM platform revokes all tokens of a sales chatbot integration.

- **INJ-01** (T+5′) All tokens of an integration revoked
- **INJ-02** (T+25′) Sales wants the chatbot back

### PH-02 What left

Day 2. Logs show bulk exports three weeks ago.

- **INJ-03** (T+55′) Bulk exports three weeks ago
- **INJ-04** (T+80′) Secrets in support cases, one already used

### PH-03 Customers and regulators

Day 4. Customers start asking.

- **INJ-05** (T+115′) Counsel: is it a personal data breach?
- **INJ-06** (T+140′) A large customer asks

## Simulated actors

- **ACT-01** Cloud provider
- **ACT-02** Employee
- **ACT-03** SOC
- **ACT-04** External legal counsel
- **ACT-05** Customer

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Stolen SaaS integration tokens",
    "description": "Attackers breach a SaaS vendor and use its stored integration tokens to export customers' CRM data, including support cases where staff pasted passwords and cloud keys. The exercise tests third-party visibility, scoping with limited logs, rotating secrets and the notification decision."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "regulatory"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "incident_classification",
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
      "Sales",
      "Data Protection Officer",
      "Legal",
      "Communications",
      "CISO",
      "Security operations lead",
      "IT director",
      "Head of communications"
    ],
    "third_parties": [
      "SaaS vendor",
      "CRM platform"
    ],
    "perimeter": "The CRM, its third-party integrations, the secrets stored in it, and the security, data protection and communications teams.",
    "out_of_scope": "Replacing the CRM platform.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "LOST TOKEN",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Integrations to the CRM not inventoried",
        "finding": "Business teams connect SaaS tools to the CRM with broad grants; security does not know which.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Hard to scope what an integration exported",
        "finding": "SaaS audit logs are short-lived and support cases hold pasted secrets.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Third-party breach notification untested",
        "finding": "The 72-hour clock has never been run for a breach that happened at a supplier.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Integration exposure scoped",
        "statement": "The team finds the integration's owner and what it could access, and keeps it off until scoped.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Owner and access documented\nIntegration kept off",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Integration review.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Breach classified",
        "statement": "The team determines what was exported, which secrets were in it, and rotates them.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Export scope estimated\nSecrets rotated",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Investigation notes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Notification decided",
        "statement": "The team decides whether it is a personal data breach, when the clock started, and what customers are told.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notification decision documented\nCustomer message approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Breach record.",
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
    "title": "The integration nobody owned",
    "summary": "On a Monday morning the CRM platform used by {organization} revokes every token of a sales chatbot integration and publishes an advisory. The sales team just wants the chatbot back.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "The vendor's advisory",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Monday, 08:30. The CRM platform revokes all tokens of a sales chatbot integration.",
        "key_questions": [
          "What could this integration read?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "An integration we didn't know about"
      },
      {
        "code": "PH-02",
        "name": "What left",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Day 2. Logs show bulk exports three weeks ago.",
        "key_questions": [
          "Which secrets do we rotate first?"
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
        "headline": "Bulk exports, and secrets in support cases"
      },
      {
        "code": "PH-03",
        "name": "Customers and regulators",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Day 4. Customers start asking.",
        "key_questions": [
          "When did our 72 hours start?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Customers start asking"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Data theft group",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Unidentified group that breached a SaaS vendor and used its integration tokens against customers' CRMs.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1528"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1550.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
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
        "title": "All tokens of an integration revoked",
        "content": "The CRM platform: following a breach at a third-party vendor, all tokens of its chatbot integration have been revoked. Customers should review the integration's API activity over the last 90 days and rotate any credentials stored in the CRM.",
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
          "CISO",
          "IT"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1528"
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
            "description": "Finds who owns the integration and what it could access.",
            "responsible_role": "CISO",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Sales wants the chatbot back",
        "content": "The head of sales writes: the chatbot stopped this morning, leads are being lost, and he asks IT to 'just reconnect it' today.",
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
          "CISO",
          "Sales"
        ],
        "delivery_method": "chat",
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
            "description": "Keeps the integration off until it is scoped, and explains why.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
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
        "title": "Bulk exports three weeks ago",
        "content": "The SOC: the integration's identity ran bulk queries three weeks ago, exporting accounts, contacts and support cases. Audit logs are kept for 30 days, so earlier activity is unknown.",
        "offset_minutes": 55,
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
          "Security operations",
          "Data Protection Officer"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1550.001"
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
            "description": "Estimates what was exported and since when.",
            "responsible_role": "Security operations lead",
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
        "title": "Secrets in support cases, one already used",
        "content": "A search of the exported support cases finds passwords and cloud access keys pasted by staff and customers. One of the keys was used yesterday from 198.51.100.77.",
        "offset_minutes": 80,
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
          "Security operations",
          "IT"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Rotates every secret found in the support cases, the used key first.",
            "responsible_role": "IT director",
            "expected_within_minutes": 30,
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
        "title": "Counsel: is it a personal data breach?",
        "content": "Outside counsel: the export includes contact data of about 40,000 customers. They ask when {organization} became aware, and whether the 72 hours have already started.",
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
          "Data Protection Officer",
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
            "description": "Decides whether to notify the data protection authority and records when the clock started.",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "A large customer asks",
        "content": "A large customer has read about the vendor's breach and asks whether its data and its support cases were in your CRM export.",
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
          "Head of communications",
          "Data Protection Officer"
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
            "code": "INJ-06-A1",
            "description": "Agrees and sends the message to affected customers.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 20,
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
    "next_inject_number": 7,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "cloud-provider",
      "origin_name": "Cloud provider",
      "code": "ACT-01",
      "name": "Cloud provider",
      "type": "supplier",
      "description": "The cloud platform the affected services run on.",
      "channel": "email"
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
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-03",
      "name": "SOC",
      "type": "soc",
      "description": "The security operations centre: alerts, findings and requests for decisions.",
      "channel": "ticket"
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
