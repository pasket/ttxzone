---
format: "ttx-zone.scenario"
format_version: 8
language: "en"
title: "Ransomware at a hospital group"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware at a hospital group

An executive crisis simulation for a private hospital group. Ransomware reaches corporate systems and threatens the clinical environment. In three crisis meetings the committee decides whether to cut clinical networks off, how to deal with extortion and leaked patient data, and in which order to recover care.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Decide on isolation with clinical input
- **OBJ-02** Govern the response to extortion
- **OBJ-03** Own every notification
- **OBJ-04** Recover care, not servers
- **OBJ-05** Tell patients and staff the truth first

## Scenario

{organization} runs {hospital_1}, {hospital_2} and a network of laboratories and outpatient clinics. Clinical teams rely on {ehr_system}, laboratory and imaging platforms, and connected medical devices that share interfaces with corporate IT.

## Phases and injects

### PH-01 Isolate or not

Day 1, 10:40. Staff in the head office can't open their files.

- **INJ-01** (T+5′) Encryption in HR and staff folders
- **INJ-02** (T+15′) Clinical teams are losing visibility
- **INJ-03** (T+26′) The CISO recommends isolating
- **POL-04** (T+36′) Clinical networks
  - Do you cut the clinical networks off from corporate IT?
    - Isolate everything now and go to manual procedures
      - The attacker is shut out. Diagnostics slow at once, staff are thrown onto paper without notice, and clinicians feel the decision was taken without them.
    - Isolate in stages, starting with what clinicians say can wait
      - Clinicians shape the order and care stays safer. It takes hours you may not have, and each stage leaves a door open.
    - Keep connected under close watch until there is proof of an attack on clinical systems
      - Care isn't disturbed today. If the attacker reaches the clinical side, the failure will be far worse and the decision will be yours.
    - Isolate only the two hospitals and leave laboratories and clinics connected
      - It protects the highest-risk services. Laboratories and clinics feed the same records, so the exposure is reduced rather than closed.
- **DSC-05** (T+45′) First crisis meeting

### PH-02 Extortion and exposure

Day 2, before dawn. The hospitals are working in segmented mode.

- **INJ-06** (T+60′) The ransom note
- **INJ-07** (T+68′) A journalist asks about patients
- **INJ-08** (T+76′) Payroll, privacy and the duty to tell
- **INJ-09** (contingent) The health authority calls
- **INJ-10** (T+84′) Working in segmented mode
- **POL-11** (T+92′) The demand
  - The actor has 72 hours on the clock. What is your position?
    - No contact and no payment, and prepare for publication
      - A clear position that staff and regulators understand. Patient data will probably be published, and you need to be ready for that day.
    - Allow specialists to open a channel to learn what was taken, with no commitment to pay
      - You learn what is really at risk and gain time for patients. Handled badly, it looks like negotiating over patient records.
    - Consider payment if care can't be restored any other way
      - Care comes first and people will understand the motive. Nothing guarantees a working key or deleted data, and legal limits may apply.
    - Leave the decision to the insurer and the police
      - They will advise, but they won't decide for you. Time passes, and the committee still owns the outcome.
- **DSC-12** (T+102′) Second crisis meeting

### PH-03 Recovering care

Day 6. Containment is complete and hospitals still work on paper. The leading principle: recover the clinical service, not merely the server.

- **INJ-13** (T+120′) The story is in the national press
- **INJ-14** (T+130′) Recovery planning
- **POL-15** (T+142′) What comes back first
  - IT can start on only one restoration stream today. Which one?
    - Emergency and intensive care systems
      - The most fragile patients benefit first. Those services depend on laboratory and imaging, so the gain may be smaller than expected.
    - Laboratory, imaging and pharmacy
      - Diagnosis and medication return for every ward, and that removes the riskiest manual steps. Emergency systems wait a little longer.
    - Payroll and staff scheduling
      - Staff are paid and shifts covered, which keeps people at work. Clinical teams may see it as putting administration before patients.
    - Scheduled surgery, patient portal and billing
      - Income and access return, and pressure from waiting lists eases. It is the hardest choice to defend while clinical teams are on paper.
- **DSC-16** (T+155′) Third crisis meeting

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Attacker (sender)
- **ACT-03** Media
- **ACT-04** Employee
- **ACT-05** Cyber insurer
- **ACT-06** Health authority
- **ACT-07** Clinical operations team

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "en",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Ransomware at a hospital group",
    "description": "An executive crisis simulation for a private hospital group. Ransomware reaches corporate systems and threatens the clinical environment. In three crisis meetings the committee decides whether to cut clinical networks off, how to deal with extortion and leaked patient data, and in which order to recover care."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "continuity_recovery",
      "internal_external_comms"
    ],
    "levels": [
      "strategic"
    ],
    "participating_areas": [
      "CEO",
      "Chief medical officer",
      "Chief nursing officer",
      "Chief operating officer",
      "CISO",
      "CIO",
      "Legal",
      "Data protection officer",
      "Communications",
      "Human resources",
      "Executive crisis committee"
    ],
    "third_parties": [],
    "perimeter": "Executive decisions on clinical continuity, extortion, notification, communication and recovery priorities.",
    "out_of_scope": "Clinical protocols, technical forensic work and any real contact with authorities or patients.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "WHITE COAT",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Disconnection has no clinical owner",
        "finding": "The committee has never decided who authorises cutting clinical networks off, or what clinical information they need first.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Notifications go through different doors",
        "finding": "Privacy, health authority and incident reporting duties have separate owners who have never worked one case together.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Recovery plans are about systems",
        "finding": "IT recovery plans list servers, not the clinical services they support, nor how long manual work can last.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decide on isolation with clinical input",
        "statement": "The committee decides whether to cut clinical networks off, with the clinical leads, and states which services must stay available and who accepts the risk.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Clinical leads heard before deciding\nCritical services named\nRisk owner recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The committee minutes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Govern the response to extortion",
        "statement": "The committee agrees who can authorise contact with the actor and what its limits are, with Legal, the insurer and the police.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Decision owner named\nLegal, insurer and police consulted\nPosition recorded",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The decision log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Own every notification",
        "statement": "Each duty to the data protection authority, the health authority and the national CSIRT has an owner and a date, and patients are told what they need to know.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Owners and dates recorded\nData breach decision recorded\nMessage to patients and staff approved",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The notification log.",
        "regulatory_requirement_ids": [
          "GDPR-33-34",
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "Recover care, not servers",
        "statement": "The committee sets the order in which clinical services return, how long manual work can continue and who validates each step.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Service order agreed\nLimit for manual procedures known\nClinical validation required before each restart",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The recovery plan.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-05",
        "title": "Tell patients and staff the truth first",
        "statement": "Messages to patients, staff, partners and media are consistent, and don't confirm what isn't known.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Spokesperson named\nStaff informed\nQuestions on patient safety answered with facts",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The approved messages.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "A real incident happens during the session.",
        "mitigation": "Anyone can stop the exercise with the stop keyword."
      },
      {
        "risk": "Clinicians at the table are called away.",
        "mitigation": "Deputies are named in advance."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Hospital network",
    "summary": "{organization} runs {hospital_1}, {hospital_2} and a network of laboratories and outpatient clinics. Clinical teams rely on {ehr_system}, laboratory and imaging platforms, and connected medical devices that share interfaces with corporate IT.",
    "attack_version": "19.2",
    "duration_minutes": 175,
    "time_compression": 15,
    "phases": [
      {
        "code": "PH-01",
        "name": "Isolate or not",
        "start_offset": 0,
        "end_offset": 55,
        "incident_jump_minutes": 0,
        "situation_update": "Day 1, 10:40. Staff in the head office can't open their files.",
        "key_questions": [
          "What information does the committee need before the next decision?",
          "What level of degraded operation is acceptable?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Ransomware at the door of the clinical systems"
      },
      {
        "code": "PH-02",
        "name": "Extortion and exposure",
        "start_offset": 55,
        "end_offset": 115,
        "incident_jump_minutes": 200,
        "situation_update": "Day 2, before dawn. The hospitals are working in segmented mode.",
        "key_questions": [
          "Do we engage with the actor?",
          "Which services can continue safely in degraded mode?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "A ransom demand and patient data online"
      },
      {
        "code": "PH-03",
        "name": "Recovering care",
        "start_offset": 115,
        "end_offset": 175,
        "incident_jump_minutes": 5235,
        "situation_update": "Day 6. Containment is complete and hospitals still work on paper. The leading principle: recover the clinical service, not merely the server.",
        "key_questions": [
          "How long can paper processes be sustained safely?",
          "Who accepts the residual clinical risk?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "In what order does care come back?"
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
        "description": "Extortion group that encrypts, steals and publishes samples to force payment.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1110.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021"
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
        "title": "Encryption in HR and staff folders",
        "content": "The cyber defence centre sees encryption and possible data theft in the HR platform and staff storage. Employees report files they can't open. The directory looks compromised, credentials are being abused, and the attacker has reached jump servers that support the hospitals and the laboratories. The next step could be the interfaces shared with {ehr_system}, laboratory, imaging and device monitoring.",
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
          "CIO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1021"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Declares a top-priority incident and convenes the executive crisis committee.",
            "responsible_role": "CISO",
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
        "title": "Clinical teams are losing visibility",
        "content": "Visibility is being lost across clinical technology at {hospital_1} and {hospital_2}. Life support and patient safety functions are working, but teams can't fully verify connected devices, diagnostic interfaces or central monitoring. Isolation from corporate IT is being prepared, and it would remove remote support, delay diagnostics and force local checks.",
        "offset_minutes": 15,
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
          "Chief medical officer",
          "Chief nursing officer",
          "Chief operating officer"
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
            "code": "INJ-02-A1",
            "description": "States which services can run manually and which can't be cut without clinical validation.",
            "responsible_role": "Chief medical officer",
            "expected_within_minutes": 12,
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
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "The CISO recommends isolating",
        "content": "From the CISO: ransomware is confirmed, with encryption and data theft, and stolen credentials have reached systems supporting clinical technology. I recommend isolating the clinical networks from corporate IT. You'll lose remote visibility and diagnostic interfaces, and onsite engineering will have to keep care safe. I need a decision from the committee.",
        "offset_minutes": 26,
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
          "Executive crisis committee"
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
            "code": "INJ-03-A1",
            "description": "Asks the clinical leads for their position before deciding.",
            "responsible_role": "CEO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decides on isolation, names the risk owner and states what must keep running.",
            "responsible_role": "Executive crisis committee",
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
          "kind": "email",
          "sender": "CISO",
          "sender_address": "ciso@hospital.example.org",
          "recipient": "Executive crisis committee",
          "subject": "Decision needed: clinical networks",
          "timestamp": "Day 1, 11:15",
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
        "code": "POL-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Clinical networks",
        "content": "The attacker may reach the clinical interfaces within hours.",
        "offset_minutes": 36,
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
        "poll_question": "Do you cut the clinical networks off from corporate IT?",
        "poll_options": [
          "Isolate everything now and go to manual procedures",
          "Isolate in stages, starting with what clinicians say can wait",
          "Keep connected under close watch until there is proof of an attack on clinical systems",
          "Isolate only the two hospitals and leave laboratories and clinics connected"
        ],
        "poll_outcomes": [
          "The attacker is shut out. Diagnostics slow at once, staff are thrown onto paper without notice, and clinicians feel the decision was taken without them.",
          "Clinicians shape the order and care stays safer. It takes hours you may not have, and each stage leaves a door open.",
          "Care isn't disturbed today. If the attacker reaches the clinical side, the failure will be far worse and the decision will be yours.",
          "It protects the highest-risk services. Laboratories and clinics feed the same records, so the exposure is reduced rather than closed."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 1,
            "m3": 3,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 3,
            "m2": 3,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 2,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "First crisis meeting",
        "content": "Corporate systems are encrypted and identity is compromised. Patient safety functions are working, and shared clinical platforms are at risk. Which services must stay available, and what must you know before the next decision point?",
        "offset_minutes": 45,
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
          "Executive crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Ask each executive for one information requirement. Write them down: they frame the second meeting.",
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
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The ransom note",
        "content": "Your network is ours. Payroll and patient administration records are already on our site as a sample. Pay within 72 hours or we publish everything, clinical and identity data included.",
        "offset_minutes": 60,
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
          "Executive crisis committee",
          "Legal"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          },
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
            "code": "INJ-06-A1",
            "description": "Names who can authorise any contact and with what limits.",
            "responsible_role": "CEO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Brings in the insurer and the police before any decision.",
            "responsible_role": "Legal",
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
        "code": "INJ-07",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "A journalist asks about patients",
        "content": "Researchers have shown me a leak listing that seems to include payroll and patient information from {organization}. Are you under attack? Are health records, diagnostics or medical devices affected? Could emergency care or planned procedures be disrupted? What are you doing to protect patients, staff and partner clinics?",
        "offset_minutes": 68,
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
          "Communications",
          "CEO"
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
            "code": "INJ-07-A1",
            "description": "Agrees a holding position that doesn't confirm what is still unknown.",
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
          "kind": "email",
          "sender": "Health correspondent",
          "sender_address": "health.desk@news.example.org",
          "recipient": "Executive team",
          "subject": "Possible attack: questions before publication",
          "timestamp": "Day 2, 06:30",
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
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Payroll, privacy and the duty to tell",
        "content": "HR warns that the payroll platform is down with pay day approaching, and staff are asking about salaries and exposed data with no organisation-wide message yet. The data protection officer is preparing a notification on employee and patient administration data, and asks who will engage the health authority.",
        "offset_minutes": 76,
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
          "Human resources",
          "Data protection officer",
          "Executive crisis committee"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Confirms the notification decision, its owner and the deadline.",
            "responsible_role": "Data protection officer",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Sends staff a message on pay, shifts and their data.",
            "responsible_role": "Human resources",
            "expected_within_minutes": 12,
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
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The health authority calls",
        "content": "The health authority has heard about the incident from the press and asks why it wasn't told, what capacity you have today in emergency and intensive care, and whether other providers should take your patients.",
        "offset_minutes": null,
        "trigger_condition": "No owner for the health authority 10 minutes after INJ-08.",
        "contingent_purpose": "Bring the health authority into the room.",
        "fires_at_minute": 34,
        "branch_from_code": "INJ-08",
        "branch_action_code": "INJ-08-A1",
        "rejoin_code": "POL-11",
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Chief operating officer",
          "Chief medical officer"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Gives a capacity picture and names a single contact for the authority.",
            "responsible_role": "Chief operating officer",
            "expected_within_minutes": 8,
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
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Working in segmented mode",
        "content": "Clinical services continue. Engineering and some vendors must work on site. Device checks, diagnostics and patient transfers are partly manual, and shared international services have been cut. Removing further external connections may affect scheduling, telemedicine and remote reporting.",
        "offset_minutes": 84,
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
          "Chief medical officer",
          "Chief nursing officer",
          "Chief operating officer"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Identifies which patients or procedures need transfer, delay or added safeguards.",
            "responsible_role": "Chief medical officer",
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
        "code": "POL-11",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The demand",
        "content": "Patient data is at stake and the deadline runs.",
        "offset_minutes": 92,
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
        "poll_question": "The actor has 72 hours on the clock. What is your position?",
        "poll_options": [
          "No contact and no payment, and prepare for publication",
          "Allow specialists to open a channel to learn what was taken, with no commitment to pay",
          "Consider payment if care can't be restored any other way",
          "Leave the decision to the insurer and the police"
        ],
        "poll_outcomes": [
          "A clear position that staff and regulators understand. Patient data will probably be published, and you need to be ready for that day.",
          "You learn what is really at risk and gain time for patients. Handled badly, it looks like negotiating over patient records.",
          "Care comes first and people will understand the motive. Nothing guarantees a working key or deleted data, and legal limits may apply.",
          "They will advise, but they won't decide for you. Time passes, and the committee still owns the outcome."
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
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-12",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Second crisis meeting",
        "content": "Hospitals and laboratories are in segmented mode, sample personal data is public, journalists are asking about patient safety and HR is worried about pay and staffing. Which clinical services can safely continue, what do you say to patients and clinicians, and who owns each notification?",
        "offset_minutes": 102,
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
          "Executive crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Check whether every notification has an owner. If not, stop and assign them.",
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
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The story is in the national press",
        "content": "{organization} has suffered a cyberattack, with possible exposure of patient, staff and financial data, cancelled non-urgent procedures, delayed diagnostics and doubts over emergency capacity. Sources question whether patient safety was compromised and whether the group met its duties to report.",
        "offset_minutes": 120,
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
            "code": "INJ-13-A1",
            "description": "Coordinates one message on patient safety, continuity, privacy and recovery.",
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
          "kind": "press_release",
          "sender": "National news outlet",
          "sender_address": "",
          "recipient": "",
          "subject": "Cyberattack hits hospital group, patient data feared exposed",
          "timestamp": "Day 6, 10:00",
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
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Recovery planning",
        "content": "From the CISO: containment is complete and recovery has started. Clinical technology stays isolated and care continues in a degraded state, with paper workflows and manual medication, laboratory and imaging procedures under review. IT can restore in several orders. Every restored interface needs technical and clinical validation before it touches patients. What comes first?",
        "offset_minutes": 130,
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
          "Executive crisis committee",
          "Chief medical officer",
          "CIO"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Sets clinical priorities and how long manual work can safely last.",
            "responsible_role": "Chief medical officer",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Turns the priorities into a validated restoration sequence.",
            "responsible_role": "CIO",
            "expected_within_minutes": 15,
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
        "code": "POL-15",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "What comes back first",
        "content": "Everything is urgent to someone.",
        "offset_minutes": 142,
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
        "poll_question": "IT can start on only one restoration stream today. Which one?",
        "poll_options": [
          "Emergency and intensive care systems",
          "Laboratory, imaging and pharmacy",
          "Payroll and staff scheduling",
          "Scheduled surgery, patient portal and billing"
        ],
        "poll_outcomes": [
          "The most fragile patients benefit first. Those services depend on laboratory and imaging, so the gain may be smaller than expected.",
          "Diagnosis and medication return for every ward, and that removes the riskiest manual steps. Emergency systems wait a little longer.",
          "Staff are paid and shifts covered, which keeps people at work. Clinical teams may see it as putting administration before patients.",
          "Income and access return, and pressure from waiting lists eases. It is the hardest choice to defend while clinical teams are on paper."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 2,
            "m3": 1,
            "m4": 2
          },
          {
            "m1": 3,
            "m3": 3,
            "m4": 3,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Third crisis meeting",
        "content": "Containment is complete, the press is covering leaked patient and staff data, and care continues in a degraded state. What is the safe sequence for restoring clinical services? Should patients be moved to other providers? Who accepts the residual risk, and which improvements should the crisis accelerate?",
        "offset_minutes": 155,
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
          "Executive crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Use the tally from the polls. Close with what must be communicated to hospitals, laboratories and partners, and the improvements with owner and date.",
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
    "next_inject_number": 17,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Patient safety"
      },
      {
        "key": "m2",
        "name": "Threat actor risk"
      },
      {
        "key": "m3",
        "name": "Staff strain"
      },
      {
        "key": "m4",
        "name": "Legal and reputation"
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
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-02",
      "name": "Attacker (sender)",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "document"
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
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-04",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "cyber-insurer",
      "origin_name": "Cyber insurer",
      "code": "ACT-05",
      "name": "Cyber insurer",
      "type": "other",
      "description": "The insurer: policy conditions, approved responders and notification deadlines.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-06",
      "name": "Health authority",
      "type": "authority",
      "description": "The authority responsible for healthcare services and coordination between providers.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-07",
      "name": "Clinical operations team",
      "type": "internal",
      "description": "The team that reports the state of clinical technology and care.",
      "channel": "email"
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
      "origin_id": "executive",
      "origin_name": "Executive",
      "name": "Executive",
      "color": "indigo",
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
  "next_room_number": 1,
  "files": []
}
```
