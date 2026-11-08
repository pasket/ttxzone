---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-017"
kind: "trend"
title: "Education and research: open networks, ransomware and espionage on research"
summary: "Schools and universities combine open, decentralized networks, thousands of short-term users and valuable research; they suffer frequent ransomware with slow recovery, data breaches of students and staff, DDoS at exam time and state espionage targeting research groups."
language: "en"
sectors: ["education"]
families: ["ransomware", "data_breach", "ddos", "phishing_account_takeover"]
capabilities: ["continuity_recovery", "detection_triage_escalation", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1566.001", "enterprise:T1078", "enterprise:T1213", "enterprise:T1567.002", "enterprise:T1486", "enterprise:T1498"]
attack_groups: []
related: ["KB-TRD-001", "KB-TRD-007", "KB-TRD-008"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Education and research: open networks, ransomware and espionage on research

## Overview
Educational institutions are built to be open: thousands of students and visiting researchers, personal devices, decentralized IT run by faculties and research groups, and limited central security budgets. Credentials are stolen constantly through phishing and infostealers, often from students' personal machines. Ransomware groups exploit this to encrypt learning platforms, student records and email, usually at the worst time (enrolment, exams, grading). Schools hold sensitive data about minors and families. Universities also host research of strategic value (defence, semiconductors, energy, health), which state groups pursue through phishing with fake conference or job invitations, compromise of researchers' accounts and theft from collaboration platforms. DDoS during online exams or enrolment is a recurring nuisance, sometimes by students themselves.

## Indicative figures
- Education saw attack attempts rise by about three quarters year on year, with thousands of weekly attempts per organization.
- Ransomware attack rates in education rose by more than half in a year; ransomware is around 30 % of malware in education breaches.
- Most institutions lack basic email protections such as enforced sender authentication (around two thirds of universities in one survey).
- Personal data is involved in most education breaches (close to 60 %); internal error, mainly misdelivery, causes a large share of incidents.
- Recovery costs average well over a million per incident, and recovery takes months; very few institutions that paid recovered all their data.

## Typical attack chain
1. **Access**: phishing of staff and students, or stolen credentials from personal devices (T1566.001, T1078).
2. **Discovery**: shared drives, learning platforms and research repositories (T1213).
3. **Theft**: student, staff and research data copied out (T1567.002).
4. **Impact**: encryption of servers and learning platforms (T1486), or DDoS during exams (T1498).
5. **Espionage variant**: targeted phishing of researchers with fake conference or recruitment lures, long-term mailbox access, theft of research data.

## Realistic timings
- Ransomware intrusions often peak during holidays and the start of term, when IT staff are fewer or overloaded.
- Classes move online or to paper within days; enrolment and grading deadlines create hard constraints.
- Rebuild of central systems: weeks; full recovery: months.
- Espionage in research groups can last years and is often discovered through an external notification.

## Exercise hooks
- The learning platform and student information system are encrypted two days before final exams.
- A national agency informs the university that a research group's mailboxes have been read for months by a foreign group.
- Parents' and students' data appears on a leak site; the school must contact families.
- Ask who can make decisions across faculties that manage their own IT.
- Discuss academic continuity: postpone exams, move to paper, or extend deadlines?
