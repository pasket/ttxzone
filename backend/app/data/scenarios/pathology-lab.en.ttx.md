---
format: "ttx-zone.scenario"
format_version: 3
language: "en"
title: "Ransomware at the shared pathology laboratory"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware at the shared pathology laboratory

The private company that runs the laboratory for {organization} and other hospitals is hit by ransomware. The hospitals are not compromised, yet they lose a service they cannot work without: no test results, no cross-matching for transfusions. Weeks later patient data is published. The exercise tests clinical continuity, coordination across hospitals and patient notification.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Critical care kept
- **OBJ-02** One coordinated response
- **OBJ-03** Patients informed

## Scenario

Monday, 10:00. The laboratory provider stops returning results to {organization}'s records. Emergency, surgery and oncology depend on them.

## Phases and injects

### PH-01 No results

Monday, 10:00. The laboratory provider's systems are down.

- **INJ-01** (T+5′) The laboratory cannot return results
- **INJ-02** (T+25′) Surgeons ask whether to operate
- **INJ-03** (T+40′) The health authority calls for one coordination

### PH-02 Blood and backlog

Wednesday. No cross-matching; thousands of appointments to postpone.

- **INJ-04** (T+55′) Only universal donor blood
- **INJ-05** (T+85′) Another laboratory offers capacity

### PH-03 Data published

Two weeks later. The provider refused to pay; patient data is published.

- **INJ-06** (T+115′) Patient data on the leak site
- **INJ-07** (T+140′) Did the delays harm patients?

## Simulated actors

- **ACT-01** Critical supplier
- **ACT-02** Employee
- **ACT-03** Competent authority
- **ACT-04** Threat intelligence provider
- **ACT-05** Media

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ransomware at the shared pathology laboratory",
    "description": "The private company that runs the laboratory for {organization} and other hospitals is hit by ransomware. The hospitals are not compromised, yet they lose a service they cannot work without: no test results, no cross-matching for transfusions. Weeks later patient data is published. The exercise tests clinical continuity, coordination across hospitals and patient notification."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
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
      "Crisis committee",
      "Medical director",
      "Emergency department",
      "Laboratory services",
      "Communications",
      "Data Protection Officer",
      "Legal",
      "Chief Executive Officer",
      "Head of communications",
      "Laboratory services manager"
    ],
    "third_parties": [
      "Laboratory provider",
      "Blood service"
    ],
    "perimeter": "Clinical services that depend on the laboratory, coordination with other hospitals and practices, and patient communication.",
    "out_of_scope": "The laboratory provider's own recovery.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "WHITE COAT",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "No fallback for an outsourced laboratory",
        "finding": "The hospital has no in-house laboratory capacity left.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Coordination across hospitals untested",
        "finding": "Hospitals, practices and the blood service have never handled a shared outage together.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Patient notification for a supplier breach untested",
        "finding": "Nobody has agreed who tells patients when a processor's breach exposes their data.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Critical care kept",
        "statement": "Emergency and cancer care continue with phone and paper results; non-urgent work is postponed with clear criteria; alternative laboratories are brought in.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Critical incident declared\nPostponement criteria agreed\nAlternative laboratory engaged",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Clinical decision log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "One coordinated response",
        "statement": "Hospitals, practices and the blood service act through one coordination cell and speak with one voice.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Coordination cell set up\nSingle spokesperson agreed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Coordination minutes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Patients informed",
        "statement": "When the data is published, the hospital decides its notification and how patients are told and supported.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notification decided\nPatient helpline set up",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Breach record and the patient notice.",
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
    "title": "No results",
    "summary": "Monday, 10:00. The laboratory provider stops returning results to {organization}'s records. Emergency, surgery and oncology depend on them.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "No results",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Monday, 10:00. The laboratory provider's systems are down.",
        "key_questions": [
          "Which care goes ahead without results?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "The laboratory goes silent"
      },
      {
        "code": "PH-02",
        "name": "Blood and backlog",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 2880,
        "situation_update": "Wednesday. No cross-matching; thousands of appointments to postpone.",
        "key_questions": [
          "Who coordinates, and who speaks?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Universal donor blood only"
      },
      {
        "code": "PH-03",
        "name": "Data published",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 20160,
        "situation_update": "Two weeks later. The provider refused to pay; patient data is published.",
        "key_questions": [
          "How do we tell patients, and what support do we offer?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Patient data is online"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Ransomware group",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Unidentified ransomware group that encrypted and stole data from the laboratory provider.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
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
        "title": "The laboratory cannot return results",
        "content": "The laboratory provider: a ransomware attack has encrypted its laboratory systems. It cannot receive orders or return results, and has no estimate for recovery.",
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
          "Medical director",
          "Crisis committee"
        ],
        "delivery_method": "phone",
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
            "description": "Declares a critical incident and moves urgent tests to phone and paper.",
            "responsible_role": "Medical director",
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
        "title": "Surgeons ask whether to operate",
        "content": "The emergency department has patients waiting for results, and the surgical lead asks whether this afternoon's operations go ahead without blood tests.",
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
          "Medical director",
          "Emergency department"
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
            "code": "INJ-02-A1",
            "description": "Decides which surgery and procedures go ahead.",
            "responsible_role": "Medical director",
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
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The health authority calls for one coordination",
        "content": "The regional health authority: every hospital and practice using the provider is affected. It proposes a single coordination cell with the blood service.",
        "offset_minutes": 40,
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
          "Crisis committee",
          "Chief Executive Officer"
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
            "code": "INJ-03-A1",
            "description": "Joins a single coordination cell with the other hospitals, practices and the blood service.",
            "responsible_role": "Chief Executive Officer",
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
        "title": "Only universal donor blood",
        "content": "The transfusion lead: without cross-matching, only universal donor blood can be used and stocks will last two days. The blood service wants to launch a public appeal for donors.",
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
          "Medical director",
          "Head of communications"
        ],
        "delivery_method": "document",
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
            "code": "INJ-04-A1",
            "description": "Restricts transfusions to essential cases.",
            "responsible_role": "Medical director",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Agrees the donor appeal and one spokesperson for all hospitals.",
            "responsible_role": "Head of communications",
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Another laboratory offers capacity",
        "content": "Laboratory services: 3,000 outpatient appointments and 800 operations must be postponed this week. Another laboratory offers part of its capacity, but without any integration with your records.",
        "offset_minutes": 85,
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
          "Laboratory services",
          "Medical director"
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
            "code": "INJ-05-A1",
            "description": "Agrees with the alternative laboratory how samples and results move.",
            "responsible_role": "Laboratory services manager",
            "expected_within_minutes": 30,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Patient data on the leak site",
        "content": "The threat intelligence provider: after the provider refused to pay, the group published about 400 GB of patient names, test results and identifiers, including your patients.",
        "offset_minutes": 115,
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
          "Data Protection Officer",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decides the notification and how patients are told and supported.",
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Did the delays harm patients?",
        "content": "A health journalist asks whether any patient has been harmed by the delays and why hospitals depend on a single private provider.",
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
          "Medical director"
        ],
        "delivery_method": "phone",
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
            "description": "Approves a joint statement with the other hospitals.",
            "responsible_role": "Head of communications",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Opens a helpline for worried patients.",
            "responsible_role": "Data Protection Officer",
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
      "origin_id": "competent-authority",
      "origin_name": "Competent authority",
      "code": "ACT-03",
      "name": "Competent authority",
      "type": "authority",
      "description": "The cybersecurity authority the organization reports incidents to.",
      "channel": "email"
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
