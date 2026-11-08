---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-020"
kind: "trend"
title: "Disinformation around cyber incidents: false claims, deepfakes and coordinated amplification"
summary: "Incidents attract information operations: hacktivist and state personas claim attacks that never happened or exaggerate real ones, AI-generated videos and voices impersonate officials and executives, and coordinated inauthentic accounts amplify the panic faster than the organization can respond."
language: "en"
sectors: ["cross-sector", "public-administration", "energy-utilities"]
families: ["generic", "physical_hybrid"]
capabilities: ["internal_external_comms", "crisis_decision_making", "cross_unit_coordination"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1585.001", "enterprise:T1683.001", "enterprise:T1683.002", "enterprise:T1684.001", "enterprise:T1491.002"]
attack_groups: []
related: ["KB-TRD-007", "KB-TRD-016", "KB-CAS-005", "KB-ART-015"]
source_class: "government-assessment"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Disinformation around cyber incidents: false claims, deepfakes and coordinated amplification

## Overview
Every visible incident is now also an information event. Hacktivist and state-backed personas claim to have hacked industrial control systems, taken down grids or stolen databases, often with fabricated screenshots, to create fear and test whether media will repeat the claim. After real outages, networks of inauthentic accounts push explanations that suit a political narrative (blaming a technology, a government or a minority). Generative AI makes this cheaper: fake news clips with cloned voices of officials and journalists, deepfake videos of executives announcing things they never said, and realistic fake documents. The organization faces a double problem: handling the technical incident and countering a story it doesn't control, without amplifying it.

## Indicative figures
- Generative AI was used in influence operations around at least a third of elections in one period studied.
- Trade in deepfake tools on criminal forums more than tripled in a year.
- Platforms removed thousands of coordinated inauthentic accounts in single takedowns around elections.
- Cloned voices of senior officials appeared in fabricated videos spread by coordinated networks within the period.
- After a nationwide blackout, a disinformation campaign blaming a specific energy source spread within two days.

## Typical attack chain
1. **Personas**: networks of fake accounts and "news" pages built over months (T1585.001).
2. **Content**: AI-written articles, fake screenshots, cloned voices or deepfake videos of officials and executives (T1683.001, T1683.002, T1684.001).
3. **Trigger**: a real incident, an outage or a political moment; or a fabricated claim with no incident at all.
4. **Amplification**: seeding by a few accounts, amplification by many; defacement of a minor website as "proof" (T1491.002).
5. **Pick-up**: journalists and real users repeat it; the organization is asked to confirm or deny.

## Realistic timings
- A false claim can reach mainstream media within hours if it touches a sensitive topic.
- Platform takedowns of inauthentic networks take days to weeks.
- Fact-checking and official denials typically lag the claim by hours or days, and reach fewer people.
- Narratives about the cause of a major incident can persist long after investigations disprove them.

## Exercise hooks
- A hacktivist channel posts a video "proving" control of the organization's plant; the footage is from another country, but media ask for comment (KB-ART-006, variant "OT claim").
- A deepfake video of the chief executive announcing layoffs after "the cyberattack" circulates on social networks.
- During an outage of unknown cause, accounts claim it was a cyberattack by a named country; staff start repeating it internally.
- Ask who monitors social media, who decides whether to respond, and how to deny without amplifying.
- Discuss pre-agreed verification channels for statements from executives and authorities.
