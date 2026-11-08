---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-CAS-010"
kind: "case"
title: "Stolen integration tokens: a SaaS vendor's breach empties customers' CRM data"
summary: "Attackers spend months inside a sales-software vendor, steal the OAuth tokens its chatbot integration holds for hundreds of customers, and use them to export CRM records and support cases, where they find more passwords and cloud keys to reuse."
language: "en"
sectors: ["technology-msp", "cross-sector"]
families: ["supply_chain", "cloud_compromise", "data_breach"]
capabilities: ["third_party_supply_chain", "incident_classification", "regulatory_notification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1213.003", "enterprise:T1528", "enterprise:T1550.001", "enterprise:T1213", "enterprise:T1552.001", "enterprise:T1078.004"]
attack_groups: []
related: ["KB-TRD-010", "KB-TRD-003", "KB-ART-003"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
---
# Stolen integration tokens: a SaaS vendor's breach empties customers' CRM data

## Archetype
Any organization whose sales or support team connected a third-party SaaS tool (a chatbot, a sales-engagement platform) to its CRM with a broad OAuth grant. The integration works quietly in the background, owned by the sales department, unknown to security. Most CRMs also hold support cases in which customers and staff have pasted passwords, API keys and cloud access tokens. Attackers compromise the vendor's code repository and cloud environment, wait, then use the stored tokens to read each customer's CRM as if they were the integration.

## Relative timeline
- **Months -6 to -3**: attackers access the vendor's code repository and cloud environment, undetected.
- **Weeks -4 to -1**: using stolen integration tokens, they run bulk queries against hundreds of customers' CRM instances, exporting accounts, contacts and support cases; they scan the data for secrets with open-source tools.
- **Week -1**: some customers notice odd API activity from the integration's identity; most see nothing because it looks like normal automation.
- **Day 0**: the vendor and the CRM platform revoke all tokens for the integration and publish an advisory; customers' integrations stop working.
- **Days 1 to 14**: customers investigate what was exported, rotate secrets found in support cases, and decide whether they must notify regulators and their own customers. Several security vendors disclose they were affected.
- **Following weeks**: attempts to use the harvested cloud keys against customers' environments.

## Decision points
- Day 0: what could the integration access, and who in the organization even knew it existed?
- Are SaaS audit logs available and retained long enough to know what was exported?
- Which secrets appeared in support cases, and how fast can they all be rotated?
- Is it a personal data breach (customer contact data) with a 72-hour clock, and when did it start?
- Who notifies the organization's own customers, and what do they say?
- Should all third-party integrations be reviewed or cut immediately?

## Impacts
- Bulk exposure of customer and contact data and of support case content across hundreds of organizations.
- Secondary compromise risk from passwords and cloud keys found in that content.
- Notification obligations and customer communications for each victim.
- Discovery of dozens of other forgotten or ownerless integrations.

## Lessons
- Inventory every OAuth integration, give each an owner and minimum scopes, and remove dormant ones.
- Prepare a "break-glass" plan to revoke tokens and disconnect integrations without improvising.
- Keep SaaS audit logs at sufficient depth and retention; alert on bulk exports by non-human identities.
- Never store secrets in tickets or CRM records; scan for them.
- Vendor breaches can stay hidden for months; contracts should require prompt notification and logs.

## Inject ideas
- The CRM platform emails all administrators: integration tokens for a chatbot vendor have been revoked due to suspicious activity (KB-ART-003).
- Sales complains that the chatbot on the website stopped working; nobody in IT knows who configured it.
- The SOC finds API queries exporting every support case during a weekend three weeks ago.
- A support case from last year contains a cloud administrator's access key; it is still valid.
- A customer asks whether its data was in the CRM export it read about in the news.
- **In the Library**: the TTX-Zone scenario "saas-token-breach" plays this case end to end.
