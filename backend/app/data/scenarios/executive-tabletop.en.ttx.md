---
format: "ttx-zone.scenario"
format_version: 1
language: "en"
title: "Executive tabletop: trusted access"
exported_at: "2026-10-12T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Executive tabletop: trusted access

This is an executive tabletop exercise. It simulates a high-impact cyber crisis that hits a global company in the different countries and environments at the same time. The scenario starts with the compromise of an IT supplier, escalates into a large-scale data leak, and ends with a ransomware attack that disrupts both corporate and operational (OT) environments, with a mix of nation-state and cybercriminal threat actors. The exercise does not test technical containment. Its purpose is to train senior leadership to govern a cross-border crisis under uncertainty. That means making critical decisions under pressure, clarifying roles, authority and escalation paths, testing coordination between countries and business areas, managing regulators, shareholders, the media and customers, and exposing gaps in crisis governance. The key message for the Board is simple: a cyber incident is no longer an IT problem. It is a governance problem.

> TTX-Zone scenario. Import it from Library → Scenarios. The readable part below is generated on export; only the data block at the end is imported.

## Objectives

- **OBJ-01** Group-level crisis escalation criteria
- **OBJ-02** Decisions with owner, time box and rationale
- **OBJ-03** OT isolation decision
- **OBJ-04** Single command across entities
- **OBJ-05** Notification matrix and common holding statement

## Scenario

It is **Sunday 3 May, 08:00**. A quiet weekend morning across the Group: {group_name} (Group functions), {company_1} and {company_2}.

Overnight, the Group Security Operations Centre detected **unusual login activity** linked to a contractor from **{supplier}**, the Group’s IT services provider, with **privileged access across the entire Group** in {country_1} and {country_2}.

The Crisis Management Team has just received a **formal incident notification** and a request for an **emergency call within the hour**. _Information is incomplete and will keep changing._

Your role is to **lead the Group’s response as you would on a real day**, using your current plans, authority and processes. Accept the scenario as presented, and **focus on the decisions only you can make**.

## Phases and injects

### PH-01 Initial escalation

Sunday 3 May, 08:00. At 05:00 the SOC detected an “impossible travel” alert: {supplier} contractor {person_1} logged in from {country_1} and then from another country 25 minutes later, using a password found in a known breach database. Similar alerts are appearing for other {supplier} accounts. {supplier} admits it was breached six months ago and never told us. Attackers may have access to corporate IT in {country_1} and {country_2}, including the {project_1} laptop deployment (2,600 devices). The Group CISO has formally notified the Crisis Management Team and requested an emergency call within the hour.

- **INJ-01** (T+0′) Crisis Management activation request – suspicious {supplier} account activity
- **INJ-12** (contingent) {supplier} – request for a single point of contact

### PH-02 Data compromise

{ir_provider}’s incident response retainer has been activated. Forensics confirm the compromised account was used to covertly exfiltrate about 100 GB over six months: confidential Legal documents from {group_name} (M&A plans, compliance reports), customer personal data from {company_2} and {company_1}, and SCADA network diagrams for {business_d}. No public leak has been detected. The full extent and the attacker’s intent are unknown, and the risk of extortion is high.

- **INJ-02** (T+15′) {ir_provider} IR – 100 GB exfiltrated over six months

### PH-03 Ransomware and OT crisis

Ransomware hits {country_1} and {country_2} simultaneously. IT systems are down in both countries, including the 2,600 {project_1} laptops {person_1} managed. {control_centre_1} has lost connection with three renewable plants: the attack has crossed into OT. Backup failover is not confirmed and backup integrity is unknown. Ransom demand: €20M within 48 hours. The SOC warns that {business_d} and {business_b} may be encrypted next. No single team has full visibility across IT and OT.

- **INJ-03** (T+30′) Ransomware across {country_1} and {country_2} – OT affected, €20M demand
- **INJ-13** (contingent) {business_d} control room – conflicting instructions, decision needed now

### PH-04 Public and regulatory pressure

The crisis is now public. The national CSIRT of {country_1} requests a formal incident notification, the scope of impact and evidence of containment. {grid_operator} wants immediate reassurance that grid stability is not at risk, and says {business_d}’s decisions will be judged from a national-interest perspective. Customers in {country_1} and {country_2} are filing complaints and threatening contractual penalties. Shareholders are demanding explanations through Investor Relations and Board channels. {country_1} and {country_2} messaging is not yet aligned.

- **INJ-04** (T+50′) National CSIRT ({country_1}) – formal request for incident notification
- **INJ-05** (T+52′) {grid_operator} control room – grid stability reassurance
- **INJ-06** (T+55′) Investor Relations – customer complaints and shareholder pressure

### PH-05 Attribution: nation-state meets eCrime

{ir_provider} has delivered a root cause analysis. Six months ago, PIONEER KITTEN, an Iranian-aligned nation-state group, exploited the VPN appliance at {supplier} and kept long-term access. This week, that access was sold or handed to SCATTERED SPIDER, a criminal group that deployed the ransomware and issued the €20M demand. State-sponsored actors enabled it; criminals executed it.

- **INJ-07** (T+65′) Attribution – nation-state meets eCrime

### PH-06 Data leak

Our dark web monitoring service has found a proof-of-life dump on a well-known leak site. The Group SOC/CSIRT and the {country_1} and {country_2} CSIRTs have confirmed the samples are authentic: customer records ({group_name} and {company_2}), confidential corporate documents and SCADA diagrams referencing {business_d}. Within hours, media in {country_1} and {country_2} report it: customer data exposed, critical infrastructure diagrams leaked, a nation-state-linked attack.

- **INJ-08** (T+75′) Proof-of-life data dump confirmed on leak site
- **INJ-09** (T+80′) Media in {country_1} and {country_2} report the leak

### PH-07 Executive decision

All backups are compromised; the last clean recovery point is a tape backup from six months ago. Option 1, pay €20M: 2–3 days to recover, no guarantee, possible sanctions exposure, sets a precedent. Option 2, rebuild clean: 14–21 days, guaranteed clean environment, high cost and sustained pressure. Option 3, hybrid: 10–14 days, selective restoration, residual risk, harder to explain to regulators and media. The ransom deadline is approaching.

- **INJ-10** (T+95′) Executive decision required – recovery options
- **INJ-14** (contingent) Attacker message – 6 hours left, threat to {control_centre_1}

### PH-08 Post-incident reflection

Tuesday 5 May, 14:00. The crisis response phase is over and recovery is underway. Reflect on your own leadership, decision-making and governance during this exercise, not on the technical or operational response.

- **DSC-11** (T+120′) Post-incident – executive reflection

## Simulated actors

- **ACT-08** Group CISO
- **ACT-09** Group SOC
- **ACT-10** {ir_provider} IR
- **ACT-02** National CSIRT ({country_1})
- **ACT-03** {grid_operator}
- **ACT-11** Investor Relations
- **ACT-04** Media ({country_1} & {country_2})
- **ACT-12** Board of Directors
- **ACT-05** {supplier}
- **ACT-13** {business_d} control room
- **ACT-07** Scattered Spider

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 1,
  "language": "en",
  "exported_at": "2026-10-12T00:00:00Z",
  "exercise": {
    "name": "Executive tabletop: trusted access",
    "description": "This is an executive tabletop exercise. It simulates a high-impact cyber crisis that hits a global company in the different countries and environments at the same time. The scenario starts with the compromise of an IT supplier, escalates into a large-scale data leak, and ends with a ransomware attack that disrupts both corporate and operational (OT) environments, with a mix of nation-state and cybercriminal threat actors. The exercise does not test technical containment. Its purpose is to train senior leadership to govern a cross-border crisis under uncertainty. That means making critical decisions under pressure, clarifying roles, authority and escalation paths, testing coordination between countries and business areas, managing regulators, shareholders, the media and customers, and exposing gaps in crisis governance. The key message for the Board is simple: a cyber incident is no longer an IT problem. It is a governance problem."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_or_revised_plan",
      "regulatory"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR",
      "CER",
      "NCCS",
      "UK_NIS"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "crisis_decision_making",
      "internal_external_comms",
      "cross_unit_coordination"
    ],
    "levels": [
      "strategic"
    ],
    "participating_areas": [
      "Group Executive Leadership",
      "Group Finance",
      "General Secretary and Board Secretariat",
      "Group Customers Business",
      "Group Networks",
      "Group Power",
      "Group IT",
      "Group Security",
      "Group Cybersecurity",
      "{company_1} Leadership",
      "External Communications ({country_1})",
      "{company_2} Leadership",
      "{business_d}",
      "{business_e}"
    ],
    "third_parties": [],
    "perimeter": "- Entities: {group_name} (Group functions); {company_1} ({business_a}, {business_b}, {business_c}); {company_2} (Customer Business, {business_d}, {business_e}).\n- Countries: {country_1} and {country_2}.\n- Systems (at business-impact level): corporate IT, customer data, and OT supporting distribution networks and generation, plus the compromised IT supplier ({supplier}).\n- Processes: crisis escalation and activation, executive decision-making, cross-entity coordination, regulatory notification, and communication with media, customers, investors and authorities.",
    "out_of_scope": "- Technical containment, forensics, eradication and recovery of IT and OT systems.\n- SOC/CSIRT operational procedures and security tooling.\n- Group businesses and countries outside {country_1} and {country_2} (the rest of the group's footprint).\n- Real contact with regulators, authorities, the supplier or the media (all simulated by facilitators).\n- Ransom negotiation tactics and payment mechanics.\n- Evaluation of individual performance (the exercise assesses the organisation, not people).",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "- Scenario, injects and attack path are confidential: shared only with facilitators and the exercise control team until the session. \n- Participants receive no advance details of the scenario.\n- No real vulnerabilities, IOCs, customer data or live incident information are used. The supplier ({supplier}) and all external parties are fictitious or simulated.\n- Session outputs (decision logs, observer notes, after-action report) are classified [Confidential / TLP:AMBER+STRICT] and distributed only to participants and named Group stakeholders.\n- Audio recording is desirable for post-evaluation purposes.\n- The report assesses the organisation, not individuals. No attribution of individual performance.\n- {ir_provider} works under the existing NDA / services agreement.",
    "budget_and_external_support": "- External support: {ir_provider} designs and facilitates the exercise (lead facilitator: {person_2}; co-facilitator: {person_3}), with internal facilitation support from the Group Security Operations Centre.\n- Budget: Part of services included in {ir_provider}'s incident response retainer. Except for the expenses that will be invoiced separately.",
    "stop_exercise_keyword": "REAL WORLD",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Cross-functional decision-making and accountability",
        "finding": "When Legal, Comms, Networks, Customers, IT and Finance are all involved, it’s unclear who decides, who is consulted and who is accountable for the outcome. This delays or dilutes key decisions such as paying a ransom, disconnecting OT or notifying regulators.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Coordinated cross-country response",
        "finding": "Each country runs its own processes and deals with its own regulators. There is no single chain of command or unified narrative. This creates a risk of contradictory messages and decisions towards regulators and the media.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "Escalation paths and crisis threshold",
        "finding": "There’s no clear definition of when an incident becomes a Group-level crisis or who triggers that switch. This delays the involvement of senior leadership.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-04",
        "source": "incident_history",
        "title": "Business decisions in IT/OT incidents",
        "finding": "Leadership has no agreed criteria for deciding whether to isolate or keep running grid and generation systems when an attack spreads from IT to OT. Safety, continuity of supply and regulatory exposure are all at stake.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-05",
        "source": "regulatory",
        "title": "Regulatory notification and stakeholder management",
        "finding": "Deadlines and messaging. Notification deadlines (NIS2, local regulators, data protection) have to be met in parallel, with incomplete information, while also managing shareholders, media and customers. This creates both regulatory and reputational risk.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-06",
        "source": "incident_history",
        "title": "Decision-making under uncertainty",
        "finding": "Acting without all the facts. Leadership tends to wait for technical certainty before deciding, and in a crisis that means missing the window to act. Decisions also need to be defensible afterwards.",
        "affected_capability": "crisis_decision_making",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Group-level crisis escalation criteria",
        "statement": "Participants apply explicit criteria to decide whether the incident becomes a Group-level crisis, name who (by role) triggers the activation, and state who must be informed at Group level, in {country_1} and in {country_2}.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-03",
          "NEED-06"
        ],
        "success_criterion": "An escalation decision is taken\nA single role is named as the one who triggers the activation\nThe criteria used are stated (from existing policy or agreed on the spot)",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "All three conditions are met before PH-01 ends.",
        "partially_achieved": "A decision is taken but the trigger role or the criteria are unclear, or the lead is only named after the contingent inject in which {supplier} asks for a single point of contact",
        "not_achieved": "No escalation decision before PH-01 ends",
        "evidence": "Timestamp of the inject and of the decision, the role named as trigger, criteria referenced (and whether they come from an existing policy), stakeholders notified, and observer notes on hesitation or disputes over ownership.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "ISO27001-A5-24",
          "ISO27035-2",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Decisions with owner, time box and rationale",
        "statement": "The crisis committee takes each key crisis decision with one named decision owner, within its time box, and with a documented rationale, even when information is incomplete. Key decisions in this exercise are: (1) position on the ransom demand, (2) public disclosure of the data leak, and (3) notification of and engagement with law enforcement and national authorities.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01",
          "NEED-06"
        ],
        "success_criterion": "Owner: a single named individual (by role) is accountable for the decision. A committee or a group of functions does not count.\nTime box: the decision is taken before the end of the phase where it is due (law enforcement: PH-05; public disclosure: PH-06; ransom: PH-07).\nRationale: the reasons and the main assumptions about missing information are stated and recorded.\nDeferral: a decision may be deferred only if it has a named owner, a specific deadline and the information needed to decide. An open-ended deferral counts as not achieved.",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Only if all three key decisions meet all of the conditions.",
        "partially_achieved": "2 of 3 decisions meet all conditions",
        "not_achieved": "1 or none",
        "evidence": "Decision log completed by the observer for each key decision. It records: triggering inject and timestamp, decision taken (or deferral terms), decision owner, functions consulted, rationale, assumptions, and time elapsed. Observers also note any disagreement over ownership and how it was resolved.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "ISO22301-8-5",
          "CER-13"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "OT isolation decision",
        "statement": "Leadership decides whether to isolate or keep running grid and generation systems, explicitly weighing safety, continuity of supply and regulatory exposure, and the OT business owner (Networks/Power) formally owns the decision.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01",
          "NEED-04"
        ],
        "success_criterion": "A decision is taken (isolate, partially isolate or keep running)\nIt is owned by the relevant OT business owner by role\nAll three dimensions are explicitly discussed",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "All three conditions are met before PH-03 ends.",
        "partially_achieved": "A decision is taken but one dimension is ignored, the owner is unclear, or the decision only comes after the contingent inject in which the {business_d} control room asks for a business decision",
        "not_achieved": "No decision, or the decision is left to IT/Security alone",
        "evidence": "Decision record with option chosen, owner, trade-offs considered for each dimension, conditions for reversing the decision, dissenting views, and time elapsed.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "CER-13",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "Single command across entities",
        "statement": "{group_name} (Group functions), {company_1} and {company_2} agree on a single chain of command, a common position and a coordination cadence, while each entity meets its local regulatory obligations.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "One Group-level lead is named by role before PH-01 ends\nThe decision rights of each entity are stated (what is decided locally and what by Group) before PH-04 ends\nA coordination cadence is agreed before PH-04 ends\nNo contradictory decisions or messages between entities occur for the rest of the exercise",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Time boxes are tied to phases, as each condition states.",
        "partially_achieved": "Structure agreed but one or more contradictions occur later",
        "not_achieved": "No single lead agreed",
        "evidence": "Command structure as stated by participants, decision rights per entity, agreed cadence, and an observer log of every contradiction between entities (with timestamp and how it was resolved).",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C",
          "NCCS-CRISIS",
          "UK-NIS-CAF-D1"
        ]
      },
      {
        "code": "OBJ-05",
        "title": "Notification matrix and common holding statement",
        "statement": "The committee identifies every applicable notification (regulators in all applicable countries, data protection authorities) with owners and deadlines, and approves a consistent holding statement for media, customers and investors.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-05",
          "NEED-06"
        ],
        "success_criterion": "A notification matrix covers each applicable regime with its owner by role, deadline and when the clock starts\nOne holding statement is approved by a named role and used by all entities",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "Both conditions are met before PH-06 ends.",
        "partially_achieved": "Matrix incomplete (one or more regimes missing) or statement not aligned between entities",
        "not_achieved": "No matrix or no approved statement",
        "evidence": "Notification matrix (regime, authority, owner, deadline, clock start), draft holding statement, approval timestamp and approver, and observer notes on regimes missed or deadlines misjudged.\nReference list observers check the matrix against: NIS2 (24 h early warning / 72 h notification), UK NIS (72 h), GDPR / UK GDPR (72 h, plus data subjects), CER (24 h).",
        "regulatory_requirement_ids": [
          "NIS2-23",
          "GDPR-33-34",
          "CER-15",
          "UK-NIS-11"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Scenario leak",
        "mitigation": "Share the scenario only with the planning team until the session. Mark all materials “EXERCISE – CONFIDENTIAL”."
      },
      {
        "risk": "Key decision-makers absent",
        "mitigation": "Confirm attendance through executive assistants 2 weeks before. Any stand-in must have real decision authority, and their attendance is recorded in the report."
      },
      {
        "risk": "A real incident coincides with the exercise",
        "mitigation": "Anyone says “REAL WORLD” and the exercise halts. The Group SOC monitors operations during the session and has a direct line to the CISO."
      },
      {
        "risk": "The session overruns its phases (PH-05 lasts only 10 minutes)",
        "mitigation": "Facilitators keep to the run sheet, close each phase with its key question and park open points for the debrief."
      },
      {
        "risk": "Discussion drifts into technical detail (containment, forensics), which is out of scope",
        "mitigation": "Facilitators redirect to the executive decision at stake; technical questions go to a parking lot answered in the debrief."
      },
      {
        "risk": "Participants challenge the realism of the scenario",
        "mitigation": "The opening briefing sets the ground rules: accept the scenario as presented, no-fault environment, focus on the decisions only executives can make."
      },
      {
        "risk": "Audio recordings or notes leave the controlled distribution",
        "mitigation": "Record only with consent announced at the opening; store recordings and notes as TLP:AMBER+STRICT and delete them once the after-action report is approved."
      }
    ],
    "next_need_number": 7,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Trusted access",
    "summary": "It is **Sunday 3 May, 08:00**. A quiet weekend morning across the Group: {group_name} (Group functions), {company_1} and {company_2}.\n\nOvernight, the Group Security Operations Centre detected **unusual login activity** linked to a contractor from **{supplier}**, the Group’s IT services provider, with **privileged access across the entire Group** in {country_1} and {country_2}.\n\nThe Crisis Management Team has just received a **formal incident notification** and a request for an **emergency call within the hour**. _Information is incomplete and will keep changing._\n\nYour role is to **lead the Group’s response as you would on a real day**, using your current plans, authority and processes. Accept the scenario as presented, and **focus on the decisions only you can make**.",
    "attack_version": "19.2",
    "duration_minutes": 140,
    "time_compression": 5,
    "phases": [
      {
        "code": "PH-01",
        "name": "Initial escalation",
        "start_offset": 0,
        "end_offset": 15,
        "incident_jump_minutes": 0,
        "situation_update": "Sunday 3 May, 08:00. At 05:00 the SOC detected an “impossible travel” alert: {supplier} contractor {person_1} logged in from {country_1} and then from another country 25 minutes later, using a password found in a known breach database. Similar alerts are appearing for other {supplier} accounts. {supplier} admits it was breached six months ago and never told us. Attackers may have access to corporate IT in {country_1} and {country_2}, including the {project_1} laptop deployment (2,600 devices). The Group CISO has formally notified the Crisis Management Team and requested an emergency call within the hour.",
        "key_questions": [
          "Is this a crisis under our Crisis Management Plan? What severity?",
          "Who leads the response across {country_1} and {country_2}: CISO, CSO or CIO?",
          "Who must be notified now, and through which channel?",
          "Do we cut all {supplier} access immediately, knowing the operational impact?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-04",
            "due": true
          }
        ]
      },
      {
        "code": "PH-02",
        "name": "Data compromise",
        "start_offset": 15,
        "end_offset": 30,
        "incident_jump_minutes": 0,
        "situation_update": "{ir_provider}’s incident response retainer has been activated. Forensics confirm the compromised account was used to covertly exfiltrate about 100 GB over six months: confidential Legal documents from {group_name} (M&A plans, compliance reports), customer personal data from {company_2} and {company_1}, and SCADA network diagrams for {business_d}. No public leak has been detected. The full extent and the attacker’s intent are unknown, and the risk of extortion is high.",
        "key_questions": [
          "Does this change the severity? Who chairs the Crisis Management Team?",
          "Do we notify regulators pre-emptively, or wait until there is a public leak?",
          "What are our legal obligations, with customer data stolen in two countries?",
          "Who owns the decision to involve law enforcement and national authorities?",
          "How do we protect legal privilege over the stolen M&A documents?"
        ],
        "objectives": [
          {
            "code": "OBJ-05",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ]
      },
      {
        "code": "PH-03",
        "name": "Ransomware and OT crisis",
        "start_offset": 30,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Ransomware hits {country_1} and {country_2} simultaneously. IT systems are down in both countries, including the 2,600 {project_1} laptops {person_1} managed. {control_centre_1} has lost connection with three renewable plants: the attack has crossed into OT. Backup failover is not confirmed and backup integrity is unknown. Ransom demand: €20M within 48 hours. The SOC warns that {business_d} and {business_b} may be encrypted next. No single team has full visibility across IT and OT.",
        "key_questions": [
          "Is this a cyber incident or a business continuity emergency, and who leads?",
          "{business_d} and {business_b}: do we shut down proactively, or keep operating and accept the risk?",
          "Do we authorise the {city_2} failover without verified integrity?",
          "What is our initial position on the ransom demand?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ]
      },
      {
        "code": "PH-04",
        "name": "Public and regulatory pressure",
        "start_offset": 50,
        "end_offset": 65,
        "incident_jump_minutes": 0,
        "situation_update": "The crisis is now public. The national CSIRT of {country_1} requests a formal incident notification, the scope of impact and evidence of containment. {grid_operator} wants immediate reassurance that grid stability is not at risk, and says {business_d}’s decisions will be judged from a national-interest perspective. Customers in {country_1} and {country_2} are filing complaints and threatening contractual penalties. Shareholders are demanding explanations through Investor Relations and Board channels. {country_1} and {country_2} messaging is not yet aligned.",
        "key_questions": [
          "What can we credibly tell the national CSIRT and {grid_operator} with our limited visibility?",
          "Who approves external communications across both countries?",
          "Are {country_1} and {country_2} aligned on incident classification, messaging and decision rationale?",
          "How do we manage shareholder messaging without triggering premature market disclosure?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": false
          }
        ]
      },
      {
        "code": "PH-05",
        "name": "Attribution: nation-state meets eCrime",
        "start_offset": 65,
        "end_offset": 75,
        "incident_jump_minutes": 0,
        "situation_update": "{ir_provider} has delivered a root cause analysis. Six months ago, PIONEER KITTEN, an Iranian-aligned nation-state group, exploited the VPN appliance at {supplier} and kept long-term access. This week, that access was sold or handed to SCATTERED SPIDER, a criminal group that deployed the ransomware and issued the €20M demand. State-sponsored actors enabled it; criminals executed it.",
        "key_questions": [
          "Does nation-state involvement change our response?",
          "Do we engage national security agencies in both countries as well as law enforcement?",
          "What are the insurance implications (nation-state or war exclusions)?",
          "Would paying a ransom to Iran-linked actors breach sanctions?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-06",
        "name": "Data leak",
        "start_offset": 75,
        "end_offset": 95,
        "incident_jump_minutes": 0,
        "situation_update": "Our dark web monitoring service has found a proof-of-life dump on a well-known leak site. The Group SOC/CSIRT and the {country_1} and {country_2} CSIRTs have confirmed the samples are authentic: customer records ({group_name} and {company_2}), confidential corporate documents and SCADA diagrams referencing {business_d}. Within hours, media in {country_1} and {country_2} report it: customer data exposed, critical infrastructure diagrams leaked, a nation-state-linked attack.",
        "key_questions": [
          "Do we issue a public breach notification now, or wait for legal consolidation?",
          "Who has final authority over public statements in {country_1} and {country_2}?",
          "What is our single narrative? Do we acknowledge nation-state involvement and OT exposure?",
          "What do we tell employees who are seeing the news before we brief them?"
        ],
        "objectives": [
          {
            "code": "OBJ-05",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-07",
        "name": "Executive decision",
        "start_offset": 95,
        "end_offset": 120,
        "incident_jump_minutes": 0,
        "situation_update": "All backups are compromised; the last clean recovery point is a tape backup from six months ago. Option 1, pay €20M: 2–3 days to recover, no guarantee, possible sanctions exposure, sets a precedent. Option 2, rebuild clean: 14–21 days, guaranteed clean environment, high cost and sustained pressure. Option 3, hybrid: 10–14 days, selective restoration, residual risk, harder to explain to regulators and media. The ransom deadline is approaching.",
        "key_questions": [
          "Final decision: pay, rebuild clean, or hybrid?",
          "Who decides (Group Board, local Boards, or CEO with delegated authority), and who is accountable?",
          "Is this one Group-wide decision or three entity decisions? If the entities disagree, who has the final say?",
          "How do we communicate the decision to regulators, media, employees and shareholders?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-08",
        "name": "Post-incident reflection",
        "start_offset": 120,
        "end_offset": 140,
        "incident_jump_minutes": 2640,
        "situation_update": "Tuesday 5 May, 14:00. The crisis response phase is over and recovery is underway. Reflect on your own leadership, decision-making and governance during this exercise, not on the technical or operational response.",
        "key_questions": [
          "Where did you feel most underprepared as an executive, and what needs to change?",
          "Which decisions took too long because governance or authority was unclear, and how do you fix that?",
          "What is the single most important investment you will make in the next 90 days as a result of this exercise?"
        ],
        "objectives": []
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0117",
        "origin_name": "Fox Kitten",
        "code": "THR-03",
        "name": "Fox Kitten",
        "mitre_group_id": "G0117",
        "aliases": [
          "UNC757",
          "Parisite",
          "Pioneer Kitten",
          "RUBIDIUM",
          "Lemon Sandstorm"
        ],
        "description": "Iranian IRGC-affiliated contractor group. Exploits the VPN appliance at {supplier} six months before the exercise, harvests the credentials of {supplier} administrator {person_1}, and keeps undetected access across {country_1} and {country_2}. Exfiltrates ~100 GB (M&A documents, customer data, {business_d} SCADA diagrams), then brokers the access to Scattered Spider as geopolitical tensions rise.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1190"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1087.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1039"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1560.001"
          }
        ]
      },
      {
        "origin": "system",
        "origin_id": "G1015",
        "origin_name": "Scattered Spider",
        "code": "THR-04",
        "name": "Scattered Spider",
        "mitre_group_id": "G1015",
        "aliases": [
          "Roasted 0ktapus",
          "Octo Tempest",
          "Storm-0875",
          "UNC3944"
        ],
        "description": "eCrime group (English-speaking). Receives the access package, adds persistence with remote access tools, disables security tools and backups, deploys ransomware across IT and OT in {country_1} and {country_2}, demands €20M in 48 hours and publishes proof-of-life data on a leak site.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1219.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1136"
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
            "technique_id": "T1657"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1685"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
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
        "title": "Crisis Management activation request – suspicious {supplier} account activity",
        "content": "Team,\n\nI am formally notifying you of a **confirmed cyber security incident** requiring your immediate attention.\n\n**What happened:** at **05:00 today** our SOC detected an \"impossible travel\" alert. {person_1}, a contractor from **{supplier}** (our IT services provider) with **privileged access across the entire {group_name} Group**, logged in from {country_1} and then from another country 25 minutes later. His password matches a known compromised database. Similar alerts are now appearing for **other {supplier} accounts**. When contacted, {supplier} admitted they were **breached six months ago**. They never told us.\n\n**What is at risk:** corporate IT systems in {country_1} and {country_2}, and the {project_1} laptop deployment project (**2,600 devices**, risk to {business_d}), across {group_name}, {company_1} and {company_2}.\n\nI am requesting an **emergency call within the next 60 minutes**. Do not discuss this incident outside secure channels. All external communications must go through **Legal and Communications**.\n\n_Group CISO_",
        "offset_minutes": 0,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-08",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Group Executive Leadership",
          "General Secretary and Board Secretariat",
          "Group Security",
          "Group Cybersecurity",
          "Group IT",
          "{company_1} Leadership",
          "{company_2} Leadership"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "SOC alert summary – impossible travel on {supplier} account",
          "List of {supplier} accounts with privileged access"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1133"
          }
        ],
        "facilitator_notes": "Watch for overlap between CISO, CSO and CIO. If no lead emerges by minute 10, fire C-01. Do not reveal data exfiltration yet.",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Decide whether the incident is a Group-level crisis and state the criteria used",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Name the single role that leads the response across {country_1} and {country_2}",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-01-A3",
            "description": "Agree who is notified now and through which secure channel",
            "responsible_role": "Group Cybersecurity",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A4",
            "description": "Decide whether to cut all {supplier} access, with business owner approval",
            "responsible_role": "Group IT",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "INJ-01-A5",
            "description": "Confirm that {company_1} and {company_2} follow the Group lead",
            "responsible_role": "{company_2} Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "{ir_provider} IR – 100 GB exfiltrated over six months",
        "content": "**{ir_provider} Incident Response – Preliminary findings (TLP:AMBER)**\n\nThe IR retainer has been activated. Our analysis confirms that the compromised {supplier} account was used to steal **approximately 100 GB of data over six months**, using covert methods to evade your monitoring systems.\n\n**What appears to have been taken:**\n- Hundreds of **confidential Legal documents** from {group_name} (M&A plans, compliance reports)\n- **Customer personal data** from {company_2} and {company_1}\n- **SCADA network diagrams** for {business_d}\n\nNo public leak has been detected yet. The full extent and the attacker's intent are unknown. We assess a **high risk of future extortion**.",
        "offset_minutes": 15,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Group Executive Leadership",
          "General Secretary and Board Secretariat",
          "Group Cybersecurity",
          "Group IT",
          "Group Customers Business",
          "{company_1} Leadership",
          "{company_2} Leadership",
          "{business_d}"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "Preliminary forensic summary",
          "Partial inventory of exfiltrated data"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1505.003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1087.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1039"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1560.001"
          }
        ],
        "facilitator_notes": "If participants propose \"waiting for a public leak\", remind them that the GDPR 72-hour clock starts at awareness. Do not reveal attribution yet.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Confirm who chairs the Crisis Management Team",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 5,
            "objective_codes": []
          },
          {
            "code": "INJ-02-A2",
            "description": "Name the owner of the decision to involve law enforcement and national authorities, and take it or defer it with a deadline",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-02-A3",
            "description": "Identify the notifications triggered (GDPR / UK GDPR, NIS2) and assign an owner and deadline to each",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-02-A4",
            "description": "Instruct that forensic work on the Legal documents is commissioned through external counsel, and name who gives that instruction",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "INJ-02-A5",
            "description": "State whether the exposed SCADA diagrams create an immediate risk to {business_d} operations, and name who decides on any protective measures",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 15,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Ransomware across {country_1} and {country_2} – OT affected, €20M demand",
        "content": "**URGENT – SOC to Crisis Management Team**\n\n**Ransomware has hit {country_1} and {country_2} simultaneously.**\n- IT systems are **down in both countries**.\n- The **2,600 {project_1} laptops are encrypted**. These are the exact devices {person_1} managed: the attacker knew our environment.\n- **{control_centre_1} has lost connection with three renewable plants.** The ransomware has crossed into our **OT environment**.\n- Backup failover is not yet confirmed, and the **integrity of our backups is unknown**.\n- **Ransom demand: €20M within 48 hours.**\n\nWe have no single team with full visibility across IT and OT. There is a real risk that **{business_d} and {business_b} will be targeted and encrypted next**. A decision is needed: **do we proactively shut down {business_d} and {business_b}** to prevent the spread, **or keep them operating** and accept the risk?",
        "offset_minutes": 30,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Group Executive Leadership",
          "Group Finance",
          "Group Networks",
          "Group Power",
          "Group IT",
          "Group Cybersecurity",
          "{company_1} Leadership",
          "{company_2} Leadership",
          "{business_d}",
          "{business_e}"
        ],
        "delivery_method": "phone",
        "attachment_notes": [
          "Ransom note (€20M, 48 h)",
          "IT/OT impact map: affected systems and sites"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1219"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0112",
            "technique_id": "T1685"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Run the live poll (\"{business_d}/{business_b}: shut down or keep operating?\") before the discussion. Watch whether the OT decision is left to IT or Security; the business owner must take it (otherwise fire C-02 at minute 15). Key question to push: \"Are we more exposed by a controlled shutdown or by an outage the attacker forces on us?\"",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Decide whether this is a cyber incident or a business continuity emergency, and who leads",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decide whether to isolate, partially isolate or keep running {business_d} and {business_b}, weighing safety, continuity of supply and regulatory exposure",
            "responsible_role": "Group Networks",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A3",
            "description": "Align {business_d}'s operational stance with the Group decision",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-03-A4",
            "description": "Decide whether to authorise the {city_2} failover without verified integrity",
            "responsible_role": "Group IT",
            "expected_within_minutes": 20,
            "objective_codes": []
          },
          {
            "code": "INJ-03-A5",
            "description": "State the initial position on the ransom demand, with owner and rationale",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "National CSIRT ({country_1}) – formal request for incident notification",
        "content": "**Subject: Formal request for incident notification**\n\nNational CSIRT ({country_1}) has become aware of a cyber incident affecting {group_name} entities in {country_1}. As an operator of essential services, you are requested to provide **without delay**: (1) a **formal incident notification**, (2) the **scope of impact** on services and systems, and (3) **evidence of the containment measures** taken. Please confirm your **single point of contact** for this incident.",
        "offset_minutes": 50,
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
          "Group Cybersecurity",
          "General Secretary and Board Secretariat",
          "{company_1} Leadership"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Deliver INJ-04a, 04b and 04c one after another to build pressure. Closing question for the phase: \"Silence, delay or inconsistency are also decisions. What is our position?\"",
        "scored": true,
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Agree what can credibly be reported given limited visibility, and who sends it",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Add the national CSIRT of {country_1} to the notification matrix with owner, deadline and clock start",
            "responsible_role": "Group Cybersecurity",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "{grid_operator} control room – grid stability reassurance",
        "content": "This is the **{grid_operator} control room**. We need **immediate reassurance that grid stability is not at risk**. What is the operational status of {business_d}'s network, and what is your plan if you lose visibility? Be aware that {business_d}'s decisions will be evaluated from a **national interest perspective**. We expect an **update within the hour**.",
        "offset_minutes": 52,
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
          "{company_2} Leadership",
          "{business_d}",
          "Group Networks"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Give {grid_operator} a status consistent with the Group position",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Confirm that {country_1} and {country_2} use the same incident classification and decision rationale",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 13,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Investor Relations – customer complaints and shareholder pressure",
        "content": "Customers in {country_1} and {country_2} are experiencing service issues, filing **formal complaints** and threatening **contractual penalties**. Shareholders are demanding explanations through Investor Relations and Board channels. **{country_1} and {country_2} are not giving the same message.** We need an **approved position** before we reply, and guidance on whether this requires a **market disclosure**.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-11",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Group Executive Leadership",
          "Group Finance",
          "General Secretary and Board Secretariat",
          "Group Customers Business",
          "External Communications ({country_1})",
          "{company_2} Leadership"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Name the single role that approves external communications across both countries",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decide whether a market disclosure (inside information) is required",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-06-A3",
            "description": "Agree a common response line for customers threatening penalties",
            "responsible_role": "Group Customers Business",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-05",
        "kind": "mandatory",
        "title": "Attribution – nation-state meets eCrime",
        "content": "**{ir_provider} root cause analysis (TLP:AMBER)**\n\nThis was **not a straightforward ransomware attack**.\n\n**Six months ago:** **PIONEER KITTEN**, an Iranian-aligned nation-state group, exploited the VPN appliance at {supplier} and established long-term access.\n\n**This week:** they sold or handed that access to **SCATTERED SPIDER**, a criminal group, who deployed the ransomware and issued the €20M demand.\n\n_State-sponsored actors enabled it. Criminals executed it._",
        "offset_minutes": 65,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-03",
        "recipients": [
          "Group Executive Leadership",
          "General Secretary and Board Secretariat",
          "Group Finance",
          "Group Security",
          "Group Cybersecurity",
          "{company_1} Leadership",
          "{company_2} Leadership"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [
          "Attribution briefing – PIONEER KITTEN / SCATTERED SPIDER"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1190"
          }
        ],
        "facilitator_notes": "Short phase (10 min). Key question: \"Does nation-state involvement change our response?\" Scattered Spider's use of the brokered access (T1078) is already reflected in INJ-03.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Decide whether to engage national security agencies in both countries and law enforcement, with a named owner",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "State whether paying an Iran-linked group would breach sanctions, and who gives the legal opinion",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A3",
            "description": "Ask for the insurance position, including nation-state or war exclusions, and name who reports back",
            "responsible_role": "Group Finance",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A4",
            "description": "Agree one Group position on attribution for authorities in both countries",
            "responsible_role": "Group Security",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "Proof-of-life data dump confirmed on leak site",
        "content": "Our dark web monitoring service has detected a **proof-of-life dump** published on a well-known leak site. The sample was downloaded and analysed. The Group SOC/CSIRT completed a second-level analysis and shared its findings with the {country_1} and {country_2} CSIRTs. **Both CSIRTs confirm the samples are authentic.**\n\n**Published:** customer records ({group_name} and {company_2}), confidential corporate documents and **SCADA network diagrams explicitly referencing {business_d} environments**.",
        "offset_minutes": 75,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Group Executive Leadership",
          "General Secretary and Board Secretariat",
          "Group Cybersecurity",
          "Group Customers Business",
          "External Communications ({country_1})",
          "{company_2} Leadership",
          "{business_d}"
        ],
        "delivery_method": "email",
        "attachment_notes": [
          "Leak site screenshot (redacted)",
          "CSIRT authenticity assessment"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Ask how the DPO's position constrains the executive decision. Closing question for the phase: \"Are our earlier decisions still defensible now that this is public?\"",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Decide whether to issue a public breach notification now or wait for legal consolidation, with owner and rationale",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Update the notification matrix: data protection authorities in {country_1} and {country_2} and affected customers",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-09",
        "phase_code": "PH-06",
        "kind": "mandatory",
        "title": "Media in {country_1} and {country_2} report the leak",
        "content": "**Breaking news in {country_1} and {country_2}:** _\"Customer data exposed. Critical infrastructure diagrams leaked. Nation-state linked cyberattack.\"_ Journalists are calling the press office for comment, and the story is **trending on social media**. **Employees are sharing the articles internally** before receiving any briefing.",
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
          "Group Executive Leadership",
          "External Communications ({country_1})",
          "{company_2} Leadership",
          "{company_1} Leadership"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-04",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Name the final authority over public statements in {country_1} and {country_2}",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04",
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A2",
            "description": "Approve one holding statement used by both countries, with a named approver",
            "responsible_role": "External Communications ({country_1})",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A3",
            "description": "Decide whether to publicly acknowledge nation-state involvement and OT exposure",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-05"
            ]
          },
          {
            "code": "INJ-09-A4",
            "description": "Agree what to tell employees",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-07",
        "kind": "mandatory",
        "title": "Executive decision required – recovery options",
        "content": "**All backups are compromised.** Our most recent clean recovery point is a **tape backup from six months ago**.\n\n**Option 1 – Pay €20M:** 2–3 days to recover. No guarantee. Potential sanctions exposure (Iran-linked). Sets a precedent. Reputational impact if the payment becomes public.\n\n**Option 2 – Rebuild clean:** 14–21 days. Guaranteed clean environment. Significant cost and prolonged disruption. Sustained customer, media and political pressure.\n\n**Option 3 – Hybrid:** 10–14 days. Partial rebuild with selective restoration. Residual risk of incomplete containment. Harder to explain to regulators and media.\n\n**We need a final decision.**",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Group Executive Leadership",
          "Group Finance",
          "General Secretary and Board Secretariat",
          "Group IT",
          "Group Cybersecurity",
          "Group Networks",
          "Group Power",
          "{company_1} Leadership",
          "{company_2} Leadership"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Run a live poll on the three options before the discussion. Push on two points: \"Have {business_b} and {business_d} rehearsed network disconnection?\" and \"If the three entities disagree, who decides?\" If there is no decision by minute 15, fire C-03.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Take the final decision (pay, rebuild or hybrid) with one owner, rationale and assumptions",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "State who has decision authority (Group Board, local Boards or CEO with delegated authority) and who is accountable",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-10-A3",
            "description": "Decide whether this is one Group-wide decision or three entity decisions, and who breaks a tie",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02",
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-10-A4",
            "description": "Agree how the decision is communicated to regulators, media, employees and shareholders",
            "responsible_role": "External Communications ({country_1})",
            "expected_within_minutes": 25,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-11",
        "phase_code": "PH-08",
        "kind": "mandatory",
        "title": "Post-incident – executive reflection",
        "content": "**Tuesday 5 May, 14:00.** The crisis response phase is complete and recovery is underway. The Board asks the executive team to reflect on **its own performance during the crisis**: not the technical or operational response, but **leadership, decision-making and governance**.",
        "offset_minutes": 120,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-12",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Group Executive Leadership",
          "Group Finance",
          "General Secretary and Board Secretariat",
          "Group Customers Business",
          "Group Networks",
          "Group Power",
          "Group IT",
          "Group Security",
          "Group Cybersecurity",
          "{company_1} Leadership",
          "External Communications ({country_1})",
          "{company_2} Leadership",
          "{business_d}",
          "{business_e}"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "This phase feeds the debrief, not the scoring. Give every entity ({group_name}, {company_1}, {company_2}) the floor at least once.",
        "scored": false,
        "objective_codes": [],
        "expected_actions": [
          {
            "code": "DSC-11-A1",
            "description": "Identify the decisions that took too long because authority was unclear, and how to fix that",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 15,
            "objective_codes": []
          },
          {
            "code": "DSC-11-A2",
            "description": "Commit to one priority investment for the next 90 days",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 20,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-12",
        "phase_code": "PH-01",
        "kind": "contingent",
        "title": "{supplier} – request for a single point of contact",
        "content": "This is the **{supplier} incident manager**. In the last 20 minutes we've had **three calls from {group_name}**: the Group cyber team in {city_1}, {company_2} IT and Group Security. Each one is asking for different logs and different actions. We need **one point of contact and one set of instructions**. **Who is leading on your side?**\n\nAlso, do you want us to **disable {person_1}'s account and all {supplier} accounts now**? That will **stop our managed services across the whole Group**.",
        "offset_minutes": null,
        "trigger_condition": "No lead has been named by minute 10 of the phase (checked at minute 10 of the phase).",
        "contingent_purpose": "Force one lead and one point of contact for {supplier}, and a decision on its access (OBJ-01, OBJ-04).",
        "fires_at_minute": 10,
        "branch_from_code": "INJ-01",
        "branch_action_code": "INJ-01-A2",
        "rejoin_code": "INJ-02",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Group Executive Leadership",
          "Group Cybersecurity",
          "Group IT",
          "{company_2} Leadership"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Deliver only if no lead has been named by minute 10. In the evaluation, record that the lead was named after prompting (partial achievement of OBJ-01).",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-12-A1",
            "description": "Name one lead and one point of contact for {supplier}",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-01",
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-12-A2",
            "description": "Decide on {supplier} access, with the business impact accepted by its owner",
            "responsible_role": "Group IT",
            "expected_within_minutes": 5,
            "objective_codes": []
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "{business_d} control room – conflicting instructions, decision needed now",
        "content": "**{business_d} control room here.** We're receiving **conflicting instructions**. IT Security is asking us to disconnect, but nobody in the business has told us what to do.\n\n**If we isolate**, we lose remote control and need field crews for manual operation, and that carries **safety risks**. **If we stay connected**, we may be next.\n\nWe need a **business decision within five minutes**, and we need to know **who is giving it**.",
        "offset_minutes": null,
        "trigger_condition": "By minute 15 no decision has been taken, or the decision has been left to IT/Security (checked at minute 15 of the phase).",
        "contingent_purpose": "Make the OT business owner take the isolate / keep-running decision (OBJ-03).",
        "fires_at_minute": 15,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A2",
        "rejoin_code": "INJ-04",
        "sender_code": "ACT-13",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Group Networks",
          "{business_d}",
          "{company_2} Leadership",
          "Group Executive Leadership"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Also fire it if IT or Security try to take the OT decision on their own. Record whether the final decision came from the business owner (needed for OBJ-03).",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "The business owner takes the isolate / keep-running decision, covering safety, supply and regulatory exposure",
            "responsible_role": "Group Networks",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-13-A2",
            "description": "{business_d} confirms the instruction and who issued it",
            "responsible_role": "{business_d}",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-14",
        "phase_code": "PH-07",
        "kind": "contingent",
        "title": "Attacker message – 6 hours left, threat to {control_centre_1}",
        "content": "We see you are talking to the authorities. That will not help you.\n\n**6 hours. €20M** or we deploy wipers and **encrypt {control_centre_1}**.\n\nAfter that, **everything we have goes public**.",
        "offset_minutes": null,
        "trigger_condition": "No final decision has been taken by minute 15 of the phase (checked at minute 15 of the phase).",
        "contingent_purpose": "Raise the pressure so that the final recovery decision is taken, with one owner, before the phase ends (OBJ-02).",
        "fires_at_minute": 15,
        "branch_from_code": "INJ-10",
        "branch_action_code": "INJ-10-A1",
        "rejoin_code": "DSC-11",
        "sender_code": "ACT-07",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-04",
        "recipients": [
          "Group Executive Leadership",
          "General Secretary and Board Secretariat",
          "Group Cybersecurity",
          "Group Power",
          "{company_1} Leadership"
        ],
        "delivery_method": "chat",
        "attachment_notes": [
          "Screenshot of the Telegram message"
        ],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "Deliver only if there is no decision by minute 15. If the decision has already been taken, skip it. Watch whether the threat to {control_centre_1} makes them change a decision already taken, and whether the change is properly owned and justified.",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Take the final decision with one owner before the phase ends",
            "responsible_role": "Group Executive Leadership",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Decide whether to reply to the attacker, and who authorises any contact",
            "responsible_role": "General Secretary and Board Secretariat",
            "expected_within_minutes": 5,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-14-A3",
            "description": "Decide the protective measures for {control_centre_1} and name who orders them",
            "responsible_role": "Group Power",
            "expected_within_minutes": 10,
            "objective_codes": []
          }
        ],
        "images": []
      }
    ],
    "next_phase_number": 9,
    "next_inject_number": 15,
    "next_threat_actor_number": 5
  },
  "cast": [
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-08",
      "name": "Group CISO",
      "type": "internal",
      "description": "The Group's Chief Information Security Officer: formally notifies the Crisis Management Team.",
      "channel": "email"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-09",
      "name": "Group SOC",
      "type": "internal",
      "description": "The Group Security Operations Centre (SOC/CSIRT): detection, impact reports and leak analysis.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-10",
      "name": "{ir_provider} IR",
      "type": "other",
      "description": "External incident response provider under retainer: forensic findings, attribution and recovery options.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "National CSIRT",
      "code": "ACT-02",
      "name": "National CSIRT ({country_1})",
      "type": "csirt",
      "description": "The national CSIRT of {country_1} for operators of essential services.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "competent-authority",
      "origin_name": "Competent authority",
      "code": "ACT-03",
      "name": "{grid_operator}",
      "type": "authority",
      "description": "Control room of the national electricity system operator of {country_2}: grid stability and national interest.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-11",
      "name": "Investor Relations",
      "type": "internal",
      "description": "Group Investor Relations: relays shareholder and customer pressure.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Media",
      "code": "ACT-04",
      "name": "Media ({country_1} & {country_2})",
      "type": "media",
      "description": "Journalists and social media in {country_1} and {country_2} reporting the leak.",
      "channel": "media"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-12",
      "name": "Board of Directors",
      "type": "internal",
      "description": "The Group Board: asks the executive team to reflect on its own performance.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Critical supplier",
      "code": "ACT-05",
      "name": "{supplier}",
      "type": "supplier",
      "description": "The Group’s IT services provider, with privileged access across the Group in {country_1} and {country_2}; breached six months ago.",
      "channel": "phone"
    },
    {
      "origin": "exercise",
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-13",
      "name": "{business_d} control room",
      "type": "internal",
      "description": "{business_d} control room: needs a business decision on isolating the network.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Attacker (sender)",
      "code": "ACT-07",
      "name": "Scattered Spider",
      "type": "threat_actor",
      "description": "Signs the attacker's messages: ransom notes, leak-site posts, deadlines. Who the attacker is, and its techniques, are the scenario's threat actors.",
      "channel": "chat"
    }
  ],
  "next_actor_number": 14,
  "tags": [],
  "images": []
}
```
