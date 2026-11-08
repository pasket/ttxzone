"""PDF export of an exercise's needs analysis: every section, the
traceability matrix, and a signature block per approver at the end -- the
document the sponsor and the design lead sign (its signed scan can then be
attached to their approval as evidence).

Every page carries the TLP label at the top and bottom, as the FIRST TLP
standard requires for documents. All user-typed text is escaped (html.escape) before it
reaches reportlab's Paragraph markup parser: unescaped, a value like
`<img src="/etc/...">` would be interpreted, not printed."""

from datetime import UTC, datetime
from html import escape

from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Spacer, Table, TableStyle
from sqlmodel import Session

from app.data.regulatory_catalog import FRAMEWORK_CATALOG, FRAMEWORK_OTHER, REGULATORY_CATALOG
from app.models import TTX
from app.schemas.ttx_needs_form import NeedsFormRead
from app.services.needs_pdf_labels import LABELS
from app.services.objective_text import condition_lines, evidence_items, objective_name
from app.services.pdf_common import (
    BAND,
    CONTENT_WIDTH,
    LINE,
    TLP_TEXT,
    build_pdf,
    bullets,
    code_ref,
    code_ref_cell,
    numbered,
    ref_lines,
    tlp_file_part,
)
from app.services.pdf_common import format_date as _format_date
from app.services.pdf_common import grid as _grid
from app.services.pdf_common import join as _join
from app.services.pdf_common import kv_table as _kv_table
from app.services.pdf_common import para as _p
from app.services.pdf_common import text as _text
from app.services.ttx_needs_form_service import form_read, get_form

MUTED = "#5B6270"


def measure_lines(objective, measure: dict) -> list[str]:
    """How an objective is judged, as plain sentences: the rule ("all 3" /
    "at least 2 of 3") and the time box. `objective` is any object with the
    needs objective's fields (model or read schema)."""
    n = len(condition_lines(objective.success_criterion))
    out = []
    if n:
        if objective.achieve_at_least:
            out.append(measure["at_least"].format(k=objective.achieve_at_least, n=n))
        else:
            out.append(measure["one"] if n == 1 else measure["all"].format(n=n))
    if objective.time_box_minutes:
        out.append(measure["time_box"].format(minutes=objective.time_box_minutes))
    return out


def criterion_cell(objective, measure: dict) -> str:
    """The conditions numbered, then the rule, time box and rating
    guidance in the muted colour."""
    notes = [escape(line) for line in measure_lines(objective, measure)]
    levels = measure["levels"]
    for key, value in (
        ("achieved", objective.achieved_note),
        ("partial", objective.partially_achieved),
        ("not", objective.not_achieved),
    ):
        if value.strip():
            notes.append(f"<b>{escape(levels[key])}:</b> {_text(value)}")
    tail = f"<br/><font color='{MUTED}'>{'<br/>'.join(notes)}</font>" if notes else ""
    return numbered(condition_lines(objective.success_criterion)) + tail


def evidence_cell(objective, mark: str = "•") -> str:
    return bullets(evidence_items(objective.evidence), mark)


def _signature_block(kind: str, name: str, role: str, labels: dict, optional: bool) -> Table:
    sig = labels["signature"]
    title = escape(labels["approvers"][kind])
    if optional:
        title += f" <font color='#5B6270'>{escape(sig['optional'])}</font>"
    rows = [
        [_p(title, "head"), ""],
        [_p(escape(sig["name"]), "label"), _p(_text(name, ""))],
        [_p(escape(sig["role"]), "label"), _p(_text(role, ""))],
        [_p(escape(sig["date"]), "label"), ""],
        [_p(escape(sig["signature"]), "label"), ""],
    ]
    table = Table(
        rows,
        colWidths=[35 * mm, CONTENT_WIDTH - 35 * mm],
        rowHeights=[None, 9 * mm, 9 * mm, 9 * mm, 22 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (1, 0), BAND),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LINEBELOW", (0, 1), (-1, -2), 0.3, LINE),
                ("VALIGN", (0, 1), (-1, -1), "MIDDLE"),
                ("VALIGN", (0, 4), (0, 4), "TOP"),
            ]
        )
    )
    return table


def render_needs_pdf(session: Session, ttx: TTX, locale: str) -> tuple[bytes, str]:
    """The PDF bytes and its file name ({code}_v{version}_{TLP}.pdf). The
    PDF is what the approvers sign, so with anything but the approvals
    missing it's a working draft: "DRAFT -- NOT VALID FOR APPROVAL" on every
    page, how much is missing on the first, and _DRAFT in its name."""
    labels = LABELS.get(locale, LABELS["en"])
    form: NeedsFormRead = form_read(session, ttx, get_form(session, ttx.id))
    incomplete = len(form.validation.ready)
    months = labels["months"]
    none = labels["none"]
    table_labels = labels["table"]
    fields = labels["fields"]
    spanish = locale == "es"
    frameworks = {f.id: f for f in FRAMEWORK_CATALOG}

    def framework_label(framework_id: str) -> str:
        framework = frameworks.get(framework_id)
        if framework is None:
            return framework_id
        return framework.label_es if spanish else framework.label_en

    catalog = {r.id: f"{framework_label(r.framework)} {r.reference}" for r in REGULATORY_CATALOG}
    needs_by_id = {need.id: need for need in form.needs}

    # Needs and objectives are named code first, title after; several, one
    # per line (pdf_common.code_ref).
    def need_ref(need_id) -> str:
        need = needs_by_id.get(need_id)
        return code_ref(need.code, _need_name(need), cut=40) if need else ""

    def requirements(ids: list[str]) -> str:
        return ref_lines([escape(catalog.get(r, r)) for r in ids], none)

    story: list = []

    def section(key: str) -> None:
        story.append(_p(escape(labels["sections"][key]), "h2"))
        story.append(Spacer(1, 3))

    # Title block
    story += [
        _p(escape(labels["title"]), "title"),
        _p(f"{escape(ttx.code)} · {escape(ttx.name)}", "subtitle"),
        Spacer(1, 6),
    ]
    if incomplete:
        story.append(_p(escape(labels["incomplete_notice"].format(count=incomplete)), "notice"))
        story.append(Spacer(1, 4))
    elif form.status != "approved":
        story.append(
            _p(
                escape(
                    labels["draft_notice"].format(
                        version=form.version, status=labels["statuses"][form.status]
                    )
                ),
                "notice",
            )
        )
        story.append(Spacer(1, 4))

    section("document")
    story.append(
        _kv_table(
            [
                (labels["code"], escape(ttx.code)),
                (labels["exercise"], _text(ttx.name)),
                (labels["version"], str(form.version)),
                (labels["status"], escape(labels["statuses"][form.status])),
                (labels["date"], _format_date(form.document_date, months)),
                (labels["design_lead"], _text(form.design_lead)),
                (labels["tlp"], TLP_TEXT[form.tlp]),
            ]
        )
    )

    section("sponsorship")
    aar = (
        form.aar_recipient_other
        if form.aar_recipient == "other"
        else labels["aar_recipients"].get(form.aar_recipient or "", "")
    )
    sponsor = ", ".join(v for v in (form.sponsor_name, form.sponsor_role) if v.strip())
    story.append(
        _kv_table(
            [
                (fields["sponsor"], _text(sponsor)),
                (fields["sponsor_motivation"], _text(form.sponsor_motivation)),
                (
                    fields["findings_commitment"],
                    labels["yes"] if form.findings_closure_commitment else labels["no"],
                ),
                (fields["findings_owner"], _text(form.findings_owner)),
                (fields["aar_recipient"], _text(aar)),
            ]
        )
    )

    section("triggers")
    triggers = [
        form.trigger_other if t == "other" and form.trigger_other else labels["triggers"][t]
        for t in form.triggers
    ]
    story.append(
        _kv_table(
            [
                (fields["triggers"], _join(triggers, none)),
                (
                    fields["regulations"],
                    _join(
                        [
                            form.regulatory_framework_other or labels["other_regulation"]
                            if f == FRAMEWORK_OTHER
                            else framework_label(f)
                            for f in form.regulatory_frameworks
                        ],
                        none,
                    ),
                ),
            ]
        )
    )
    # Why each named regulation is worth a tabletop -- the justification the
    # sponsor signs off and an auditor reads.
    rationale_rows = [
        [
            escape(framework_label(f.id)),
            escape(f.rationale_es if spanish else f.rationale_en),
            escape(f.rationale_reference),
        ]
        for f in FRAMEWORK_CATALOG
        if f.id in form.regulatory_frameworks
    ]
    if rationale_rows:
        story.append(Spacer(1, 6))
        story.append(
            _grid(
                [
                    escape(table_labels[k])
                    for k in ("regulation", "tabletop_rationale", "reference")
                ],
                rationale_rows,
                [0.2, 0.55, 0.25],
            )
        )

    section("needs")
    story.append(
        _grid(
            [escape(table_labels[k]) for k in ("need", "source", "capability", "priority")],
            [
                [
                    # Named by its title; what it found, under it.
                    code_ref_cell(need.code, need.title or need.finding)
                    + (
                        f'<br/><font size="7.5">{escape(need.finding)}</font>'
                        if need.title and need.finding.strip()
                        else ""
                    ),
                    escape(labels["sources"][need.source]),
                    escape(labels["capabilities"][need.affected_capability]),
                    escape(labels["priorities"][need.priority]),
                ]
                for need in form.needs
            ]
            or [[none, none, none, none]],
            [0.48, 0.16, 0.24, 0.12],
        )
    )

    section("capabilities")
    story.append(_p(_join([labels["capabilities"][c] for c in form.capabilities], none), "body"))

    section("objectives")
    story.append(
        _grid(
            [
                escape(table_labels[k])
                for k in ("objective", "needs", "criterion", "evidence", "requirements")
            ],
            [
                [
                    f"{code_ref_cell(o.code, objective_name(o))}"
                    + (f"<br/>{_text(o.statement)}" if o.title.strip() else "")
                    + "<br/><font color='#5B6270'>"
                    f"{escape(labels['capabilities'][o.capability])}</font>",
                    ref_lines([need_ref(n) for n in o.linked_need_ids], none),
                    criterion_cell(o, labels["measure"]),
                    evidence_cell(o),
                    requirements(o.regulatory_requirement_ids),
                ]
                for o in form.objectives
            ]
            or [[none] * 5],
            [0.3, 0.2, 0.18, 0.16, 0.16],
        )
    )

    section("scope")
    story.append(
        _kv_table(
            [
                (fields["levels"], _join([labels["levels"][lv] for lv in form.levels], none)),
                (fields["participating_areas"], _join(form.participating_areas, none)),
                (fields["third_parties"], _join(form.third_parties, none)),
                (fields["perimeter"], _text(form.perimeter)),
                (fields["out_of_scope"], _text(form.out_of_scope)),
            ]
        )
    )

    section("constraints")
    window = (
        f"{_format_date(form.date_window_start, months)} – "
        f"{_format_date(form.date_window_end, months)}"
    )
    story.append(
        _kv_table(
            [
                (fields["date_window"], window),
                (
                    fields["max_duration"],
                    escape(fields["hours"].format(hours=form.max_duration_hours))
                    if form.max_duration_hours
                    else none,
                ),
                (fields["availability"], _text(form.key_participants_availability)),
                (fields["confidentiality"], _text(form.confidentiality_restrictions)),
                (fields["budget"], _text(form.budget_and_external_support)),
                (fields["operational_impact"], escape(fields["operational_impact_value"])),
            ]
        )
    )

    section("risks")
    story.append(_kv_table([(fields["stop_keyword"], _text(form.stop_exercise_keyword))]))
    story.append(Spacer(1, 4))
    story.append(
        _grid(
            [escape(table_labels[k]) for k in ("risk", "mitigation", "owner")],
            [[_text(r.risk), _text(r.mitigation), _text(r.owner)] for r in form.risks]
            or [[none, none, none]],
            [0.34, 0.46, 0.2],
        )
    )

    section("traceability")
    linked = {n for o in form.objectives for n in o.linked_need_ids}
    rows = [
        [
            code_ref_cell(needs_by_id[need_id].code, _need_name(needs_by_id[need_id]))
            if need_id in needs_by_id
            else none,
            escape(labels["capabilities"][o.capability]),
            code_ref_cell(o.code, objective_name(o)),
            numbered(condition_lines(o.success_criterion)),
            requirements(o.regulatory_requirement_ids),
        ]
        for o in form.objectives
        for need_id in o.linked_need_ids
    ] + [
        [
            code_ref_cell(need.code, _need_name(need)),
            f"<font color='#B42318'>{escape(table_labels['orphan'])}</font>",
            none,
            none,
            none,
        ]
        for need in form.needs
        if need.priority == "high" and need.id not in linked
    ]
    story.append(
        _grid(
            [
                escape(table_labels[k])
                for k in ("need", "capability", "objective", "criterion", "requirements")
            ],
            rows or [[none] * 5],
            [0.22, 0.16, 0.22, 0.24, 0.16],
        )
    )

    # Approval and signatures -- kept together so a block never splits.
    sig = labels["signature"]
    current = {a.approver_kind: a for a in form.approvals if a.version == form.version}
    defaults = {
        "sponsor": (form.sponsor_name, form.sponsor_role),
        "design_lead": (form.design_lead, ""),
        "compliance": ("", ""),
    }
    blocks: list = [
        _p(escape(labels["sections"]["approval"]), "h2"),
        Spacer(1, 3),
        _p(escape(sig["intro"]), "body"),
        Spacer(1, 8),
    ]
    for kind in ("sponsor", "design_lead", "compliance"):
        approval = current.get(kind)
        name, role = (
            (approval.approver_name, approval.approver_role) if approval else defaults[kind]
        )
        block = [_signature_block(kind, name, role, labels, optional=kind == "compliance")]
        if approval:
            block.append(Spacer(1, 2))
            block.append(
                _p(
                    escape(
                        sig["recorded"].format(
                            date=_format_date(approval.recorded_at, months),
                            name=approval.recorded_by_name,
                        )
                    ),
                    "small",
                )
            )
        block.append(Spacer(1, 8))
        blocks.append(KeepTogether(block))
    story.append(KeepTogether(blocks[:5]))
    story += blocks[5:]

    story.append(Spacer(1, 6))
    story.append(
        _p(
            escape(labels["generated"].format(date=_format_date(datetime.now(UTC), months))),
            "small",
        )
    )

    header = f"{ttx.code} · {labels['title']} · {labels['version']} {form.version}"
    content = build_pdf(
        story,
        header=header,
        title=f"{ttx.code} {labels['title']}",
        tlp=form.tlp,
        labels=labels,
        banner=labels["draft_banner"] if incomplete else None,
    )
    draft = "_DRAFT" if incomplete else ""
    return content, f"{ttx.code}_v{form.version}{draft}_{tlp_file_part(form.tlp)}.pdf"


def _need_name(need) -> str:
    """How a need is named: its title, or -- before it had one -- its finding."""
    return need.title or need.finding
