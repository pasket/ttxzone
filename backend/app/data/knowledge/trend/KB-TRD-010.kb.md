---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-010"
kind: "trend"
title: "Cloud and SaaS intrusions: stolen tokens, abused integrations and data theft at scale"
summary: "Attackers skip the endpoint and go straight to cloud identity and SaaS data: valid accounts, OAuth tokens stolen from integration vendors, abuse of hybrid identity links and service accounts, and bulk export of CRM and file-sharing data from hundreds of tenants at once."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["cloud_compromise", "data_breach", "supply_chain"]
capabilities: ["detection_triage_escalation", "third_party_supply_chain", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1566.004", "enterprise:T1078.004", "enterprise:T1528", "enterprise:T1550.001", "enterprise:T1098.001", "enterprise:T1484.002", "enterprise:T1580", "enterprise:T1213", "enterprise:T1530", "enterprise:T1537"]
attack_groups: ["G1057"]
related: ["KB-TRD-002", "KB-TRD-003", "KB-ART-003"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Cloud and SaaS intrusions: stolen tokens, abused integrations and data theft at scale

## Overview
Much of an organization's valuable data now sits in SaaS platforms (CRM, file sharing, collaboration, data warehouses, payroll) reached through a cloud identity provider. Attackers follow it. Financially motivated groups such as ShinyHunters call employees or the help desk posing as IT staff, obtain single sign-on credentials and MFA codes, then connect a tool of their own to the CRM and export everything. Others compromise a SaaS vendor that integrates with many customers, steal the OAuth tokens it holds, and read each customer's data without ever touching their login page, so no MFA alert fires. State groups target the links between on-premises directories and the cloud (synchronization services, federation) to forge access, and add their own credentials to applications and service accounts for persistence. Exfiltrated data feeds extortion, fraud and follow-on attacks on the victims' customers.

## Indicative figures
- Cloud-focused intrusions rose by roughly a third year on year, and by several times among state-linked groups.
- Valid-account abuse is behind about a third of cloud incidents.
- Data collection or exfiltration occurs in roughly 80 % of cloud and extortion response cases.
- Data volumes per victim range from a few gigabytes to well over a terabyte.
- One campaign through a SaaS integration vendor's stolen tokens affected hundreds of customer organizations; the vendor intrusion went unnoticed for three to four months.
- Average time for criminal intruders to move beyond the first foothold is under half an hour, and the fastest cases under a minute.

## Typical attack chain
1. **Access**: voice phishing of staff or help desk for SSO credentials and MFA (T1566.004), or valid cloud accounts bought from brokers (T1078.004).
2. **Token theft**: OAuth tokens and secrets taken from a SaaS vendor's environment or from code repositories (T1528), then replayed against customers' tenants (T1550.001).
3. **Persistence**: new credentials added to applications and service principals (T1098.001); in advanced cases, federation or synchronization settings changed (T1484.002).
4. **Discovery**: enumeration of tenants, storage and connected applications (T1580).
5. **Collection**: bulk queries against CRM and document platforms (T1213, T1530).
6. **Exfiltration**: data copied to attacker-controlled cloud accounts (T1537), followed by extortion or reuse of found secrets.

## Realistic timings
- Voice phishing to SaaS data export: hours.
- Vendor intrusion to token abuse against customers: weeks to months.
- Customers learn of integration abuse from the vendor's notice, often days to weeks after the data was read.
- Extortion follows data theft within days to a few weeks.

## Exercise hooks
- A SaaS integration vendor announces it has revoked all tokens "as a precaution"; the organization has to work out what that integration could read (KB-ART-003).
- The CRM shows a new connected application with full data access, authorized by a sales employee after an "IT" phone call.
- Someone posts a sample of the organization's customer records on a leak forum; no internal system shows an intrusion.
- Ask who owns SaaS security: IT, the business unit that bought the tool, or the vendor?
- Test the logs: are SaaS audit logs retained long enough, and does anyone have access to them during an incident?
