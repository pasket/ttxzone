---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-009"
kind: "trend"
title: "AI in the attacker's toolkit, and the organization's AI as a target"
summary: "Attackers use generative AI to write convincing lures at scale, clone voices and faces, and generate or steer malware; at the same time the organization's own AI assistants, agent tools and workflow platforms become new targets through prompt injection, poisoned components and stolen credentials."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["phishing_account_takeover", "supply_chain", "data_breach"]
capabilities: ["detection_triage_escalation", "incident_classification", "third_party_supply_chain"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1588.007", "enterprise:T1682", "enterprise:T1683.001", "enterprise:T1683.002", "enterprise:T1566.002", "enterprise:T1195.002", "enterprise:T1190", "enterprise:T1059", "enterprise:T1552.001"]
attack_groups: ["G0007"]
related: ["KB-TRD-006", "KB-TRD-008", "KB-TRD-003"]
source_class: "annual-industry-report"
period: "2025-2026"
reviewed: "2026-10-31"
---
# AI in the attacker's toolkit, and the organization's AI as a target

## Overview
For most attackers, AI is an accelerator rather than a new weapon: phishing in flawless local language, translated lures, fake company websites and social profiles, research on targets, help writing scripts. Social engineering gains the most: cloned voices of executives and help-desk staff, deepfake video in calls and in remote hiring. A few state groups have experimented with malware that queries a public language model at run time to decide which commands to run; APT28 used such malware against government targets, although it was no more effective than conventional tools. Agent-style AI that chains tools with little human oversight has been seen in at least one espionage campaign. The other side is new attack surface: AI assistants that read untrusted email or documents can be steered by hidden instructions (prompt injection); agent connectors and plug-ins are a new software supply chain; low-code AI workflow platforms exposed to the internet have been exploited to drop ransomware; stolen cloud keys are used to run expensive AI models on the victim's bill; and employees leak data into unsanctioned AI tools.

## Indicative figures
- AI-assisted content appears in a large majority (around 80 %) of observed phishing and social engineering by the start of the period.
- AI-tailored spear-phishing has been measured at click rates around four to five times those of generic phishing.
- Incidents involving adversaries known to use AI nearly doubled year on year in one dataset.
- A malicious package that hijacked developers' local AI command-line tools to hunt for credentials reached more than 90 organizations in one response team's caseload.
- Single poisoned-package campaigns in public repositories compromised hundreds of packages (several hundred in the largest wave).

## Typical attack chain
Attacker using AI:
1. **Preparation**: target research and lure writing with public or jailbroken models (T1588.007, T1683.001).
2. **Delivery**: personalized phishing, cloned voice calls or deepfake video (T1566.002, T1683.002).
3. **Execution**: scripts drafted with AI; in rare cases malware that asks a public model for its next commands (T1682, T1059).

Organization's AI as target:
1. **Entry**: an exposed AI workflow server with a known flaw (T1190), or a poisoned package or fake agent connector installed by a developer (T1195.002).
2. **Abuse**: hidden instructions in an email or document make the assistant leak data or misclassify a threat; a rogue connector forwards mail to the attacker.
3. **Theft**: API keys and tokens collected from configuration files (T1552.001) and reused to run models or reach data.

## Realistic timings
- Newly disclosed flaws in popular AI platforms are exploited within days.
- Poisoned packages spread through dependency updates within hours; clean-up across developer machines takes weeks.
- Stolen AI service keys are abused within hours of exposure in public repositories.
- Prompt-injection effects are usually discovered late, when someone notices odd assistant behavior or an unexpected outgoing message.

## Exercise hooks
- The finance team gets a voicemail in the CEO's voice asking to approve a transfer before a board call (KB-TRD-006).
- The cloud bill shows a sudden spike from AI model usage in a region the organization doesn't use.
- An internal assistant that summarizes the shared mailbox starts forwarding summaries to an external address after a new connector was installed.
- Ask whether the incident response plan covers AI systems: who owns them, what is logged, how to switch them off.
- Discuss policy: which AI tools are approved, and what happens with data already pasted into others?
