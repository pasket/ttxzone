---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-008"
kind: "trend"
title: "Insider risk: careless staff, shadow AI and fake remote workers"
summary: "Insider incidents range from employees pasting confidential data into personal AI tools to malicious leavers taking source code and state-backed operatives hired as remote IT contractors under synthetic identities, who later steal data and extort the employer."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["insider", "data_breach"]
capabilities: ["detection_triage_escalation", "legal_forensics", "cross_unit_coordination"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1585.001", "enterprise:T1683.002", "enterprise:T1078", "enterprise:T1219", "enterprise:T1213.003", "enterprise:T1567.002", "enterprise:T1204.002", "enterprise:T1657"]
attack_groups: []
related: ["KB-TRD-009", "KB-TRD-002"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Insider risk: careless staff, shadow AI and fake remote workers

## Overview
Insider risk covers anyone with legitimate access who causes harm, deliberately or not. The negligent insider is by far the most common: misdirected emails, files shared publicly, credentials reused, and now confidential documents pasted into public AI assistants under personal accounts. The malicious insider is rarer but costlier: a disgruntled administrator, a leaver taking customer lists or source code to a competitor, an employee selling access to a ransomware group. A newer pattern blurs the line with state espionage: operatives of a sanctioned state apply for remote IT jobs with synthetic identities, AI-retouched photos and borrowed résumés, pass video interviews, and have company laptops shipped to "laptop farms" run by local facilitators. They do the work, send the salary home, and when exposed or dismissed they steal source code and demand payment. A related lure targets developers with fake job interviews whose coding test installs malware.

## Indicative figures
- Insider incidents cost organizations on average well over ten million per year, mostly through investigation and containment delays.
- Malicious insiders are named a top cyber risk by a small minority of leaders (under about 10 %), well behind ransomware and fraud.
- Around 15 % of employees use generative AI tools on corporate devices regularly; most of them with personal accounts or without corporate single sign-on.
- Fake remote-worker schemes were evicted from more than 20 enterprise environments by a single response team in a year; fake-interview malware was removed from more than 10.
- Dwell time for fake remote workers is months to years: they often perform well and raise no performance concerns.

## Typical attack chain
Fake remote worker:
1. **Persona**: synthetic identity with stolen or rented documents, polished professional profile and AI-edited photos (T1585.001, T1683.002).
2. **Hiring**: video interviews with a stand-in or a face filter; references from other members of the network.
3. **Access**: company laptop delivered to a facilitator's address and operated through remote-access tools (T1078, T1219).
4. **Long game**: real work for months; collection of source code and credentials from repositories (T1213.003).
5. **Exit**: when dismissed or suspected, bulk upload of code and data to cloud storage (T1567.002) and an extortion demand (T1657).

Fake job interview: a developer receives a "take-home test" repository; running it installs a backdoor that steals browser credentials and wallets (T1204.002).

## Realistic timings
- Negligent leaks are found days to months later, often by a third party.
- Fake remote workers: weeks to months between hiring and the first anomaly; extortion follows dismissal within days.
- Investigations involving HR, legal and possibly police take weeks; evidence handling decisions in the first hours matter most.

## Exercise hooks
- HR reports that a recently hired remote developer's laptop connects from a different country than the declared address, through a commercial remote-access tool.
- A team lead admits that the department pastes contracts into a public AI assistant to summarize them.
- A dismissed contractor emails a sample of the company's source code with a payment demand.
- Ask who leads an insider investigation (security, HR, legal) and what can be monitored lawfully.
- Discuss sanctions exposure: the organization may have been paying a sanctioned state's operatives.
