---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-011"
kind: "case"
title: "Global outage of a productivity suite provider: a day and a half without email, chat or files"
summary: "A configuration change at a productivity suite provider takes email, chat, calendars, files and part of identity down worldwide for about a day and a half; nobody doubts the cause, so the case tests how much the business depends on one provider and whether its alternatives were ready or improvised."
language: "en"
sectors: ["cross-sector", "retail-ecommerce"]
families: ["cloud_compromise", "generic"]
capabilities: ["continuity_recovery", "third_party_supply_chain", "crisis_decision_making"]
attack_version: "19.2"
attack_techniques: []
attack_groups: []
related: ["KB-CAS-005", "KB-CAS-010", "KB-TRD-002", "KB-TRD-018"]
source_class: "trade-magazine"
period: "2026"
reviewed: "2026-11-14"
---
# Global outage of a productivity suite provider: a day and a half without email, chat or files

## Archetype
Any organization whose email, chat, calendars, shared files and part of its identity run on a single SaaS provider. The provider suffers a global outage that it announces itself, early and in public, so there is no attribution question and no attacker to chase. What the outage exposes is dependence and preparedness: whether the crisis plan, the contact list and the war room live on the platform that has failed, whether alternative channels were chosen and tested beforehand, and who takes time-critical business decisions while the usual coordination tools are gone. Security still appears, but only where the outage brings it: self-generated traffic that looks like an attack, pressure to relax multi-factor authentication, and fraudsters using the outage as a pretext.

## Relative timeline
- **T+0, end of the working day**: email, chat, calendars and shared files fail at once; meetings in progress drop. Sign-in and verification work intermittently.
- **~T+40 min**: the provider acknowledges an incident in one region.
- **~T+1 h**: a global warning follows, with user reports from dozens of countries within the hour. The provider states the cause early: some servers became unavailable and the rest are overloaded. It says explicitly that it is not a cyberattack.
- **~T+5 h**: the provider warns that services already restored may stop responding again; teams that went back to the suite lose it a second time.
- **~T+11 h**: partial recovery; chat, meetings and calendars return in most regions.
- **~T+16 h**: only email is still affected; mailbox access and delivery keep failing.
- **Day 2, afternoon**: delivery queues drain towards normal.
- **Day 3, morning**: the service is declared fully restored. The provider apologizes in public and gives the cause: a configuration change that overwhelmed the process establishing secure connections, so servers stopped handling requests.
- **Context**: the same provider had another major outage the previous month.

## Decision points
- Which channel does the crisis team use, and did it exist before today or is it being improvised on personal apps?
- Go back to a service that keeps coming back and dropping again, or stay on the contingency channels until it is stable, and with what criterion for returning?
- Relax multi-factor authentication so people can work: for whom, until when, and who switches it back on?
- Time-critical business decisions that can't wait for the provider: a commercial launch, a trading update or results publication, supplier and carrier payments.
- Reinforce phone lines and other customer channels while shared mailboxes, web forms and the AI assistant are down, and at what cost.
- Release the email queued during the outage at once, or after a new scan, knowing it arrived while filtering and link checking ran degraded.
- Notify the insurer within the policy deadline, and decide whether to accept service credits or claim against the provider.

## Impacts
- Lost productivity estimated in the billions worldwide.
- Financial reporting and other deadline-bound work delayed while files and email were unreachable.
- Traders and dealing desks back on phones; field teams coordinated by text messages.
- Public services asking citizens to phone instead of using online forms; health services back on paper for scheduling and messaging.
- AI assistants built into the suite and third-party AI integrations that relied on it went down with it.
- Partners that used the same provider (outsourced call centres, carriers) lost their channel at the same time: a fourth-party dependency nobody had mapped.

## Lessons
- Crisis plans, contact directories and supplier contracts were stored on the platform that failed; nobody had an offline copy at hand.
- Alternative channels were improvised on personal messaging apps and personal email, putting company and customer data outside any control or record.
- The provider's support numbers and account contacts existed only in email.
- Few people knew what the contract, the service level or the insurance policy actually entitled the organization to.
- Security tools showed sign-in failures and request peaks from the organization's own users and apps, retrying in loops; at first sight it looked like password spraying or a denial of service.
- Fraudsters used the outage as a pretext within hours: fake support calls and lookalike domains offering to "restore access", push-approval fatigue after a night of failed codes, and requests to change supplier bank details "because email is down".
- Improvement actions agreed after the previous outage had not been closed.

## Inject ideas
- The provider's status page says "investigating", lists email, chat, calendar and files as down, and gives no recovery time.
- The SOC reports a brute-force alert and asks to block the noisiest sources; they turn out to be the organization's own store exits and head office, retrying.
- The crisis team looks for its plan and finds that the plan, the directory and the contract are on the platform that is down.
- The provider announces recovery, then warns that restored services may stop responding again; teams that went back lose their messages.
- Treasury receives a call asking to change a supplier's bank account "because our email is down, like yours".
- Email delivery resumes with over a million messages queued that arrived while filtering was degraded; the business wants supplier orders out now.
- **In the Library**: the TTX-Zone scenario "black-friday-suite-outage" plays this case end to end.
