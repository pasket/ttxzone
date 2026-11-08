---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-ART-009"
kind: "artifact"
title: "Endpoint detection alert: credential dumping and attempts to disable protection"
summary: "A cluster of endpoint alerts on a server overnight: a remote-access tool installed, memory of the credential process read, a vulnerable driver loaded and the protection agent's tamper protection triggered, all under a legitimate admin account."
language: "en"
sectors: ["cross-sector"]
families: ["ransomware"]
capabilities: ["detection_triage_escalation", "incident_classification"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1219", "enterprise:T1003.001", "enterprise:T1068", "enterprise:T1685", "enterprise:T1078.002"]
attack_groups: []
related: ["KB-TRD-001", "KB-TRD-015"]
source_class: "annual-industry-report"
period: "2025"
reviewed: "2026-10-31"
stage: "detection"
delivery_method: "security_tool"
actor: "soc"
variables: ["organization_short", "critical_system", "host_name", "admin_account", "alert_id"]
variable_defaults: {"host_name": "SRV-FILE-02", "admin_account": "adm.backup", "alert_id": "EDR-77213"}
---
# Endpoint detection alert: credential dumping and attempts to disable protection

## Purpose
The moment, hours or days before encryption, when an attack can still be stopped. It tests whether the SOC escalates at night, whether someone has authority to isolate a production server and disable an admin account without business approval, and whether the team recognizes the pattern of a hands-on intruder rather than a single piece of malware.

## Template
{organization_short} endpoint protection -- incident {alert_id} -- severity: high -- status: new (unassigned)

Host: {host_name} (supports {critical_system}) -- user: {admin_account}

Timeline (last 2 hours):
- 02:14 Remote access tool installed and started as a service. Signed binary, not on the approved software list.
- 02:31 Suspicious access to the memory of the local credential process. Action: detected, not blocked (policy: audit).
- 02:47 Known vulnerable kernel driver loaded from a temporary folder.
- 02:49 Tamper protection: attempt to stop the protection agent service. Action: blocked.
- 02:52 Exclusion rule for a user folder modified by {admin_account} to apply to all users.
- 03:05 Agent on {host_name} reports reduced telemetry.

Related: same account logged in to 4 other servers in the last 24 hours. No previous alerts.

## Variants
- **Blocked everything**: all steps blocked; the question is whether the threat is gone or only stalled.
- **Silent agent**: the agent stops reporting entirely after 02:49; the console shows the host as "offline".
- **Legitimate admin**: the account belongs to a backup contractor who says they were working, but can't explain the driver.
- **Weekend**: the alert arrives on a Saturday; the on-call analyst can't reach the server owner.
- **In the Library**: TTX-Zone inject INJ-RAN-11, ready to copy into an MSEL.

## Realism notes
- Real intruders increasingly use legitimate tools and valid accounts; most detections in some datasets involve no malware at all.
- Disabling or blinding endpoint protection with vulnerable drivers and "EDR killer" tools is standard in ransomware kits, as is quietly widening exclusion rules with stolen admin access.
- Alerts in "audit" mode and unassigned queues are realistic: the point is that the signal existed.
- Expected good outcome: isolate the host, disable and reset the account, hunt for the same account and tools elsewhere, escalate as a potential major incident, and preserve evidence.
