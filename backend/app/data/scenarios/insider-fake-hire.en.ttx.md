---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "The remote developer who wasn't"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# The remote developer who wasn't

A remote contractor hired through an agency turns out to be a stand-in for a state-backed scheme. Odd signals pile up, the contract is ended, and days later an anonymous email demands payment to keep stolen source code private. Security, HR and legal must act together, lawfully, and decide on extortion that may involve a sanctioned party.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Anomalies acted on
- **OBJ-02** Lawful, coordinated response
- **OBJ-03** Extortion and sanctions decision

## Scenario

Seven months into a remote contract, a developer of {organization} does good work but rarely turns on the camera. Then the SOC notices a remote-access tool on his laptop.

## Phases and injects

### PH-01 Odd signals

Month seven of a remote contract. Small anomalies pile up.

- **INJ-01** (T+5′) A remote-access tool on a contractor's laptop
- **INJ-02** (T+25′) Payroll notices a new bank account

### PH-02 After the termination

Two days later. The contract has been ended; the investigation starts.

- **INJ-03** (T+55′) Repositories cloned and keys downloaded
- **INJ-04** (T+85′) The profile matches a sanctioned scheme

### PH-03 The demand

A week later. An anonymous email attaches samples of the source code.

- **INJ-05** (T+115′) Pay or the code goes public
- **INJ-06** (T+140′) A customer asks whether its code was exposed

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Employee
- **ACT-03** Incident response provider (retainer)
- **ACT-04** Threat intelligence provider
- **ACT-05** Attacker (sender)
- **ACT-06** Customer

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "The remote developer who wasn't",
    "description": "A remote contractor hired through an agency turns out to be a stand-in for a state-backed scheme. Odd signals pile up, the contract is ended, and days later an anonymous email demands payment to keep stolen source code private. Security, HR and legal must act together, lawfully, and decide on extortion that may involve a sanctioned party."
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
      "crisis_decision_making",
      "detection_triage_escalation",
      "legal_forensics"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Security operations",
      "Human Resources",
      "Legal",
      "IT",
      "Communications",
      "CISO",
      "Security operations lead",
      "Head of HR",
      "IT director",
      "Head of communications"
    ],
    "third_parties": [
      "Staffing agency"
    ],
    "perimeter": "Remote contractors, source code and cloud environments, and the security, HR, legal and crisis teams.",
    "out_of_scope": "Changes to the hiring process.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "EMPTY DESK",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Laptop anomalies not correlated with HR data",
        "finding": "Security sees device signals and HR sees payroll changes; nobody puts them together.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "No joint procedure for insider cases",
        "finding": "HR, legal and security have never agreed who leads an insider investigation or what monitoring is lawful.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "No position on extortion and sanctions",
        "finding": "Paying, or having paid, a sanctioned party has never been discussed.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Anomalies acted on",
        "statement": "Security, HR and IT bring the signals together and agree a response before the contractor is alerted.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Signals shared between teams\nResponse agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Case record.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Lawful, coordinated response",
        "statement": "HR, legal and security agree who leads, what monitoring is lawful, and how access is cut and evidence kept.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Lead named\nAccess cut and secrets rotated\nEvidence preserved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Investigation log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Extortion and sanctions decision",
        "statement": "The committee decides on the demand, police and sanctions reporting, and what customers are told.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decision and rationale recorded\nCustomer message agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Committee minutes.",
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
    "title": "A good developer, a strange laptop",
    "summary": "Seven months into a remote contract, a developer of {organization} does good work but rarely turns on the camera. Then the SOC notices a remote-access tool on his laptop.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Odd signals",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Month seven of a remote contract. Small anomalies pile up.",
        "key_questions": [
          "Confront, watch quietly, or cut access now?"
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
        "headline": "Small anomalies around a remote contractor"
      },
      {
        "code": "PH-02",
        "name": "After the termination",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 2880,
        "situation_update": "Two days later. The contract has been ended; the investigation starts.",
        "key_questions": [
          "How far back do we look, and what do we rotate?"
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
        "headline": "What did he take before leaving?"
      },
      {
        "code": "PH-03",
        "name": "The demand",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 7200,
        "situation_update": "A week later. An anonymous email attaches samples of the source code.",
        "key_questions": [
          "Is paying even legal?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Pay, or the code goes public"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "State-backed IT worker scheme",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Workers placed under false identities by a sanctioned state to earn revenue and, when useful, steal data.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1585.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
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
        "title": "A remote-access tool on a contractor's laptop",
        "content": "The SOC flags the laptop of a remote developer: a commercial VPN and a remote-access tool not on the approved list, and sign-ins from two regions six hours apart within the same hour.",
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
          "CISO"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1219"
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
            "description": "Escalates to the CISO and opens a confidential case.",
            "responsible_role": "Security operations lead",
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
        "title": "Payroll notices a new bank account",
        "content": "Payroll mentions in passing that the same contractor changed his bank account to an online payment platform, and the agency could not reach him by phone last week.",
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
          "Human Resources",
          "Security operations"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "HR shares it with security and they agree not to alert the contractor yet.",
            "responsible_role": "Head of HR",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Legal confirms what monitoring is lawful and who leads.",
            "responsible_role": "Legal",
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
        "title": "Repositories cloned and keys downloaded",
        "content": "The incident response provider: in the three weeks before the termination, the account cloned 40 repositories in bulk and downloaded cloud access keys from the shared vault.",
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
          "CISO",
          "IT",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213.003"
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
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Rotates every secret and key the account could reach.",
            "responsible_role": "IT director",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Preserves the laptop and the logs as evidence.",
            "responsible_role": "Legal",
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
        "title": "The profile matches a sanctioned scheme",
        "content": "The threat intelligence provider: the profile, the laptop set-up and the payment platform match a known scheme of state-backed IT workers. Months of payments may have reached a sanctioned entity.",
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
          "Legal",
          "Crisis committee"
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
            "code": "INJ-04-A1",
            "description": "Assesses the sanctions exposure and whether to report it.",
            "responsible_role": "Legal",
            "expected_within_minutes": 30,
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
        "title": "Pay or the code goes public",
        "content": "An anonymous email to the CTO attaches three files of your source code and asks for a payment in cryptocurrency within five days; otherwise the repositories will be published.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
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
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Decides on the demand and reports to the police.",
            "responsible_role": "Crisis committee",
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
        "title": "A customer asks whether its code was exposed",
        "content": "A customer whose integration the contractor worked on has heard rumours and asks whether its code or data was accessible.",
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
          "Head of communications",
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
            "code": "INJ-06-A1",
            "description": "Agrees what to tell affected customers.",
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
      "origin_id": "threat-intel-provider",
      "origin_name": "Threat intelligence provider",
      "code": "ACT-04",
      "name": "Threat intelligence provider",
      "type": "supplier",
      "description": "Monitors forums, leak sites and social media: reports exposed data and attacker activity.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-05",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Customer",
      "code": "ACT-06",
      "name": "Customer",
      "type": "customer",
      "description": "A customer noticing the impact and asking for explanations.",
      "channel": "email"
    }
  ],
  "next_actor_number": 7,
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
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
