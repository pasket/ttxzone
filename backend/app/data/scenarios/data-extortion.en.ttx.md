---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Data extortion after a file-transfer zero-day"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Data extortion after a file-transfer zero-day

An extortion group exploits a zero-day in the managed file-transfer platform {organization} uses with its partners and quietly copies files. Weeks later executives receive an extortion email with a list of stolen files. No system is encrypted: the crisis is about scope, notification duties and whether to pay to stay off the leak site.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Exposure assessed fast
- **OBJ-02** Notification clock managed
- **OBJ-03** Extortion decision taken

## Scenario

The vendor of the file-transfer platform publishes an emergency advisory: a vulnerability is being exploited worldwide. {organization} patches, but logs on the server only go back seven days. Three weeks later the extortion email arrives.

## Phases and injects

### PH-01 Advisory day

Tuesday, 09:00. The file-transfer vendor publishes an emergency advisory.

- **INJ-01** (T+5′) Emergency advisory from the vendor
- **INJ-02** (T+25′) A web shell, and only seven days of logs

### PH-02 The extortion email

Three weeks later. Executives receive an email listing files taken from the platform.

- **INJ-03** (T+55′) 'We have your files'
- **INJ-04** (T+80′) A partner's data was in the files
- **INJ-05** (T+95′) The data protection authority asks

### PH-03 The deadline

Five days later. The leak site lists {organization} among the campaign's victims.

- **INJ-06** (T+115′) A journalist sees our name on the list
- **INJ-07** (T+140′) An offer to remove the name

## Simulated actors

- **ACT-01** Critical supplier
- **ACT-02** SOC
- **ACT-03** Attacker (sender)
- **ACT-04** Customer
- **ACT-05** Data protection authority
- **ACT-06** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Data extortion after a file-transfer zero-day",
    "description": "An extortion group exploits a zero-day in the managed file-transfer platform {organization} uses with its partners and quietly copies files. Weeks later executives receive an extortion email with a list of stolen files. No system is encrypted: the crisis is about scope, notification duties and whether to pay to stay off the leak site."
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
      "crisis_decision_making",
      "detection_triage_escalation",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Crisis committee",
      "Security operations",
      "IT",
      "Legal",
      "Data protection",
      "Communications",
      "IT director",
      "Data Protection Officer",
      "Security operations lead",
      "Crisis committee chair",
      "Head of communications"
    ],
    "third_parties": [
      "File-transfer vendor",
      "Logistics partners"
    ],
    "perimeter": "The file-transfer platform, the data exchanged with partners, the crisis committee and the legal, data protection and communications teams.",
    "out_of_scope": "Negotiation with the attackers.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "QUIET LEDGER",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Internet-facing platform outside patching and monitoring",
        "finding": "The file-transfer server is run by the business, not IT; its logs are not collected centrally.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "No clear start for the 72-hour clock",
        "finding": "Nobody has agreed when a suspected breach becomes 'known' for notification purposes.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "No position on paying to avoid publication",
        "finding": "Management has never discussed extortion without encryption.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Exposure assessed fast",
        "statement": "On the vendor's advisory, the team decides within 60 minutes whether to take the platform offline and starts a compromise assessment.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Offline decision logged\nCompromise assessment started",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Decision log and the assessment record.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Notification clock managed",
        "statement": "The team determines when the breach became known, which authorities, partners and data subjects must be told, and documents the decision.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Awareness time recorded\nNotification decision documented",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Breach record and notification drafts.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Extortion decision taken",
        "statement": "The committee decides on the demand with legal and insurer input, and agrees a communication line.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decision and rationale recorded\nStatement approved",
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
    "title": "The files we shared",
    "summary": "The vendor of the file-transfer platform publishes an emergency advisory: a vulnerability is being exploited worldwide. {organization} patches, but logs on the server only go back seven days. Three weeks later the extortion email arrives.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Advisory day",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Tuesday, 09:00. The file-transfer vendor publishes an emergency advisory.",
        "key_questions": [
          "Do we stop exchanging files with our partners?"
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
        "headline": "A zero-day in our file-transfer platform"
      },
      {
        "code": "PH-02",
        "name": "The extortion email",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 30240,
        "situation_update": "Three weeks later. Executives receive an email listing files taken from the platform.",
        "key_questions": [
          "When did the notification clock start?"
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
        "headline": "Three weeks later: 'we have your files'"
      },
      {
        "code": "PH-03",
        "name": "The deadline",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 7200,
        "situation_update": "Five days later. The leak site lists {organization} among the campaign's victims.",
        "key_questions": [
          "Pay to be removed, or accept publication?"
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
        "headline": "Our name is on the leak site"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0092",
        "origin_name": "TA505",
        "code": "THR-01",
        "name": "TA505",
        "mitre_group_id": "G0092",
        "aliases": [],
        "description": "Financially motivated group running mass-exploitation campaigns against file-transfer products, followed by extortion by email.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1190"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
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
        "title": "Emergency advisory from the vendor",
        "content": "The vendor of {product}: a critical vulnerability is being actively exploited worldwide. Apply the emergency patch, or disable internet access to the platform, and check for unknown accounts and web shells.",
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
          "IT",
          "Security operations"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1190"
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
            "description": "Locates every exposed instance and decides whether to take it offline.",
            "responsible_role": "IT director",
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
        "title": "A web shell, and only seven days of logs",
        "content": "The SOC finds a web shell and an administrator account nobody created on the file-transfer server. The server keeps logs for seven days; earlier activity cannot be reconstructed.",
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
          "Data Protection Officer"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1505.003"
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
            "description": "Starts a compromise assessment and preserves the server.",
            "responsible_role": "Security operations lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Opens a breach record and starts the notification assessment.",
            "responsible_role": "Data Protection Officer",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "'We have your files'",
        "content": "Executives receive the same email: the group has 'downloaded your files from your file-transfer server', attaches a list of 1,800 file names, and gives a link to a negotiation portal. If nobody makes contact within 7 days, the files will be published.",
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
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Checks the list against the files that were on the server.",
            "responsible_role": "Security operations lead",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Convenes the crisis committee and involves legal counsel and the insurer.",
            "responsible_role": "Crisis committee chair",
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
        "title": "A partner's data was in the files",
        "content": "A logistics partner has read about the campaign: its shipment manifests with customer names and addresses went through your platform. It asks whether they were taken and what you will tell the people affected.",
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
          "Data Protection Officer",
          "Legal"
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
            "description": "Decides who must be told (authority, partners, data subjects) and drafts the notices.",
            "responsible_role": "Data Protection Officer",
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
        "origin_id": "INJ-REG-04",
        "origin_name": "The data protection authority asks",
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The data protection authority asks",
        "content": "The data protection authority has seen {organization} named in reports about the campaign and asks whether a personal data breach occurred and why it has not been notified.",
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
          "Data Protection Officer",
          "Legal"
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
            "code": "INJ-05-A1",
            "description": "Answers with the notification and the timeline of when the breach became known.",
            "responsible_role": "Data Protection Officer",
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
        "title": "A journalist sees our name on the list",
        "content": "A journalist covering the campaign calls: {organization} appears on the leak site's victim list. Did you pay? Is customer data involved?",
        "offset_minutes": 115,
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
            "description": "Approves the public statement.",
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
        "title": "An offer to remove the name",
        "content": "A second email: for a payment in cryptocurrency the group will remove {organization} from the list and 'delete' the files. The offer expires in 48 hours.",
        "offset_minutes": 140,
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
            "code": "INJ-07-A1",
            "description": "Decides on the demand and records the rationale.",
            "responsible_role": "Crisis committee",
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
    "next_inject_number": 8,
    "next_threat_actor_number": 2
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
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-03",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
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
      "origin_id": "data-protection-authority",
      "origin_name": "Data protection authority",
      "code": "ACT-05",
      "name": "Data protection authority",
      "type": "authority",
      "description": "The supervisory authority for personal data breaches.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-06",
      "name": "Media",
      "type": "media",
      "description": "Journalists asking questions or publishing about the incident.",
      "channel": "media"
    }
  ],
  "next_actor_number": 7,
  "tags": [
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
