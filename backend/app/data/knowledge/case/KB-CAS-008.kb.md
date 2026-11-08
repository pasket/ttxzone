---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-008"
kind: "case"
title: "Town hall encrypted: weeks without digital services and citizens' data published"
summary: "A mid-sized municipality loses its electronic office, internal systems and backups to ransomware; citizen services move to paper and queues, payroll and payments are at risk, the regional support service is overloaded, and residents' files appear on a leak site."
language: "en"
sectors: ["public-administration"]
families: ["ransomware", "data_breach"]
capabilities: ["continuity_recovery", "internal_external_comms", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1133", "enterprise:T1078", "enterprise:T1021.001", "enterprise:T1486", "enterprise:T1490", "enterprise:T1567.002"]
attack_groups: []
related: ["KB-TRD-014", "KB-ART-001", "KB-ART-010"]
source_class: "government-assessment"
period: "2023-2025"
reviewed: "2026-10-31"
---
# Town hall encrypted: weeks without digital services and citizens' data published

## Archetype
A municipality of tens of thousands of residents with a small IT team of a few people, a mix of in-house and supplier-hosted applications (tax, civil registry, social services, permits, payroll, local police), remote access for staff and suppliers, and backups on the same network. A ransomware affiliate enters through a supplier's remote access account without MFA, spends days moving through the shared domain, copies file shares and databases, and encrypts servers and backups over a weekend. The case also works with the attack hitting a software supplier shared by hundreds of municipalities instead of the town hall itself.

## Relative timeline
- **Day 0 (weekend)**: encryption of servers, file shares and backups; website and electronic office down; ransom note on screens on Monday morning.
- **Day 0 to day 2**: crisis committee convened; regional or national public CSIRT engaged; staff told not to use computers; counters reopen with paper forms.
- **Days 3 to 10**: priority restoration: payroll, social services emergency payments, civil registry; most services by appointment only; local media coverage daily.
- **Weeks 1 to 3**: initial containment and core services restored; investigations show data exfiltration.
- **Weeks 2 to 4**: residents' records published after the municipality refuses to pay; data protection notification and letters to residents; free identity monitoring offered.
- **Months 2 to 6**: full rebuild of the network and applications; backlog of permits, tax and procedures.

## Decision points
- Close everything or keep some systems running? Who decides at a weekend?
- Pay, when the ransom is a fraction of the recovery cost and many public bodies in the same situation have paid?
- Which services are essential (social emergencies, civil registry, payroll) and how do they run on paper?
- What can the municipality do alone, and what must it request from the regional or national support service?
- What do the mayor and councillors say, and when? How is political pressure managed?
- How and when are residents told their data may be published?

## Impacts
- Weeks without digital public services; queues at counters; delays in permits, payments to suppliers and social benefits.
- Publication of residents' personal data, sometimes including social services and police files.
- Recovery costs far exceeding the annual IT budget; external forensics and rebuild.
- Political consequences and loss of trust.

## Lessons
- Small administrations cannot defend alone: shared SOC services, regional support and joint contracts are essential.
- Supplier remote access must use MFA and be monitored.
- Offline or immutable backups decide whether recovery takes weeks or months.
- Paper continuity procedures for essential services should exist and be tested.
- Prepare communication for citizens, staff and councillors in advance.

## Inject ideas
- Monday morning: the receptionist finds a ransom note on every screen at the citizen service office (KB-ART-001).
- The head of social services needs to pay emergency benefits this week, and the system is down.
- The opposition party demands the mayor's resignation in a social media post.
- The regional support service says it can only send a team in three days because other entities are also affected.
- A resident calls: her neighbour found her social services file on a website.
- **In the Library**: the TTX-Zone scenario "town-hall" plays this case end to end.
