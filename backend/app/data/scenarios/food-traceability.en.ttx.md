---
format: "ttx-zone.scenario"
format_version: 8
language: "en"
title: "Can we trust the batch records?"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Can we trust the batch records?

A food group finds a long-running intrusion on executive laptops. As the attacker reaches recipes, labels and traceability, the question moves from what was stolen to whether anyone can prove that what is on the shelves is safe. What happens next depends on the team: contingent injects fire when containment or communication slips.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Contain, even at the top
- **OBJ-02** Prove the records before releasing product
- **OBJ-03** Answer the authorities with evidence
- **OBJ-04** One set of facts for everyone

## Scenario

{organization} makes and distributes food under the brand {brand} from {plant_1} and {plant_2}. Recipes live in {recipe_system}, and lots, pallets and release decisions in {traceability_system}. Retailers and consumers trust those records without ever seeing them.

## Phases and injects

### PH-01 The quiet intruder

Day 1. An odd alert from a laptop in one country.

- **INJ-01** (T+5′) Executive laptops talking to nowhere
- **INJ-02** (T+20′) An executive won't give up the laptop
- **INJ-03** (contingent) Phishing from the laptop still online
- **INJ-04** (T+34′) A month inside, and what they touched

### PH-02 Can we trust the records?

Day 4. The incident reaches beyond the company.

- **INJ-05** (T+55′) Refunds that nobody offered
- **INJ-06** (T+66′) Domain admin, and code waiting to fire
- **INJ-07** (contingent) The code fires
- **INJ-08** (T+84′) A label that doesn't match
- **POL-09** (T+94′) What to do with the product
  - Lots already in distribution can't be fully verified. What do you do?
    - Withdraw every lot from the suspect period now
      - Consumers are protected beyond doubt. It costs a great deal, the story goes public at once, and retailers want to know why.
    - Hold stock in your own warehouses and validate, leaving the shelves alone
      - You stop the flow without alarming anyone. What is already on shelves stays there while you work, and it gets harder to defend each day.
    - Inform the food safety authority and agree the scope with them
      - You share the decision with the people who can judge it. You lose control of timing, and a public measure may follow.
    - Keep shipping and sample lots in the laboratory
      - Production carries on. A sample can't prove a record, and if something turns up later, this decision is the headline.

### PH-03 Public fear

Day 19. Weeks of quiet recovery end with an alert from digital monitoring.

- **INJ-10** (T+110′) Recipes for sale to one buyer
- **INJ-11** (T+118′) Staff want to know
- **INJ-12** (contingent) A formal complaint
- **INJ-13** (T+130′) The authority asks for proof
- **INJ-14** (T+138′) The press has a list of claims
- **INJ-15** (contingent) A fake recall notice goes viral
- **POL-16** (T+148′) What to say tonight
  - The story runs tonight. What do you do?
    - Publish a statement separating stolen information from unverified claims, with the state of the food safety review
      - Speculation about unsafe products drops. You have committed to facts you must be able to prove, and any later correction will be noticed.
    - Say only that you are working with the authorities
      - Safe and short. It leaves the claims standing overnight, and retailers will draw their own conclusions.
    - Deny the food safety claims outright
      - A strong headline for one day. The validation isn't finished, so if one lot fails, the denial becomes the story.
    - Brief retailers and the authority first, and go public in the morning
      - Your partners hear it from you, which they will remember. The press runs tonight without you, and the morning is a long way off.

### PH-04 Closure

Day 28. No new systems show malicious behaviour.

- **DSC-17** (T+160′) Before closing the incident
- **DSC-18** (T+170′) Months later: a buyer without a name

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Incident response provider (retainer)
- **ACT-03** Customer
- **ACT-04** Media
- **ACT-05** Threat intelligence provider
- **ACT-06** Employee
- **ACT-07** Board chair
- **ACT-08** Police cybercrime unit
- **ACT-09** Food safety authority
- **ACT-10** Workforce representatives

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "en",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Can we trust the batch records?",
    "description": "A food group finds a long-running intrusion on executive laptops. As the attacker reaches recipes, labels and traceability, the question moves from what was stolen to whether anyone can prove that what is on the shelves is safe. What happens next depends on the team: contingent injects fire when containment or communication slips."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
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
      "continuity_recovery",
      "regulatory_notification",
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
      "IT operations",
      "Food safety and quality",
      "Plant operations",
      "Legal",
      "Data protection officer",
      "Communications",
      "Consumer care",
      "Human resources",
      "Retail accounts",
      "CEO",
      "Crisis committee"
    ],
    "third_parties": [],
    "perimeter": "Executive devices, identity, recipes, labelling, traceability, product release, consumer fraud and crisis communication.",
    "out_of_scope": "Laboratory analysis of real products and any real contact with authorities or retailers.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "COLD STORE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Nobody can overrule an executive",
        "finding": "The incident plan doesn't say who can take a device from a senior executive during an incident.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Traceability has never been tested under attack",
        "finding": "Recall drills assume that batch and label records are correct. None has asked what happens if they can't be trusted.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Consumers, retailers and staff hear different things",
        "finding": "Consumer care, retail accounts and human resources each have their own process and no common source of facts.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Contain, even at the top",
        "statement": "The team escalates through the agreed chain and gets every affected device and account under control, including those of senior executives.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Escalation made to the right level\nDevice isolated or credentials revoked\nAlternative way of working offered",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The incident log.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Prove the records before releasing product",
        "statement": "Food safety and operations agree what must be validated in recipes, labels and batches, and hold what can't be proved.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Validation criteria agreed\nUnverified lots identified and held\nOwner of the release decision named",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The validation plan and the list of lots.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Answer the authorities with evidence",
        "statement": "The team meets its data breach and incident reporting duties and gives the food safety authority a documented assurance package.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Notification decisions recorded\nRegulatory contact appointed\nEvidence package assigned",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The notifications and the evidence package.",
        "regulatory_requirement_ids": [
          "GDPR-33-34",
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "One set of facts for everyone",
        "statement": "Consumers, retailers, staff and media receive matching messages that separate what is confirmed from what isn't.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Spokesperson named\nConfirmed and unconfirmed facts separated\nStaff told before the media",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The messages and their timeline.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "A real incident happens during the session.",
        "mitigation": "Anyone can stop the exercise with the stop keyword."
      },
      {
        "risk": "The debate turns into food science.",
        "mitigation": "The Facilitator keeps it on who decides, on what evidence."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 5
  },
  "msel": {
    "title": "Food traceability",
    "summary": "{organization} makes and distributes food under the brand {brand} from {plant_1} and {plant_2}. Recipes live in {recipe_system}, and lots, pallets and release decisions in {traceability_system}. Retailers and consumers trust those records without ever seeing them.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 20,
    "phases": [
      {
        "code": "PH-01",
        "name": "The quiet intruder",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Day 1. An odd alert from a laptop in one country.",
        "key_questions": [
          "Who can take a laptop from a senior executive?",
          "Which of these files could hurt consumers, not only the business?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Executive laptops talking to nowhere"
      },
      {
        "code": "PH-02",
        "name": "Can we trust the records?",
        "start_offset": 50,
        "end_offset": 105,
        "incident_jump_minutes": 3160,
        "situation_update": "Day 4. The incident reaches beyond the company.",
        "key_questions": [
          "What must be true before a lot leaves the plant?",
          "Who signs that?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Fraud outside, doubts inside"
      },
      {
        "code": "PH-03",
        "name": "Public fear",
        "start_offset": 105,
        "end_offset": 155,
        "incident_jump_minutes": 20720,
        "situation_update": "Day 19. Weeks of quiet recovery end with an alert from digital monitoring.",
        "key_questions": [
          "What can we prove about food safety today?",
          "Who hears it first?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "Stolen recipes for sale and doubts on the shelves"
      },
      {
        "code": "PH-04",
        "name": "Closure",
        "start_offset": 155,
        "end_offset": 180,
        "incident_jump_minutes": 11900,
        "situation_update": "Day 28. No new systems show malicious behaviour.",
        "key_questions": [
          "What do we still have to prove?",
          "What should we watch for now?"
        ],
        "objectives": [],
        "headline": "What it takes to close"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Criminal group",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Group that spends weeks on executive laptops, then sells what it stole and leaves code set to cause damage.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1071.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1558.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1565.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
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
        "title": "Executive laptops talking to nowhere",
        "content": "A SIEM rule catches thousands of unusual DNS requests from one laptop towards infrastructure with no business reason. Hunting finds the same pattern on a dozen more devices in several countries, several of them belonging to executives with access to strategy, recipes, procurement and supply chain.",
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
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1071.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Opens one coordinated incident and keeps DNS, proxy and identity logs.",
            "responsible_role": "Security operations",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Decides whether to block the destinations or watch them for now.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
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
        "title": "An executive won't give up the laptop",
        "content": "One affected executive has been on leave for days. Another refuses to hand over or isolate their laptop: it holds the numbers for a negotiation with {customer}, the biggest retail customer, and a launch meeting tomorrow. The laptop is still connected to corporate services.",
        "offset_minutes": 20,
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
          "Incident lead",
          "CEO"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Escalates through the executive chain and gets a decision.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Isolates the device or revokes its credentials and offers a replacement.",
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
        "kind": "contingent",
        "title": "Phishing from the laptop still online",
        "content": "The service desk and two retailers report emails from the executive's real account with a PDF that installs the same tool. They went to staff, suppliers and retail customers. Those who trusted the sender have opened them.",
        "offset_minutes": null,
        "trigger_condition": "The laptop is still connected 15 minutes after INJ-02.",
        "contingent_purpose": "Show the cost of delaying containment.",
        "fires_at_minute": 36,
        "branch_from_code": "INJ-02",
        "branch_action_code": "INJ-02-A2",
        "rejoin_code": "INJ-05",
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Security operations",
          "CISO",
          "Retail accounts"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Revokes the account and finds who opened the attachment.",
            "responsible_role": "Security operations",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Warns suppliers and retailers through a verified channel.",
            "responsible_role": "Retail accounts",
            "expected_within_minutes": 12,
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
        "code": "INJ-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "A month inside, and what they touched",
        "content": "Every analysed laptop runs the same remote-access tool, active for more than a month. Memory shows references to board papers, recipes from {recipe_system}, network diagrams of {plant_1} and {plant_2}, laboratory thresholds, supplier terms, contact data for staff and consumers, and bank details. This may not be the full list.",
        "offset_minutes": 34,
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
          "Food safety and quality",
          "Legal",
          "Crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01",
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Assesses whether recipes, allergen controls or thresholds create a food safety risk.",
            "responsible_role": "Food safety and quality",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Starts the data breach assessment with the data protection officer.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-04-A3",
            "description": "Proposes activating the crisis committee and the cyber insurance.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Refunds that nobody offered",
        "content": "Dear {brand} customer, due to a quality issue with a recent purchase you are entitled to a refund. Confirm your payment details at refunds.example.com within 24 hours. Your loyalty number and last order are shown below.",
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
          "Consumer care",
          "Communications",
          "Data protection officer"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "A consumer forwarded this message to the care team. The invented quality issue is what the fraud uses: it is not real.",
        "objective_codes": [
          "OBJ-03",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Warns consumers and retailers and gives them an official source of information.",
            "responsible_role": "Consumer care",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Links the data in the fraud to its internal source and reviews notification.",
            "responsible_role": "Data protection officer",
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
          "kind": "email",
          "sender": "{brand} Customer Care",
          "sender_address": "care@refunds.example.com",
          "recipient": "Loyalty customer",
          "subject": "Your refund is waiting",
          "timestamp": "Day 4, 08:00",
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
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Domain admin, and code waiting to fire",
        "content": "Rogue administrator accounts in regional domains, with artifacts consistent with a Golden Ticket, gave the actor access to {recipe_system}, {traceability_system}, the manufacturing execution system and quality systems. Analysts also find code on identity, email and {traceability_system} designed to fire if contact with the actor is lost.",
        "offset_minutes": 66,
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
          "IT operations",
          "CISO"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1558.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Audits privileged accounts and tickets before cutting anything.",
            "responsible_role": "IT operations",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decides how to neutralise the code without triggering it or losing the evidence.",
            "responsible_role": "CISO",
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
        "kind": "contingent",
        "title": "The code fires",
        "content": "Email and sign-in stop for most staff. Payroll is corrupted. The manufacturing system loses orders and batch status, {traceability_system} shows inconsistent lots and pallets, and several packaging lines receive old label templates. {plant_1} and {plant_2} stop: nobody can confirm ingredient declarations, allergens or release status.",
        "offset_minutes": null,
        "trigger_condition": "No audit of privileged accounts 15 minutes after INJ-06.",
        "contingent_purpose": "Turn a data incident into an operational and food safety one.",
        "fires_at_minute": 32,
        "branch_from_code": "INJ-06",
        "branch_action_code": "INJ-06-A1",
        "rejoin_code": "INJ-08",
        "sender_code": "ACT-06",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Plant operations",
          "Food safety and quality",
          "Crisis committee",
          "Human resources"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1565.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Sets up an out-of-band channel for the crisis team.",
            "responsible_role": "Crisis committee",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Quarantines production that can't be verified.",
            "responsible_role": "Plant operations",
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
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "A label that doesn't match",
        "content": "The quality lead at {plant_2} messages you: a spot check found a {product} pallet whose label doesn't match its recipe version. It could be a mistake from before the incident. Nobody can tell, because the actor had write access to the records. Several lots have left for distribution in the last two weeks.",
        "offset_minutes": 84,
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
          "Food safety and quality",
          "Plant operations",
          "Incident lead"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1565.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Defines what must be validated and against which trusted source.",
            "responsible_role": "Food safety and quality",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Identifies the lots made while the records could not be trusted.",
            "responsible_role": "Plant operations",
            "expected_within_minutes": 12,
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
        "code": "POL-09",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "What to do with the product",
        "content": "No harm has been reported. You can't prove the records either.",
        "offset_minutes": 94,
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
        "poll_question": "Lots already in distribution can't be fully verified. What do you do?",
        "poll_options": [
          "Withdraw every lot from the suspect period now",
          "Hold stock in your own warehouses and validate, leaving the shelves alone",
          "Inform the food safety authority and agree the scope with them",
          "Keep shipping and sample lots in the laboratory"
        ],
        "poll_outcomes": [
          "Consumers are protected beyond doubt. It costs a great deal, the story goes public at once, and retailers want to know why.",
          "You stop the flow without alarming anyone. What is already on shelves stays there while you work, and it gets harder to defend each day.",
          "You share the decision with the people who can judge it. You lose control of timing, and a public measure may follow.",
          "Production carries on. A sample can't prove a record, and if something turns up later, this decision is the headline."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m2": 3,
            "m3": 1,
            "m4": 3,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Recipes for sale to one buyer",
        "content": "Forums are linking to an auction on a hidden service, winner takes all: screenshots with the {brand} logo, a list of recipe and process files, plant network diagrams, supplier contracts and product release documents. Some links can be removed, but not the auction. Trade blogs are starting to ask questions.",
        "offset_minutes": 110,
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
          "CISO",
          "Legal",
          "Food safety and quality",
          "Crisis committee"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Keeps the listings, verifies them and informs the police.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Assesses the risk of counterfeit products and targeted attacks on plants.",
            "responsible_role": "Food safety and quality",
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
        "code": "INJ-11",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Staff want to know",
        "content": "Staff representatives write that rumours are going round about stolen recipes, personal data and payroll errors. They ask what is confirmed, what it means for shifts and temporary workers, and why they heard it from the corridor.",
        "offset_minutes": 118,
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
          "Communications"
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
            "code": "INJ-11-A1",
            "description": "Sends staff a message with what is confirmed and where to ask, and meets the representatives.",
            "responsible_role": "Human resources",
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
        "code": "INJ-12",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "A formal complaint",
        "content": "Workforce representatives have filed a formal complaint about the handling of personal data, payroll errors and the delay in telling staff. Local press in two countries has picked it up.",
        "offset_minutes": null,
        "trigger_condition": "No message to staff 10 minutes after INJ-11.",
        "contingent_purpose": "Show the cost of leaving staff to last.",
        "fires_at_minute": 24,
        "branch_from_code": "INJ-11",
        "branch_action_code": "INJ-11-A1",
        "rejoin_code": "INJ-13",
        "sender_code": "ACT-10",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Human resources",
          "Legal"
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
            "code": "INJ-12-A1",
            "description": "Keeps the timeline of decisions and engages through a documented channel.",
            "responsible_role": "Legal",
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
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The authority asks for proof",
        "content": "The food safety authority requires evidence that no unauthorised recipe or allergen change entered production, that batch and pallet traceability stayed reliable, that release decisions rested on trustworthy records, and that any affected product was found, quarantined or withdrawn. Separately, the markets regulator asks whether information was disclosed on time.",
        "offset_minutes": 130,
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
          "Food safety and quality",
          "Legal",
          "Incident lead"
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
            "code": "INJ-13-A1",
            "description": "Appoints a single regulatory contact and keeps decisions and evidence.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-13-A2",
            "description": "Assigns the assurance package on recipes, allergens and traceability.",
            "responsible_role": "Food safety and quality",
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
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The press has a list of claims",
        "content": "We're running a story on {organization} tonight. We've been told you hid allergen risks, changed laboratory results, paid the attackers and left products with unreliable traceability on sale. Do you confirm any of this?",
        "offset_minutes": 138,
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
          "Communications",
          "CEO"
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
            "description": "Separates what is confirmed from what is false and agrees one spokesperson.",
            "responsible_role": "Communications",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Decides whether to issue a public position today.",
            "responsible_role": "CEO",
            "expected_within_minutes": 12,
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
          "sender": "National news desk",
          "sender_address": "desk@news.example.org",
          "recipient": "Press office",
          "subject": "Questions for tonight's story",
          "timestamp": "Day 19, 19:00",
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
        "code": "INJ-15",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "A fake recall notice goes viral",
        "content": "URGENT RECALL: all {brand} {product} may contain undeclared allergens. Do not eat. Share with your family.",
        "offset_minutes": null,
        "trigger_condition": "No official position 8 minutes after INJ-14.",
        "contingent_purpose": "Show what fills the silence.",
        "fires_at_minute": 42,
        "branch_from_code": "INJ-14",
        "branch_action_code": "INJ-14-A2",
        "rejoin_code": "DSC-17",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Communications",
          "Consumer care",
          "Retail accounts"
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
            "code": "INJ-15-A1",
            "description": "Publishes verifiable product and batch information on official channels.",
            "responsible_role": "Consumer care",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-15-A2",
            "description": "Agrees with retailers what happens on the shelf.",
            "responsible_role": "Retail accounts",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Consumer alerts",
          "sender_address": "@food_alerts_now",
          "recipient": "",
          "subject": "",
          "timestamp": "Day 19, 21:00",
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
        "code": "POL-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "What to say tonight",
        "content": "Some claims are false and others twist genuine stolen documents.",
        "offset_minutes": 148,
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
        "poll_question": "The story runs tonight. What do you do?",
        "poll_options": [
          "Publish a statement separating stolen information from unverified claims, with the state of the food safety review",
          "Say only that you are working with the authorities",
          "Deny the food safety claims outright",
          "Brief retailers and the authority first, and go public in the morning"
        ],
        "poll_outcomes": [
          "Speculation about unsafe products drops. You have committed to facts you must be able to prove, and any later correction will be noticed.",
          "Safe and short. It leaves the claims standing overnight, and retailers will draw their own conclusions.",
          "A strong headline for one day. The validation isn't finished, so if one lot fails, the denial becomes the story.",
          "Your partners hear it from you, which they will remember. The press runs tonight without you, and the morning is a long way off."
        ],
        "poll_impacts": [
          {
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m2": 2,
            "m3": 1,
            "m4": 2
          },
          {
            "m2": 3,
            "m3": 1,
            "m4": 3
          },
          {
            "m2": 2,
            "m3": 2,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-17",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Before closing the incident",
        "content": "The crisis committee meets to decide on closure. Systems have been restored from validated sources. What must be confirmed about recipes, allergen declarations, labels and batch records before you close, what is still owed to the authorities, retailers and staff, and who keeps watching?",
        "offset_minutes": 160,
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
          "CEO",
          "Crisis committee"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Use the tally from the polls. If food safety doubt ended high, the incident isn't closed, whatever the systems say.",
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
        "title": "Months later: a buyer without a name",
        "content": "Police arrest a person linked to the group. Auction records show that a commercial party bought part of the stolen material, and nobody knows who. Which recipes, contracts or plant details need protective changes, and how would you notice their misuse?",
        "offset_minutes": 170,
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
          "CISO",
          "Legal",
          "Food safety and quality"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Close with improvements, each with an owner and a date: executive device policy, trust in records, and recall drills that assume bad data.",
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
        "name": "Food safety doubt"
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
      "origin_id": "dfir-provider",
      "origin_name": "Incident response provider (retainer)",
      "code": "ACT-02",
      "name": "Incident response provider (retainer)",
      "type": "supplier",
      "description": "The external response and forensics team, usually under a retainer activated during the incident: findings, reports and containment advice.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Customer",
      "code": "ACT-03",
      "name": "Customer",
      "type": "customer",
      "description": "A customer noticing the impact and asking for explanations.",
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
      "origin_id": "threat-intel-provider",
      "origin_name": "Threat intelligence provider",
      "code": "ACT-05",
      "name": "Threat intelligence provider",
      "type": "supplier",
      "description": "Monitors forums, leak sites and social media: reports exposed data and attacker activity.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-06",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Board chair",
      "code": "ACT-07",
      "name": "Board chair",
      "type": "internal",
      "description": "The chair of the board when the board isn't playing: demands answers and calls meetings.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Police cybercrime unit",
      "code": "ACT-08",
      "name": "Police cybercrime unit",
      "type": "authority",
      "description": "Law enforcement investigating the attack and asking for evidence.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-09",
      "name": "Food safety authority",
      "type": "authority",
      "description": "The authority that oversees food safety, recalls and traceability.",
      "channel": "email"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-10",
      "name": "Workforce representatives",
      "type": "internal",
      "description": "Staff representatives asking about pay, shifts and personal data.",
      "channel": "email"
    }
  ],
  "next_actor_number": 11,
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
      "origin_id": "wiper",
      "origin_name": "Wiper",
      "name": "Wiper",
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
