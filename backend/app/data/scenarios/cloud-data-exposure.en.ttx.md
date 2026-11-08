---
format: "ttx-zone.scenario"
format_version: 5
language: "en"
title: "Customer data in an open storage bucket"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Customer data in an open storage bucket

A security researcher reports that a cloud storage bucket with customer exports has been publicly readable for weeks. The team closes it, works out what was exposed and decides on notifying the authority and the customers.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Decide on the 72-hour notification
- **OBJ-02** Close and scope the exposure
- **OBJ-03** One message, consistent with the facts

## Scenario

A message from an independent researcher says a storage bucket named exports-prod lists customer files to anyone on the internet. It came from the security contact on the website.

## Phases and injects

### PH-01 The report

Tuesday, 11:00. The security mailbox has a message from a researcher.

- **INJ-01** (T+5′) A bucket anyone can read
- **INJ-02** (T+25′) Open for 47 days

### PH-02 Was it downloaded?

Tuesday, 15:00. The logs are in; the data protection officer has joined.

- **INJ-03** (T+60′) Fourteen downloads
- **INJ-04** (T+80′) Tell 3.2 million customers?
- **INJ-05** (contingent) The researcher posts a teaser

### PH-03 Going public

Wednesday, 11:00. Twenty-four hours since the report.

- **INJ-06** (T+120′) A journalist has a sample

## Simulated actors

- **ACT-01** Security researcher
- **ACT-02** Cloud security team
- **ACT-03** External legal counsel
- **ACT-04** Media
- **ACT-05** Data protection authority

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Customer data in an open storage bucket",
    "description": "A security researcher reports that a cloud storage bucket with customer exports has been publicly readable for weeks. The team closes it, works out what was exposed and decides on notifying the authority and the customers."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "org_or_tech_change"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "regulatory_notification",
      "incident_classification",
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
      "Cloud platform team",
      "Data protection officer",
      "Legal",
      "Communications",
      "Head of communications"
    ],
    "third_parties": [],
    "perimeter": "Cloud storage, the data protection process and external communication.",
    "out_of_scope": "Cloud architecture redesign and any reply to the researcher on bug bounties.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "WHITE PINE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Breach assessment never rehearsed",
        "finding": "The data protection officer has never led a breach assessment against the 72-hour clock.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "recent_changes",
        "title": "Migration left loose ends",
        "finding": "The move to the new cloud platform changed storage permissions without a review.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "Figures changed after publication",
        "finding": "In a past incident the number of affected customers was published and then corrected twice.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decide on the 72-hour notification",
        "statement": "Once exposure is confirmed, the data protection officer leads a documented risk assessment and the team decides, with reasons, on notifying the authority within 72 hours and on informing customers.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Data protection officer involved\nRisk to the people affected assessed and recorded\nDecision on notifying the authority recorded with its reasons\nDecision on informing customers recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The breach assessment, the register entry and the draft notification.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Close and scope the exposure",
        "statement": "Within an hour of the report, public access is removed and the team establishes what was exposed, since when, and what the logs show of access.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Public access removed\nPeriod and records exposed established\nSeverity assigned with its criteria",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The change record and the scoping notes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "One message, consistent with the facts",
        "statement": "Before any figure is made public, communications drafts a holding statement reviewed by Legal and the data protection officer.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Holding statement drafted\nReviewed by Legal and the data protection officer\nNo figure the team hasn't confirmed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The statement and its review trail.",
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
    "title": "exports-prod",
    "summary": "A message from an independent researcher says a storage bucket named exports-prod lists customer files to anyone on the internet. It came from the security contact on the website.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "The report",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Tuesday, 11:00. The security mailbox has a message from a researcher.",
        "key_questions": [
          "Who can close it now, and what do we keep before closing?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "A researcher found our bucket"
      },
      {
        "code": "PH-02",
        "name": "Was it downloaded?",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 240,
        "situation_update": "Tuesday, 15:00. The logs are in; the data protection officer has joined.",
        "key_questions": [
          "Does the 72-hour clock run, and from when?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Fourteen downloads we can't explain"
      },
      {
        "code": "PH-03",
        "name": "Going public",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1200,
        "situation_update": "Wednesday, 11:00. Twenty-four hours since the report.",
        "key_questions": [
          "What can we say that won't change tomorrow?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "A journalist has a sample"
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
        "title": "A bucket anyone can read",
        "content": "While scanning for misconfigured storage I found a bucket named exports-prod that lists CSV files with customer names, email and postal addresses. I have not shared it. I plan to publish a write-up in seven days.",
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
          "Security operations",
          "Incident lead"
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
            "code": "INJ-01-A1",
            "description": "The incident lead opens an incident and has public access removed after the configuration and logs are kept.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Independent researcher",
          "sender_address": "disclosure@researcher.example.org",
          "recipient": "Security contact",
          "subject": "Publicly listable bucket with customer data",
          "timestamp": "Tuesday 10:52",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Open for 47 days",
        "content": "The bucket became public during the migration 47 days ago. It holds 3.2 million rows of customer exports. Access logs are only kept for 30 days.",
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
          "Cloud platform team"
        ],
        "delivery_method": "briefing",
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
            "description": "Security operations states what was exposed, since when and what the logs can and cannot show, and the severity is assigned.",
            "responsible_role": "Security operations lead",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Fourteen downloads",
        "content": "Within the 30 days of logs, the full set of files was downloaded fourteen times from addresses that are not the company's nor the researcher's.",
        "offset_minutes": 60,
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
          "Data protection officer"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "The data protection officer assesses the risk to the people affected and records it.",
            "responsible_role": "Data protection officer",
            "expected_within_minutes": 20,
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Tell 3.2 million customers?",
        "content": "External counsel asks for a decision today: notify the authority, inform every customer, or both, and lays out the cost of a mailing and a dedicated call centre.",
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
          "Data protection officer",
          "Legal"
        ],
        "delivery_method": "email",
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
            "description": "The data protection officer and Legal record the decisions on notifying the authority and informing customers, with reasons.",
            "responsible_role": "Data protection officer",
            "expected_within_minutes": 20,
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The researcher posts a teaser",
        "content": "Big retailer, millions of customer records, wide open for weeks. Responsible disclosure in progress; write-up next week.",
        "offset_minutes": null,
        "trigger_condition": "No risk assessment 20 minutes after INJ-03.",
        "contingent_purpose": "Add outside pressure to decide.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Incident lead",
          "Communications"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "The incident lead makes sure the risk assessment and notification decision are done today.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 10,
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
          "sender": "Independent researcher",
          "sender_address": "@open_buckets",
          "recipient": "",
          "subject": "",
          "timestamp": "Tuesday 16:20",
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
        "title": "A journalist has a sample",
        "content": "A reporter has fifty rows of the files, has called two of the customers listed and will publish this afternoon.",
        "offset_minutes": 120,
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
            "code": "INJ-06-A1",
            "description": "Communications drafts a holding statement reviewed by Legal and the data protection officer.",
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
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 1
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "security-researcher",
      "origin_name": "Security researcher",
      "code": "ACT-01",
      "name": "Security researcher",
      "type": "other",
      "description": "An external researcher reporting a vulnerability or exposure, sometimes asking for a reward.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "Cloud security team",
      "type": "soc",
      "description": "Looks at the bucket's configuration and access logs.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "External legal counsel",
      "code": "ACT-03",
      "name": "External legal counsel",
      "type": "other",
      "description": "Outside lawyers advising on notifications, liability and communications.",
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
      "origin_id": "data-breach",
      "origin_name": "Data breach",
      "name": "Data breach",
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
  "next_room_number": 1,
  "files": []
}
```
