---
format: "ttx-zone.scenario"
format_version: 8
language: "en"
title: "From a poisoned package to production data"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# From a poisoned package to production data

A malicious open-source package on a developer's workstation leads, through stolen cloud keys and an internal AI assistant, to customer data leaving a financial entity. At each step the Players vote on a decision, under the DORA and GDPR deadlines.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Contain without stopping the business
- **OBJ-02** Meet the DORA reporting stages
- **OBJ-03** Bring the AI assistant into the response
- **OBJ-04** Rotate secrets in a safe order
- **OBJ-05** Notify and tell one consistent story

## Scenario

{organization} is a financial entity whose development teams, internal AI assistant and production databases run on {cloud_platform}. What starts as an alert on one workstation becomes, over six days, a reportable major incident and a personal data breach.

## Phases and injects

### PH-01 The package

Day 1, 09:00. An ordinary morning for the development teams at {organization}.

- **INJ-01** (T+5′) A dependency that reads too much
- **POL-02** (T+18′) How far to contain
  - The package is in a shared lockfile and you don't know who ran it. How far do you contain?
    - Isolate the workstation, lock out the whole development team and make them all sign in again
      - Every path you can see closes, including those of colleagues who pulled the same version. The team stops work and resents it, but nothing reaches the outside.
    - Isolate only that workstation and rotate the credentials stored on it
      - Proportionate and quick, and development carries on. Any colleague who pulled the package stays exposed until someone finds them.
    - Block the package across the organization and pause builds until the lockfile is clean
      - The spread stops at the source and the lockfile gets fixed. Releases slip for every team, and what was already stolen stays stolen.
    - Leave the workstation online under watch to see what the actor does next
      - You learn where the actor is going, but you leave a live thief on the network and will have to explain that choice to the supervisor.

### PH-02 The stolen keys

Day 1, a few hours later. The investigation has moved from the workstation to {cloud_platform}.

- **INJ-03** (T+35′) Stolen keys in use in {cloud_platform}
- **INJ-04** (contingent) The national CSIRT asks
- **POL-05** (T+48′) The first move in the cloud
  - The stolen keys are active and the actor is exploring. What is your first move in {cloud_platform}?
    - Disable the stolen keys and force every user in the organization to change credentials
      - The actor loses those keys at once. The whole company feels it, the service desk is overwhelmed, and people start asking why.
    - Block the VPN addresses with a deny rule
      - Fast and cheap, and it feels like action. A commercial VPN has plenty of other exits, so the actor is back within the hour.
    - Hire an external forensic firm to map what the identities can reach and look for persistence
      - You will know the blast radius, and any trail of persistence. It takes days and money, and the keys stay live while the firm gets started.
    - Revoke only those keys, turn on storage and database monitoring, and watch
      - A proportionate response that leaves you with visibility. There is a real chance the actor moves on to something else before the new monitoring sees it.

### PH-03 The assistant talks

Day 3. The team reviews what the actor did before its access was cut.

- **INJ-06** (T+65′) {ai_assistant} handed over the map
- **POL-07** (T+80′) What to do with the assistant
  - {ai_assistant} has given away the map of production, and staff rely on it. What do you do?
    - Switch it off and restrict access to its knowledge base and data source
      - The leak stops immediately. Staff lose a tool they use all day, and shadow AI use starts within hours.
    - Keep it running and disconnect {internal_wiki} and the source that leaked
      - Service continues and the known source is shut. Other connected sources remain unreviewed, so the fix is only as good as your inventory.
    - Buy and deploy dedicated monitoring for misuse of AI on it
      - You gain real visibility with little strain on the team. Buying a new product under pressure is expensive and slow, and the actor isn't waiting.
    - Limit the knowledge base to what it needs and add prompt and output filters
      - The right long-term design. It takes careful work from an overloaded team, and filters can be bypassed by someone already practised at it.

### PH-04 Secrets in the code

Day 5. Access was cut, but the actor is still reaching the environment.

- **INJ-08** (T+100′) A way back in and secrets in the scripts
- **POL-09** (T+113′) How to rotate the secrets
  - Secrets are spread across scripts and templates, and nobody knows all they feed. How do you rotate them?
    - Rotate every secret in the organization at once and lock down database access
      - The door closes hardest and fastest. Services you didn't know depended on those secrets fail, and customers notice.
    - Rotate the database credentials and the secrets found so far, and sweep the repositories later
      - The known exposure closes cheaply. Unknown secrets stay valid until the sweep nobody has scheduled yet.
    - Bring in a recovery firm to sweep every repository, bucket and template, and rotate in sequence with your team
      - Rotation in order keeps critical services up, at a substantial cost. The sequence is slow, and the actor can reach a credential before its turn.
    - Move the internal team to round-the-clock shifts and hunt by hand
      - No invoice, and full ownership. Tired people make mistakes, the hunt is slow, and your best engineers will remember this month.

### PH-05 The data leaves

Day 6. The logs from the last few hours are in.

- **INJ-10** (T+128′) The data is out
- **INJ-11** (contingent) Counsel asks for the decision
- **INJ-12** (T+134′) The press asks for comment
- **INJ-13** (T+138′) Two enterprise customers want answers
- **INJ-14** (T+142′) Staff are talking
- **POL-15** (T+150′) How to tell the world
  - The data is out and every audience is asking. How do you run the communication?
    - Tell regulators, the people affected, customers, staff and media at once through one spokesperson, and offer credit monitoring
      - Transparent and early, and customers respect it. Details you announced will change, and every correction costs credibility.
    - File everything the law requires and say nothing more than a short line if asked
      - Legally tidy and cheap. The press tells the story instead, and customers read about it before they hear from you.
    - Set up crisis communications with external counsel, confirm what left, then inform each audience in turn
      - Every statement stays accurate. The firm and counsel are expensive, the forensic work squeezes the team again, and for a short while you say nothing publicly.
    - Notify as required, say publicly that the incident is contained, and return to business as usual
      - It sounds calm for a day. If the actor publishes, or the regulator disagrees, 'contained' becomes the headline.

### PH-06 The aftermath

Three weeks later. The incident is closed and the final report is being drafted.

- **DSC-16** (T+163′) The account to the board
- **DSC-17** (T+171′) The forensic report

## Simulated actors

- **ACT-01** SOC
- **ACT-02** Incident response provider (retainer)
- **ACT-03** National CSIRT
- **ACT-04** Financial supervisor
- **ACT-05** External legal counsel
- **ACT-06** Media
- **ACT-07** Customer
- **ACT-08** Employee
- **ACT-09** Board chair

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "en",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "From a poisoned package to production data",
    "description": "A malicious open-source package on a developer's workstation leads, through stolen cloud keys and an internal AI assistant, to customer data leaving a financial entity. At each step the Players vote on a decision, under the DORA and GDPR deadlines."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "DORA",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "cross_unit_coordination",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Security operations",
      "Incident lead",
      "CISO",
      "Cloud platform team",
      "Engineering",
      "AI assistant owner",
      "Compliance",
      "Data protection officer",
      "Legal",
      "Communications",
      "CEO",
      "Crisis committee"
    ],
    "third_parties": [],
    "perimeter": "Development workstations, the cloud platform, the internal AI assistant, production databases, regulatory reporting and crisis communication.",
    "out_of_scope": "Redesigning the cloud architecture, choosing security products and any real contact with authorities.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "GREY HERON",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Containment authority unclear",
        "finding": "Nobody has rehearsed who can lock out a team or stop a production service during an incident, or on what evidence.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "DORA and GDPR clocks never run together",
        "finding": "The DORA reporting stages and the GDPR deadline have never been exercised in the same incident, along with customers and the press.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "AI assistants and secrets outside the response plan",
        "finding": "The incident response plan doesn't cover internal AI assistants, their connected sources or secrets stored in deployment code.",
        "affected_capability": "cross_unit_coordination",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Contain without stopping the business",
        "statement": "Once the compromise is known, the team decides how far to contain, who approves it and what it will cost the business, with the evidence available.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Incident lead appointed\nContainment decision recorded with who approved it\nPermission changes reviewed, not only the keys",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The incident log and the containment decision.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Meet the DORA reporting stages",
        "statement": "The team classifies the incident and meets the initial, intermediate and final reporting stages with content that matches what is known.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Classification recorded with time and reasons\nInitial notification and intermediate report sent on time\nFinal report assigned",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The classification record and the draft reports.",
        "regulatory_requirement_ids": [
          "DORA-19"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Bring the AI assistant into the response",
        "statement": "The team treats the AI assistant and its connected sources as part of the incident: it finds an owner, what they expose and a decision on keeping it online.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Owner identified\nConnected sources listed\nDecision on keeping it online recorded and users told",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The list of sources and the decision.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-04",
        "title": "Rotate secrets in a safe order",
        "statement": "The team removes the actor's way back in and rotates exposed secrets in an order that protects critical services.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Way back in removed and other roles reviewed\nDependencies of each secret known before rotating\nRotation order agreed with service owners",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The rotation plan.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-05",
        "title": "Notify and tell one consistent story",
        "statement": "With data confirmed out, the team decides on the GDPR notification and gives regulators, customers, staff and media messages that agree with the facts.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Risk to the people affected assessed\nNotification decision recorded with reasons\nHolding statement, customer reply and staff message aligned",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "The breach assessment and the messages.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "A real incident happens during the session.",
        "mitigation": "Anyone can stop the exercise with the stop keyword."
      },
      {
        "risk": "The debate drifts into general AI policy.",
        "mitigation": "The Facilitator brings the table back to the decision in front of it."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Poisoned package",
    "summary": "{organization} is a financial entity whose development teams, internal AI assistant and production databases run on {cloud_platform}. What starts as an alert on one workstation becomes, over six days, a reportable major incident and a personal data breach.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 10,
    "phases": [
      {
        "code": "PH-01",
        "name": "The package",
        "start_offset": 0,
        "end_offset": 30,
        "incident_jump_minutes": 0,
        "situation_update": "Day 1, 09:00. An ordinary morning for the development teams at {organization}.",
        "key_questions": [
          "How do we know who else installed it?",
          "Who can lock out a whole team, and on what evidence?"
        ],
        "objectives": [],
        "headline": "A routine dependency update goes wrong"
      },
      {
        "code": "PH-02",
        "name": "The stolen keys",
        "start_offset": 30,
        "end_offset": 60,
        "incident_jump_minutes": 0,
        "situation_update": "Day 1, a few hours later. The investigation has moved from the workstation to {cloud_platform}.",
        "key_questions": [
          "When does the DORA clock start for us, and who says so?",
          "What did the keys change, beyond what they read?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Stolen keys in use in production"
      },
      {
        "code": "PH-03",
        "name": "The assistant talks",
        "start_offset": 60,
        "end_offset": 95,
        "incident_jump_minutes": 2400,
        "situation_update": "Day 3. The team reviews what the actor did before its access was cut.",
        "key_questions": [
          "Who owns {ai_assistant} during an incident?",
          "Did anyone review what its sources would reveal?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "The internal chatbot gives away the map"
      },
      {
        "code": "PH-04",
        "name": "Secrets in the code",
        "start_offset": 95,
        "end_offset": 125,
        "incident_jump_minutes": 2400,
        "situation_update": "Day 5. Access was cut, but the actor is still reaching the environment.",
        "key_questions": [
          "What breaks if we rotate this secret now?",
          "Who decides the order when two services compete?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "A way back in, and credentials in the scripts"
      },
      {
        "code": "PH-05",
        "name": "The data leaves",
        "start_offset": 125,
        "end_offset": 160,
        "incident_jump_minutes": 1000,
        "situation_update": "Day 6. The logs from the last few hours are in.",
        "key_questions": [
          "What do we know for certain, and what can we say today?",
          "Who speaks to each audience, and in what order?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "Customer data is out and everyone is asking"
      },
      {
        "code": "PH-06",
        "name": "The aftermath",
        "start_offset": 160,
        "end_offset": 180,
        "incident_jump_minutes": 30240,
        "situation_update": "Three weeks later. The incident is closed and the final report is being drafted.",
        "key_questions": [
          "Which decision would we take again?",
          "Which improvement comes first?"
        ],
        "objectives": [],
        "headline": "The account to the board and the forensic report"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Unidentified actor",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Financially motivated actor behind the poisoned package, moving from a developer's workstation to the cloud and to production data.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1580"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1619"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1098.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1530"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1074.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567"
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
        "title": "A dependency that reads too much",
        "content": "Endpoint protection flags a developer's workstation at {organization}. Minutes after an open-source dependency was updated, its install script ran, used the AI coding assistant on the machine to search local files and wrote an inventory of keys, tokens and configuration files. An outbound connection to an unknown host followed. The package version is in the team's shared lockfile, so others may have pulled it too.",
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
          "Engineering",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Isolates the workstation and keeps a forensic copy before anyone rebuilds it.",
            "responsible_role": "Security operations",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Lists who installed that package version and whether any build pipeline used it.",
            "responsible_role": "Engineering",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Opens an incident and appoints an incident lead.",
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
        "code": "POL-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "How far to contain",
        "content": "You can't yet tell who ran the package.",
        "offset_minutes": 18,
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
        "poll_question": "The package is in a shared lockfile and you don't know who ran it. How far do you contain?",
        "poll_options": [
          "Isolate the workstation, lock out the whole development team and make them all sign in again",
          "Isolate only that workstation and rotate the credentials stored on it",
          "Block the package across the organization and pause builds until the lockfile is clean",
          "Leave the workstation online under watch to see what the actor does next"
        ],
        "poll_outcomes": [
          "Every path you can see closes, including those of colleagues who pulled the same version. The team stops work and resents it, but nothing reaches the outside.",
          "Proportionate and quick, and development carries on. Any colleague who pulled the package stays exposed until someone finds them.",
          "The spread stops at the source and the lockfile gets fixed. Releases slip for every team, and what was already stolen stays stolen.",
          "You learn where the actor is going, but you leave a live thief on the network and will have to explain that choice to the supervisor."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 3,
            "m2": 2,
            "m3": 2,
            "m4": 1
          },
          {
            "m2": 3,
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Stolen keys in use in {cloud_platform}",
        "content": "The inventory left on the workstation lists long-lived {cloud_platform} access keys, and they are already in use. Audit and threat detection logs place the calls behind a commercial VPN. The caller has listed storage buckets, read and changed permission policies, and enumerated AI agents and knowledge bases, which led it to {ai_assistant}, an internal chatbot these credentials can reach. Unauthorised access to production is confirmed.",
        "offset_minutes": 35,
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
          "Incident lead",
          "Cloud platform team",
          "Compliance",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1580"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1619"
          }
        ],
        "facilitator_notes": "DORA: initial notification within 4 hours of classifying the incident as major and at most 24 hours after detection. A4 plants the persistence the team finds on day 5.",
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Classifies the incident under DORA and records when and why.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Sends the initial notification to the financial supervisor within the deadline.",
            "responsible_role": "Compliance",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A3",
            "description": "Decides how to cut the actor's access and who approves it.",
            "responsible_role": "CISO",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A4",
            "description": "Reviews every permission change made with the keys, not only their reads.",
            "responsible_role": "Cloud platform team",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "The national CSIRT asks",
        "content": "We are seeing a malicious version of an open-source package in several financial entities, with stolen cloud keys used shortly afterwards. Have you been affected? If so, please confirm that your supervisor has been informed.",
        "offset_minutes": null,
        "trigger_condition": "No initial notification 15 minutes after INJ-03.",
        "contingent_purpose": "Bring the reporting clock back to the table.",
        "fires_at_minute": 20,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Incident lead",
          "Compliance"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Answers the CSIRT and records the time of the notification to the supervisor.",
            "responsible_role": "Compliance",
            "expected_within_minutes": 8,
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
        "code": "POL-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "The first move in the cloud",
        "content": "The keys are being used right now.",
        "offset_minutes": 48,
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
        "poll_question": "The stolen keys are active and the actor is exploring. What is your first move in {cloud_platform}?",
        "poll_options": [
          "Disable the stolen keys and force every user in the organization to change credentials",
          "Block the VPN addresses with a deny rule",
          "Hire an external forensic firm to map what the identities can reach and look for persistence",
          "Revoke only those keys, turn on storage and database monitoring, and watch"
        ],
        "poll_outcomes": [
          "The actor loses those keys at once. The whole company feels it, the service desk is overwhelmed, and people start asking why.",
          "Fast and cheap, and it feels like action. A commercial VPN has plenty of other exits, so the actor is back within the hour.",
          "You will know the blast radius, and any trail of persistence. It takes days and money, and the keys stay live while the firm gets started.",
          "A proportionate response that leaves you with visibility. There is a real chance the actor moves on to something else before the new monitoring sees it."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 3,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "{ai_assistant} handed over the map",
        "content": "Whatever was cut on day 1, the logs show the actor reached {ai_assistant} first. Its model invocation logs hold long sessions of prompts that coaxed it, step by step, into quoting pages from {internal_wiki}, connected as a knowledge source: hostnames, endpoints and schemas of {customer_database} and {finance_database}. Those pages held no passwords and no data has left yet, but the actor now has a map of production.",
        "offset_minutes": 65,
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
          "AI assistant owner",
          "CISO",
          "Compliance",
          "Incident lead"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213"
          }
        ],
        "facilitator_notes": "DORA: intermediate report within 72 hours of the initial notification. There is no ATT&CK technique for coaxing a chatbot; the one marked covers reading the knowledge behind it.",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Lists every source connected to {ai_assistant} and what each one exposes.",
            "responsible_role": "AI assistant owner",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decides whether {ai_assistant} stays online and tells its users.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Sends the intermediate report to the supervisor with the new scope.",
            "responsible_role": "Compliance",
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
        "code": "POL-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "What to do with the assistant",
        "content": "The actor holds the route to production but no credentials yet.",
        "offset_minutes": 80,
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
        "poll_question": "{ai_assistant} has given away the map of production, and staff rely on it. What do you do?",
        "poll_options": [
          "Switch it off and restrict access to its knowledge base and data source",
          "Keep it running and disconnect {internal_wiki} and the source that leaked",
          "Buy and deploy dedicated monitoring for misuse of AI on it",
          "Limit the knowledge base to what it needs and add prompt and output filters"
        ],
        "poll_outcomes": [
          "The leak stops immediately. Staff lose a tool they use all day, and shadow AI use starts within hours.",
          "Service continues and the known source is shut. Other connected sources remain unreviewed, so the fix is only as good as your inventory.",
          "You gain real visibility with little strain on the team. Buying a new product under pressure is expensive and slow, and the actor isn't waiting.",
          "The right long-term design. It takes careful work from an overloaded team, and filters can be bypassed by someone already practised at it."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 1,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "A way back in and secrets in the scripts",
        "content": "The actor has no key of its own any more and is still getting in. Going back through the day 1 permission changes, the team finds an external account added to the trust policy of a deployment role, which the actor assumes when it wants. From there it ran a secret scanner over the buckets holding deployment scripts and infrastructure as code, and found hard-coded secrets, database credentials among them. Interim updates to the supervisor and the national CSIRT are going out on schedule.",
        "offset_minutes": 100,
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
          "Cloud platform team",
          "Engineering",
          "Incident lead",
          "Compliance"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1098.003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Removes the external account from the trust policy and reviews every other role.",
            "responsible_role": "Cloud platform team",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Lists what each exposed secret feeds before it is rotated.",
            "responsible_role": "Engineering",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-08-A3",
            "description": "Decides the rotation order with the service owners, putting {customer_database} and {finance_database} first.",
            "responsible_role": "Incident lead",
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
        "code": "POL-09",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "How to rotate the secrets",
        "content": "Cutting the wrong secret can stop a service.",
        "offset_minutes": 113,
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
        "poll_question": "Secrets are spread across scripts and templates, and nobody knows all they feed. How do you rotate them?",
        "poll_options": [
          "Rotate every secret in the organization at once and lock down database access",
          "Rotate the database credentials and the secrets found so far, and sweep the repositories later",
          "Bring in a recovery firm to sweep every repository, bucket and template, and rotate in sequence with your team",
          "Move the internal team to round-the-clock shifts and hunt by hand"
        ],
        "poll_outcomes": [
          "The door closes hardest and fastest. Services you didn't know depended on those secrets fail, and customers notice.",
          "The known exposure closes cheaply. Unknown secrets stay valid until the sweep nobody has scheduled yet.",
          "Rotation in order keeps critical services up, at a substantial cost. The sequence is slow, and the actor can reach a credential before its turn.",
          "No invoice, and full ownership. Tired people make mistakes, the hunt is slow, and your best engineers will remember this month."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 3,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 3,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "The data is out",
        "content": "One database credential was used before its rotation took effect, with activity on {customer_database} and {finance_database}. Storage logs show production data, customers' personal data and financial records copied into a bucket, a pre-signed URL generated, and the files fetched from an external address. Interim notifications are up to date and the DORA final report is due within a month. This is now a personal data breach, and the GDPR deadline applies.",
        "offset_minutes": 128,
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
          "Incident lead",
          "Data protection officer",
          "Legal",
          "Compliance",
          "Crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1530"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1074.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567"
          }
        ],
        "facilitator_notes": "GDPR: notify the authority within 72 hours of becoming aware, and tell the people affected without undue delay when the risk to them is high. DORA: final report within one month of the intermediate report.",
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Assesses the risk to the people affected and decides on notifying the data protection authority.",
            "responsible_role": "Data protection officer",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Confirms what left, from which systems and how many people it covers.",
            "responsible_role": "Incident lead",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-10-A3",
            "description": "Assigns the DORA final report and its date.",
            "responsible_role": "Compliance",
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
        "phase_code": "PH-05",
        "kind": "contingent",
        "title": "Counsel asks for the decision",
        "content": "The 72 hours started when you confirmed the breach. If you decide not to notify, we need the reasons on record. If you do notify, a first notice can go now and be completed in stages. Which is it?",
        "offset_minutes": null,
        "trigger_condition": "No decision on notifying the authority 10 minutes after INJ-10.",
        "contingent_purpose": "Force the notification decision.",
        "fires_at_minute": 14,
        "branch_from_code": "INJ-10",
        "branch_action_code": "INJ-10-A1",
        "rejoin_code": "POL-15",
        "sender_code": "ACT-05",
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
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Records the notification decision and its reasons.",
            "responsible_role": "Data protection officer",
            "expected_within_minutes": 8,
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
        "code": "INJ-12",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "The press asks for comment",
        "content": "Sources tell me {organization} has suffered a breach involving customer data. Can you confirm? I'm filing this afternoon and would like your comment before 16:00.",
        "offset_minutes": 134,
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
          "Communications",
          "Legal"
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
            "code": "INJ-12-A1",
            "description": "Agrees a holding statement with Legal that only says what is confirmed.",
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
          "sender": "Technology correspondent",
          "sender_address": "newsdesk@press.example.org",
          "recipient": "Press office",
          "subject": "Request for comment: possible data breach",
          "timestamp": "Day 6, 11:40",
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
        "code": "INJ-13",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Two enterprise customers want answers",
        "content": "We've heard about a security incident at {organization}. Our risk team needs written confirmation today of whether our data is affected, and what you are doing about it. A second corporate customer has sent the same request.",
        "offset_minutes": 138,
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
          "Communications",
          "Incident lead"
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
            "code": "INJ-13-A1",
            "description": "Assigns one owner for customer replies and aligns them with what regulators are told.",
            "responsible_role": "Communications",
            "expected_within_minutes": 12,
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
          "sender": "Head of vendor risk, enterprise customer",
          "sender_address": "vendor.risk@customer.example.com",
          "recipient": "Account manager",
          "subject": "Urgent: confirmation about our data",
          "timestamp": "Day 6, 12:05",
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
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Staff are talking",
        "content": "Is it true we've been hacked? My team can't use the chatbot, the developers have been up all night, and a customer has just asked me about it. What are we meant to say?",
        "offset_minutes": 142,
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
          "Communications",
          "Crisis committee"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Sends staff an internal message with what to say and where to send questions.",
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
          "kind": "chat_message",
          "sender": "Colleague",
          "sender_address": "",
          "recipient": "",
          "subject": "",
          "timestamp": "Day 6, 12:20",
          "location": "#general"
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
        "code": "POL-15",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "How to tell the world",
        "content": "Regulators, customers, staff and the press are all waiting.",
        "offset_minutes": 150,
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
        "poll_question": "The data is out and every audience is asking. How do you run the communication?",
        "poll_options": [
          "Tell regulators, the people affected, customers, staff and media at once through one spokesperson, and offer credit monitoring",
          "File everything the law requires and say nothing more than a short line if asked",
          "Set up crisis communications with external counsel, confirm what left, then inform each audience in turn",
          "Notify as required, say publicly that the incident is contained, and return to business as usual"
        ],
        "poll_outcomes": [
          "Transparent and early, and customers respect it. Details you announced will change, and every correction costs credibility.",
          "Legally tidy and cheap. The press tells the story instead, and customers read about it before they hear from you.",
          "Every statement stays accurate. The firm and counsel are expensive, the forensic work squeezes the team again, and for a short while you say nothing publicly.",
          "It sounds calm for a day. If the actor publishes, or the regulator disagrees, 'contained' becomes the headline."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m3": 3,
            "m4": 2,
            "m5": 3
          },
          {
            "m1": 1,
            "m3": 2,
            "m4": 3,
            "m5": 1
          },
          {
            "m1": 1,
            "m3": 3,
            "m4": 2,
            "m5": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 3
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-16",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "The account to the board",
        "content": "Three weeks on, the board chair asks for a plain account: what the incident cost, what customers think of us now, what regulators will ask, and how long the damage will last. Which of your decisions held up, and which would you take differently?",
        "offset_minutes": 163,
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
          "CEO",
          "Crisis committee"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Use the tally from the polls. If budget and team stress ended high, customers may have stayed but the recovery will take several quarters and people may leave. If threat actor risk stayed high, ask what is still open. If legal and brand ended high, start with what was said publicly. There is no perfect path: every option bought something and cost something.",
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
        "code": "DSC-17",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "The forensic report",
        "content": "The forensic firm presents the attack path: a poisoned package on a developer's workstation, stolen keys, a changed trust policy, {ai_assistant} and {internal_wiki}, hard-coded secrets, the production databases, and the data leaving through a pre-signed URL. At which step could the organization have stopped it most cheaply, and what has to change first?",
        "offset_minutes": 171,
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
          "Incident lead",
          "Crisis committee"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Walk the diagram step by step and note the improvements for the after-action report: dependency pinning and review, short-lived cloud credentials, an owner and a source review for every AI assistant, secret scanning in pipelines, alerts on trust policy changes.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [
          {
            "image": "IMG-01",
            "caption": "Fictitious attack path, for exercise use only."
          }
        ],
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
    "next_phase_number": 7,
    "next_inject_number": 18,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Disruption"
      },
      {
        "key": "m2",
        "name": "Threat actor risk"
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
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-03",
      "name": "National CSIRT",
      "type": "csirt",
      "description": "The national incident response team: asks for reports and shares indicators.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "financial-supervisor",
      "origin_name": "Financial supervisor",
      "code": "ACT-04",
      "name": "Financial supervisor",
      "type": "authority",
      "description": "The financial-sector supervisor receiving major ICT incident reports.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "External legal counsel",
      "code": "ACT-05",
      "name": "External legal counsel",
      "type": "other",
      "description": "Outside lawyers advising on notifications, liability and communications.",
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
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Customer",
      "code": "ACT-07",
      "name": "Customer",
      "type": "customer",
      "description": "A customer noticing the impact and asking for explanations.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Employee",
      "code": "ACT-08",
      "name": "Employee",
      "type": "internal",
      "description": "An employee reporting something odd -- or the insider behind it.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Board chair",
      "code": "ACT-09",
      "name": "Board chair",
      "type": "internal",
      "description": "The chair of the board when the board isn't playing: demands answers and calls meetings.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 10,
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
      "origin_id": "dora",
      "origin_name": "DORA",
      "name": "DORA",
      "color": "slate",
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
      "origin_id": "crisis-committee",
      "origin_name": "Crisis committee",
      "name": "Crisis committee",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [
    {
      "key": "IMG-01",
      "content_type": "image/png",
      "data": "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"
    }
  ],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1,
  "files": []
}
```
