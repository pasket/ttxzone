"""The sample MSEL: ransomware with potential impact on a control centre,
consistent with the sample needs form (`_complete_payload` in
test_ttx_needs_form.py). 180 minutes at 1 min = 20 min of scenario, four
phases, 13 mandatory and 5 contingent injects, every mandatory one
validated -- complete, so it can reach READY. Fictitious names, no real
indicators of compromise."""

AREAS = ("Crisis Committee", "SOC", "OT Operations")

# The sample's ATT&CK techniques (v19.2) and the tactic each serves here.
TECHNIQUE_TACTICS = {
    "T1566": ("enterprise", "TA0001"),
    "T1486": ("enterprise", "TA0040"),
    "T1490": ("enterprise", "TA0040"),
    "T1498": ("enterprise", "TA0040"),
    "T1021": ("enterprise", "TA0008"),
    "T0826": ("ics", "TA0105"),
    "T0827": ("ics", "TA0105"),
}


def attack_ref(technique_id: str) -> dict:
    domain, tactic_id = TECHNIQUE_TACTICS[technique_id]
    return {"domain": domain, "tactic_id": tactic_id, "technique_id": technique_id}


# Every phase of the sample lasts this long.
PHASE_MINUTES = 45

# (phase, offset, title, recipient, objective index, actor type, technique)
MANDATORY = (
    (0, 0, "SOC alert: mass file renames on the file server", 1, 2, "soc", "T1486"),
    (0, 10, "Helpdesk flooded with 'files won't open' calls", 1, 2, "other", "T1486"),
    (0, 20, "Ransom note found on an engineering workstation", 0, 2, "threat_actor", "T1486"),
    (0, 35, "Phishing email traced as the entry point", 1, 1, "soc", "T1566"),
    (1, 45, "Backups on the file server were deleted", 2, 1, "soc", "T1490"),
    (1, 55, "Operator reports a frozen HMI in the control room", 2, 1, "other", "T0826"),
    (1, 70, "Journalist asks about a 'grid cyberattack'", 0, 0, "media", ""),
    (1, 80, "National CSIRT requests an incident notification", 0, 0, "csirt", ""),
    (2, 90, "Lateral movement seen towards the OT network", 2, 1, "soc", "T1021"),
    (2, 105, "Loss of control of a substation feeder", 2, 1, "other", "T0827"),
    (2, 120, "Competent authority asks for the 72-hour report", 0, 0, "authority", ""),
    (3, 140, "Attacker leaks sample data and sets a deadline", 0, 2, "threat_actor", ""),
    (3, 160, "Recovery plan ready for the committee's go/no-go", 0, 2, "other", ""),
)

# (phase, title, recipient, objective index, trigger, purpose)
CONTINGENT = (
    (0, "Second workstation encrypted", 1, 2, "The SOC hasn't escalated by T+30", "Accelerate"),
    (1, "Regulator calls the CEO directly", 0, 0, "No notification decision by T+75", "Pressure"),
    (2, "OT vendor offers remote support", 2, 1, "Isolation still undecided at T+110", "Redirect"),
    (3, "Board member demands a briefing", 0, 2, "Committee hasn't briefed the board", "Pressure"),
    (3, "Backup restore fails on first try", 2, 1, "Recovery goes smoothly", "Complicate"),
)

# Where each contingent inject branches off the storyline and comes back:
# (mandatory it hangs from, mandatory where it rejoins), by MANDATORY index.
BRANCHES = ((0, 3), (6, 8), (8, 10), (11, 12), (11, 12))

ACTIONS = (
    "Committee records the early-warning decision with its rationale",
    "OT and IT agree in writing whether to isolate the control centre",
    "Crisis committee convenes and names an incident commander",
)


def example_payload(msel: dict) -> dict:
    """A complete MSEL payload for the MSEL `msel` (as GET returns it)."""
    objectives = [o["id"] for o in msel["needs"]["objectives"]]
    actor_by_type = {a["type"]: a["id"] for a in msel["actors"]}
    phases = [
        {
            "key": f"p{index}",
            "name": name,
            "start_offset": index * PHASE_MINUTES,
            "end_offset": (index + 1) * PHASE_MINUTES,
            # The plant goes dark overnight: OT impact opens 12 h later.
            "incident_jump_minutes": 720 if name == "OT impact" else 0,
            "situation_update": f"Situation update for {name.lower()}.",
            "key_questions": ["Who decides, and on what information?"],
            "objective_ids": objectives,
        }
        for index, name in enumerate(("Detection", "Escalation", "OT impact", "Recovery"))
    ]

    def inject(phase: int, title: str, recipient: int, objective: int, **extra) -> dict:
        key = extra["key"]
        # Within the phase: an action never runs past its phase's end.
        within = extra.pop("within", 15)
        return {
            "phase_key": f"p{phase}",
            "title": title,
            "content": f"{title}. (Literal text of the inject.)",
            "actor_key": actor_by_type[extra.pop("actor", "soc")],
            "recipients": [AREAS[recipient]],
            "delivery_method": "email",
            "objective_ids": [objectives[objective]],
            "expected_actions": [
                {
                    "key": f"{key}-a0",
                    "description": ACTIONS[objective],
                    "responsible_role": AREAS[recipient],
                    "expected_within_minutes": within,
                }
            ],
            "review_status": "validated",
            "validated_by": "Controller Example",
            **extra,
        }

    injects = [
        inject(
            phase,
            title,
            recipient,
            objective,
            key=f"m{index}",
            kind="mandatory",
            offset_minutes=offset,
            within=min(15, PHASE_MINUTES - offset % PHASE_MINUTES),
            actor=actor,
            attack_techniques=[attack_ref(technique)] if technique else [],
            # The affiliate's activity; the rest has no ATT&CK.
            attack_attribution="threat_actor" if technique else None,
            threat_actor_key="t0" if technique else None,
        )
        for index, (phase, offset, title, recipient, objective, actor, technique) in enumerate(
            MANDATORY
        )
    ]
    injects += [
        inject(
            phase,
            title,
            recipient,
            objective,
            key=f"c{index}",
            kind="contingent",
            trigger_condition=trigger,
            contingent_purpose=purpose,
            branch_from_key=f"m{BRANCHES[index][0]}",
            # One fires on its parent's expected action not being observed.
            branch_action_key=f"m{BRANCHES[index][0]}-a0" if index == 1 else None,
            rejoin_key=f"m{BRANCHES[index][1]}",
            review_status="draft",
            validated_by="",
        )
        for index, (phase, title, recipient, objective, trigger, purpose) in enumerate(CONTINGENT)
    ]
    return {
        "revision": msel["revision"],
        "title": "Operation Dark Grid",
        "summary": "A ransomware group hits the corporate network on a Monday morning; "
        "by midday the control centre is at risk.",
        "threat_actors": [
            {
                "key": "t0",
                "name": "Ransomware affiliate (fictitious)",
                "description": "Financially motivated; buys access, then encrypts and extorts.",
                "techniques": [
                    {"domain": TECHNIQUE_TACTICS[t][0], "technique_id": t}
                    for t in ("T1566", "T1486", "T1490", "T1021", "T0826", "T0827")
                ],
            }
        ],
        "exercise_start": "09:30:00",
        # Inside the fiction the attack lands at 06:45, before the shift.
        "incident_start": "06:45:00",
        "duration_minutes": 180,
        "time_compression": 20,
        "actors": [
            {"id": a["id"], "key": a["id"], "name": a["name"], "type": a["type"], "played_by": ""}
            for a in msel["actors"]
        ],
        "phases": phases,
        "injects": injects,
    }
