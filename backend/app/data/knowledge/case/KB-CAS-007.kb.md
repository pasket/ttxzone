---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-007"
kind: "case"
title: "Ransomware at a shared pathology laboratory paralyses a city's hospitals"
summary: "A ransomware attack on the laboratory provider that processes blood tests for several hospital trusts stops transfusion matching and test results across a large city: thousands of appointments and operations postponed, an appeal for blood donors, published patient data and months of recovery."
language: "en"
sectors: ["healthcare"]
families: ["ransomware", "supply_chain", "data_breach"]
capabilities: ["continuity_recovery", "third_party_supply_chain", "internal_external_comms"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1078", "enterprise:T1567.002", "enterprise:T1486", "enterprise:T1490", "enterprise:T1657"]
attack_groups: []
related: ["KB-TRD-011", "KB-TRD-003", "KB-ART-001"]
source_class: "government-assessment"
period: "2024"
reviewed: "2026-10-31"
---
# Ransomware at a shared pathology laboratory paralyses a city's hospitals

## Archetype
A private pathology company, run as a joint venture with public hospitals, processes blood tests, tissue samples and transfusion matching for several hospital trusts and hundreds of general practices across a large European city. Hospitals have outsourced the whole laboratory chain: they have no in-house capacity left, and their electronic records receive results directly from the provider's systems. A ransomware group encrypts the provider's laboratory information systems and steals its data. The hospitals are not compromised, yet they lose a service they cannot work without.

## Relative timeline
- **Day 0**: laboratory systems encrypted; the provider cannot receive orders or return results. Hospitals declare a critical incident; emergency surgery and urgent bloods prioritised by phone and paper.
- **Days 1 to 3**: blood transfusions limited to universal donor blood because cross-matching is unavailable; an urgent national appeal for donors of that blood type.
- **Week 1 to week 2**: thousands of outpatient appointments and over a thousand elective operations postponed; other laboratories absorb part of the load.
- **Week 2 to week 3**: the group publishes around 400 GB of patient and test data after a ransom demand in the tens of millions is refused; helplines open for worried patients.
- **Months 1 to 6**: phased rebuild of laboratory systems; backlogs ripple across the region; later review links at least one patient death to the delays.

## Decision points
- For hospitals: how to keep emergency and cancer care going without results, and which procedures to postpone.
- Who coordinates across trusts, general practices and the blood service, and who speaks to the public?
- For the provider: pay or refuse when patient care is directly affected?
- Can other laboratories be brought in quickly, and how do samples and results move without integration?
- When the data is published, how are patients told, and what support is offered?
- What does the contract say about the provider's resilience, and what can hospitals demand now?

## Impacts
- Over ten thousand outpatient appointments and well over a thousand elective procedures postponed at the most affected hospitals.
- Blood supply strain beyond the city.
- Publication of sensitive patient data; direct costs of tens of millions for the provider, several times its annual profit.
- At least one patient death associated with the disruption; long-term loss of trust.

## Lessons
- Outsourcing a clinical service outsources its cyber risk, not the responsibility for patients.
- Critical suppliers need tested continuity arrangements: alternative laboratories, manual result channels, priority rules.
- Shared providers create concentration risk across many hospitals at once; regional exercises should include them.
- Patient communication and helplines must be ready for the data-publication phase.
- Recovery is measured in months; plan staffing and backlog management early.

## Inject ideas
- The laboratory provider phones the emergency department: "we cannot return any results until further notice".
- The blood bank warns that only universal donor blood can be issued; the surgical director must decide which operations continue.
- A general practice asks where to send samples and how results will come back.
- The provider's chief executive asks the hospitals to support the decision not to pay.
- A patient group publishes screenshots of leaked test results (KB-ART-005, variant "leak-site source").
- **In the Library**: the TTX-Zone scenario "pathology-lab" plays this case end to end.
