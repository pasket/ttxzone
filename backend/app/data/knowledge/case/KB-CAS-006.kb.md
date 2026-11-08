---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-006"
kind: "case"
title: "Deepfake video call with the CFO leads to tens of millions in transfers"
summary: "A finance employee at a regional office doubts an email from the group CFO, but joins a video call where the CFO and several colleagues, all deepfakes, confirm the confidential deal; about fifteen transfers later the money is gone."
language: "en"
sectors: ["cross-sector", "finance"]
families: ["bec_fraud"]
capabilities: ["detection_triage_escalation", "crisis_decision_making", "legal_forensics"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1593", "enterprise:T1684.001", "enterprise:T1683.002", "enterprise:T1657"]
attack_groups: []
related: ["KB-TRD-006", "KB-TRD-009"]
source_class: "trade-magazine"
period: "2024"
reviewed: "2026-10-31"
---
# Deepfake video call with the CFO leads to tens of millions in transfers

## Archetype
A multinational engineering or professional services group with a regional finance office that executes payments on instructions from headquarters. Senior executives appear in public videos, conference talks and earnings calls, which gives attackers plenty of material to clone faces and voices. Payment controls rely on the instruction coming from a known executive and, when in doubt, on "seeing" them in a call. The attackers study the organization chart and choose an employee who is senior enough to make transfers but far from headquarters.

## Relative timeline
- **Day -30 to day -1**: attackers collect public video and audio of the CFO and other executives and build deepfake models (T1593, T1683.002).
- **Day 0**: the employee receives an email, apparently from the CFO, about a confidential transaction that needs several urgent payments. The employee suspects phishing.
- **Day 0, later**: the employee is invited to a video call; the CFO and several known colleagues are present, speak, and confirm the request. Doubts disappear (T1684.001).
- **Days 0 to 5**: about fifteen transfers to five different accounts, totalling tens of millions (T1657).
- **About a week later**: the employee mentions the deal to headquarters; nobody knows about it. The fraud is reported to police; most of the money is already gone.

## Decision points
- Day 0: the email looks suspicious. Who does the employee ask, and through which channel?
- During the call: is there any check the employee could make (a question only the real CFO would know, a call back on a known number)?
- Should multiple large, urgent, confidential transfers trigger a hold regardless of who asked?
- On discovery: freeze, recall, police, insurer: in what order, and who leads?
- Is it a cyber incident (with notification duties) or "only" fraud? Was any system compromised?
- What do we tell staff, auditors and the market?

## Impacts
- Direct loss of tens of millions, mostly unrecoverable.
- Investigation, audit and insurance disputes about whether controls were followed.
- Reputational damage and scrutiny of payment governance across the group.
- Personal consequences for the employee, who acted in good faith.

## Lessons
- Seeing and hearing a person is no longer proof of identity; verification must use an independent channel set up in advance.
- Confidentiality and urgency together are a red flag that should slow payments down, not speed them up.
- Split large payments across approvers in different locations; set thresholds that require a second, out-of-band confirmation.
- Public video of executives is raw material for impersonation; train finance and assistants specifically.
- Make it safe for junior staff to challenge executives.

## Inject ideas
- A finance analyst receives an email from the "CFO" about a confidential acquisition and an invitation to a video call in 30 minutes.
- During the call, the "CFO" asks for five transfers before the end of the day and insists nobody else must know.
- A week later, headquarters asks why five large payments to unknown accounts were made.
- The bank says two transfers can still be recalled if the request arrives within the hour.
- The cyber insurer asks whether the loss falls under the cyber policy or the crime policy.
- **In the Library**: the TTX-Zone scenario "deepfake-fraud" plays this case end to end.
