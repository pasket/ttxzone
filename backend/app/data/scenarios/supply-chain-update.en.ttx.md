---
format: "ttx-zone.scenario"
format_version: 5
language: "en"
title: "A poisoned software update"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# A poisoned software update

A trusted vendor's monitoring agent ships a signed but trojanized update to hundreds of servers. The team scopes the exposure, works the vendor and decides on early warning to the authority.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Work the vendor
- **OBJ-02** Know how far it reached
- **OBJ-03** Early warning on time

## Scenario

A threat intelligence provider warns that version 4.2.1 of a widely used monitoring agent, pushed automatically last week, contains a backdoor. Your servers updated on schedule.

## Phases and injects

### PH-01 Advisory

Thursday, 09:10. An advisory lands in the security mailbox.

- **INJ-01** (T+5′) Advisory: backdoor in agent 4.2.1
- **INJ-02** (T+25′) 312 servers, 4 talking out

### PH-02 The vendor and the cut

Thursday, 15:00. The vendor confirms the breach but has no fix yet.

- **INJ-03** (T+60′) The vendor calls back
- **INJ-04** (T+80′) Uninstall it everywhere?
- **INJ-05** (contingent) Credentials were in the agent

### PH-03 Reporting

Friday, 07:00. Twenty-two hours since the advisory.

- **INJ-06** (T+120′) The CSIRT bulletin

## Simulated actors

- **ACT-01** Threat intelligence provider
- **ACT-02** SOC
- **ACT-03** Monitoring software vendor
- **ACT-04** Infrastructure lead
- **ACT-05** National CSIRT

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "en",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "A poisoned software update",
    "description": "A trusted vendor's monitoring agent ships a signed but trojanized update to hundreds of servers. The team scopes the exposure, works the vendor and decides on early warning to the authority."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "third_party_supply_chain",
      "incident_classification",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Security operations",
      "Security operations lead",
      "Incident lead",
      "Vendor management",
      "Supplier manager",
      "Compliance officer",
      "Infrastructure"
    ],
    "third_parties": [],
    "perimeter": "Servers running the vendor's agent, vendor management and regulatory reporting.",
    "out_of_scope": "Malware reverse engineering and the vendor's own investigation.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "COPPER KITE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "No playbook for a compromised vendor",
        "finding": "Contracts name a support line but no security contact or duty to share indicators.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Unknown software inventory",
        "finding": "Nobody can say within an hour which servers run a given agent version.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Early warning never exercised",
        "finding": "The 24-hour early warning has never been rehearsed with a third-party cause.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Work the vendor",
        "statement": "By the end of the first afternoon, the team obtains from the vendor its indicators, timeline and fix plan, and decides on the vendor agent's access.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Vendor security contact reached\nIndicators and timeline requested in writing\nDecision on the vendor agent recorded with its owner",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The written request to the vendor and the decision log.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Know how far it reached",
        "statement": "Within an hour of the advisory, the team establishes how many servers run the affected version and which show contact with the attacker, and assigns a severity.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Affected version count established\nHosts with outbound connections listed\nSeverity assigned with its criteria",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The asset list and the severity record.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Early warning on time",
        "statement": "The compliance officer decides whether the incident is significant and, if so, has the early warning approved before the 24-hour mark from awareness.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Time of awareness recorded\nSignificance decided with its reasons\nEarly warning draft approved before the deadline",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The early warning draft and its approval.",
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
    "title": "Version 4.2.1",
    "summary": "A threat intelligence provider warns that version 4.2.1 of a widely used monitoring agent, pushed automatically last week, contains a backdoor. Your servers updated on schedule.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Advisory",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Thursday, 09:10. An advisory lands in the security mailbox.",
        "key_questions": [
          "How fast can we say which servers run 4.2.1?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "A trusted update carries a backdoor"
      },
      {
        "code": "PH-02",
        "name": "The vendor and the cut",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 360,
        "situation_update": "Thursday, 15:00. The vendor confirms the breach but has no fix yet.",
        "key_questions": [
          "What do we ask the vendor for, in writing?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Cut the agent, lose the eyes"
      },
      {
        "code": "PH-03",
        "name": "Reporting",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1080,
        "situation_update": "Friday, 07:00. Twenty-two hours since the advisory.",
        "key_questions": [
          "Is this significant for us, and who signs the early warning?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "The 24-hour clock"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Supply-chain intruder",
        "mitre_group_id": null,
        "aliases": [],
        "description": "An actor who compromised the vendor's build system to ship a backdoored update.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1072"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1048"
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
        "title": "Advisory: backdoor in agent 4.2.1",
        "content": "The provider rates it critical: the 4.2.1 update of the monitoring agent is signed with the vendor's real certificate but beacons to attacker infrastructure every six hours.",
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
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "The incident lead opens an incident and asks for the exposure within the hour.",
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
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "312 servers, 4 talking out",
        "content": "Inventory shows 312 servers on 4.2.1. Four of them, two in the payments platform, made outbound connections to the published indicators in the last week.",
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
          "Security operations"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1048"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Security operations lists the four hosts, isolates or watches them, and the severity is assigned with its criteria.",
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
        "title": "The vendor calls back",
        "content": "The vendor confirms its build system was breached, asks customers not to roll back yet, promises a fixed version 'in days' and has no list of indicators to share.",
        "offset_minutes": 60,
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
          "Supplier manager"
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
            "code": "INJ-03-A1",
            "description": "The supplier manager asks in writing for indicators, timeline and fix plan, citing the contract.",
            "responsible_role": "Supplier manager",
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
        "title": "Uninstall it everywhere?",
        "content": "Infrastructure can remove the agent from all 312 servers tonight, but monitoring and alerting would be blind for at least two days.",
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
          "Incident lead",
          "Infrastructure"
        ],
        "delivery_method": "in_person",
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
            "description": "The incident lead decides on removing, blocking or keeping the agent, and records the decision and owner.",
            "responsible_role": "Incident lead",
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
        "title": "Credentials were in the agent",
        "content": "The provider updates its advisory: the backdoor also read the service credentials stored in the agent's configuration. The vendor's support line has a four-hour queue.",
        "offset_minutes": null,
        "trigger_condition": "No written request to the vendor 20 minutes after INJ-03.",
        "contingent_purpose": "Show the cost of waiting for the vendor.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Supplier manager",
          "Incident lead"
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
            "description": "The supplier manager escalates to the vendor's security contact and the agent's credentials are rotated.",
            "responsible_role": "Supplier manager",
            "expected_within_minutes": 15,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "The CSIRT bulletin",
        "content": "The national CSIRT publishes a bulletin on the agent and asks essential and important entities that ran 4.2.1 to report. Two of your affected servers support payments.",
        "offset_minutes": 120,
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
          "Compliance officer"
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
            "description": "The compliance officer decides on significance and has the early warning approved before the deadline.",
            "responsible_role": "Compliance officer",
            "expected_within_minutes": 20,
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
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Threat intelligence provider",
      "code": "ACT-01",
      "name": "Threat intelligence provider",
      "type": "supplier",
      "description": "Monitors forums, leak sites and social media: reports exposed data and attacker activity.",
      "channel": "email"
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
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-03",
      "name": "Monitoring software vendor",
      "type": "supplier",
      "description": "The vendor whose agent runs on your servers.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "cybersecurity-team-member",
      "origin_name": "Cybersecurity team member",
      "code": "ACT-04",
      "name": "Infrastructure lead",
      "type": "internal",
      "description": "Runs the servers; worried about losing monitoring.",
      "channel": "security_tool"
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
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "technical",
      "origin_name": "Technical",
      "name": "Technical",
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
