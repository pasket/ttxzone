---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-013"
kind: "artifact"
title: "Cloud provider abuse notice: exposed access key and unusual usage"
summary: "The cloud provider's automated security notice: an access key was found in a public code repository, new compute and AI model usage appeared in unused regions, and the provider has applied a restrictive policy pending action."
language: "en"
sectors: ["cross-sector", "technology-msp"]
families: ["cloud_compromise"]
capabilities: ["detection_triage_escalation", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1552.001", "enterprise:T1078.004", "enterprise:T1496", "enterprise:T1580"]
attack_groups: []
related: ["KB-TRD-010", "KB-TRD-009"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "email"
actor: "cloud-provider"
variables: ["organization", "account_id", "key_owner", "unused_regions", "case_id"]
variable_defaults: {"account_id": "4401-2287-9135", "key_owner": "ci-deploy-service", "unused_regions": "three regions on two other continents", "case_id": "ABUSE-55120"}
---
# Cloud provider abuse notice: exposed access key and unusual usage

## Purpose
A common, unglamorous start to a cloud incident: the warning comes from the provider, by email, to an address that may be a shared mailbox or a former employee. It tests whether the notice reaches someone, whether the team can tell what the key could do, how fast it can rotate without breaking production, and whether it investigates beyond the bill.

## Template
Subject: [Action required] Possible compromise of your account {account_id} -- case {case_id}

Dear customer,

Our automated systems detected that an access key belonging to the identity {key_owner} in account {account_id} ({organization}) was published in a public code repository approximately 6 hours ago.

Since then we have observed activity from this key that differs from your usual pattern:
- Enumeration of storage buckets, identities and services in all regions.
- Creation of large compute instances and invocation of AI model services in {unused_regions}, where your account had no prior usage.
- Estimated additional charges in the last 6 hours: 18,400.

As a precaution we have attached a restrictive policy to the key. This may affect your workloads that use it.

Please act now: rotate or delete the key, review activity logs for the period, remove any resources you did not create, and contact us via case {case_id}. Charges resulting from unauthorized usage may not be credited if action is not taken promptly.

Cloud Trust and Safety

## Variants
- **Wrong inbox**: the notice went to an engineer who left months ago; it is found two days later.
- **Data access**: logs show the key also read a storage bucket with customer exports.
- **Persistence**: the attacker created a new identity with administrator rights before the key was restricted.
- **Production impact**: the restriction breaks the deployment pipeline during a release.
- **In the Library**: TTX-Zone inject INJ-CLD-02, ready to copy into an MSEL.

## Realism notes
- Keys leaked in public repositories are found and used by attackers within minutes; the provider's notice often arrives after the first abuse.
- Abuse is frequently cryptomining or running expensive AI models on the victim's bill, but the same key may reach data.
- Exposed secrets in public repositories keep growing year on year.
- Expected good outcome: rotate the key, check for new identities and resources, review data access, scan repositories for other secrets, fix the notification contact, and decide whether personal data was exposed.
