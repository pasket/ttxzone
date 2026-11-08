---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-011"
kind: "trend"
title: "Healthcare: ransomware that reaches the patient"
summary: "Hospitals, laboratories and health-technology suppliers are among the most targeted organizations; attacks force paper-based care, ambulance diversion and cancelled procedures for weeks, while stolen medical records fuel extortion."
language: "en"
sectors: ["healthcare"]
families: ["ransomware", "data_breach", "supply_chain"]
capabilities: ["continuity_recovery", "crisis_decision_making", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1133", "enterprise:T1190", "enterprise:T1078", "enterprise:T1199", "enterprise:T1567.002", "enterprise:T1486", "enterprise:T1490", "enterprise:T1657"]
attack_groups: ["G1024"]
related: ["KB-TRD-001", "KB-TRD-003", "KB-ART-001"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Healthcare: ransomware that reaches the patient

## Overview
Health organizations combine everything attackers look for: sensitive data with long-term value, 24/7 operations that cannot stop, flat networks full of legacy and medical devices that cannot be patched, and many small suppliers with remote access (laboratory systems, imaging, scheduling, billing). Ransomware groups such as Akira and other service-model affiliates hit hospitals directly or, with wider effect, the shared supplier: a pathology provider, a regional IT service, a claims processor. When systems go down, clinicians fall back to paper, emergency departments divert ambulances, laboratories stop returning results and planned operations are cancelled. Data theft adds a second wave: patients' records are published or used for direct extortion of patients. Recovery is slow because clinical systems must be validated before use and backlogs take months to clear.

## Indicative figures
- Healthcare accounts for roughly 5 to 10 % of ransomware victims worldwide, usually among the top three sectors.
- Major incidents in the region number in the hundreds per year in the health sector alone.
- Operational downtime after a serious attack runs from about two weeks to several months.
- Single incidents have cancelled thousands of procedures and appointments; laboratory outages have triggered blood shortages.
- Exfiltrated volumes of hundreds of gigabytes are typical; the largest supplier breach exposed the records of over a hundred million people.
- Health has the highest average breach cost of any sector (around ten million per incident); the largest single cases reach hundreds of millions in response and disruption costs.

## Typical attack chain
1. **Entry**: remote access without MFA used by a supplier or staff (T1133, T1078), an unpatched internet-facing system (T1190), or the supplier itself as a bridge (T1199).
2. **Spread**: flat network from administrative systems to clinical servers; domain credentials stolen.
3. **Theft**: patient databases, imaging archives and laboratory files copied to cloud storage (T1567.002).
4. **Impact**: encryption of servers and virtualization hosts, backups deleted (T1486, T1490).
5. **Extortion**: ransom demand to the organization; later, threats to publish or to contact patients directly (T1657).

## Realistic timings
- Initial access to encryption: days to a few weeks; supplier-borne intrusions may sit for longer.
- Downtime procedures (paper) must start within minutes for emergency care; most hospitals can sustain them for days, not weeks.
- Ambulance diversion decisions are taken in the first hours.
- Restoring core clinical systems: one to four weeks; clearing backlogs and full recovery: months.
- Data publication follows refusal to pay within one to three weeks.

## Exercise hooks
- The laboratory provider shared by several hospitals is encrypted; no blood test results for the whole region.
- The emergency department asks whether to divert ambulances while the electronic record is down.
- A patient calls saying a criminal emailed her extracts of her medical history and asked for money.
- Ask who decides when clinical systems are safe to use again, and how the decision is documented.
- Test the downtime kit: are paper forms, printed rosters and medication lists up to date?
