"""Markdown export of an exercise's needs analysis: the same sections, in
the same order and with the same copy as the PDF (needs_pdf_labels), for
people who keep their documents in a wiki or a repository, or want to
paste a section somewhere.

Every user-typed value is escaped for Markdown (`md`): a backslash before
the characters a renderer would read as markup or HTML, line breaks kept
as `<br>` inside table cells only. The TLP label opens and closes the
document, as the FIRST TLP standard asks; a draft says so at the top, as
the PDF does, and its file name carries _DRAFT. Signatures are the PDF's
job: here the approvals are listed as recorded."""

import re
from datetime import UTC, datetime

from sqlmodel import Session

from app.data.regulatory_catalog import FRAMEWORK_CATALOG, FRAMEWORK_OTHER, REGULATORY_CATALOG
from app.models import TTX
from app.schemas.ttx_needs_form import NeedsFormRead
from app.services.needs_pdf_labels import LABELS
from app.services.needs_pdf_service import measure_lines
from app.services.objective_text import condition_lines, evidence_items, objective_name
from app.services.pdf_common import TLP_TEXT, tlp_file_part
from app.services.pdf_common import format_date as _format_date
from app.services.ttx_needs_form_service import form_read, get_form

# The characters that turn inline text into emphasis, code, a link, a
# table cell break or raw HTML, escaped with a backslash wherever they are;
# and what makes a line start a heading, quote or list, escaped there only.
# Everything else stays as typed, so the file reads well unrendered.
_SPECIAL = re.compile(r"([\\`*_\[\]<>|~])")
_LINE_START = re.compile(r"^(#|>|[-+](?=\s)|\d+[.)](?=\s))")


def md(value: str | None, none: str = "—") -> str:
    """A user value as inline Markdown text on one line."""
    if value is None or not str(value).strip():
        return none
    text = " ".join(line.strip() for line in str(value).splitlines() if line.strip())
    return _LINE_START.sub(r"\\\1", _SPECIAL.sub(r"\\\1", text))


def _cell(value: str) -> str:
    """Already-escaped text for a table cell: its line breaks as <br>."""
    return value.replace("\n", "<br>")


def _table(headers: list[str], rows: list[list[str]], none: str) -> list[str]:
    width = len(headers)
    body = rows or [[none] * width]
    return [
        "| " + " | ".join(md(h) for h in headers) + " |",
        "|" + "---|" * width,
        *("| " + " | ".join(_cell(c) for c in row) + " |" for row in body),
        "",
    ]


def _ref(code: str, title: str) -> str:
    """'**OBJ-01** · Title', as the app names a coded row."""
    if not title.strip():
        return f"**{md(code)}**"
    return f"**{md(code)}** · {md(title)}" if code else md(title)


def render_needs_markdown(session: Session, ttx: TTX, locale: str) -> tuple[str, str]:
    """The Markdown text and its file name ({code}_v{version}[_DRAFT]_{TLP}.md)."""
    labels = LABELS.get(locale, LABELS["en"])
    form: NeedsFormRead = form_read(session, ttx, get_form(session, ttx.id))
    incomplete = len(form.validation.ready)
    months, none = labels["months"], labels["none"]
    fields, table = labels["fields"], labels["table"]
    spanish = locale == "es"
    frameworks = {f.id: f for f in FRAMEWORK_CATALOG}

    def framework_label(framework_id: str) -> str:
        framework = frameworks.get(framework_id)
        if framework is None:
            return framework_id
        return framework.label_es if spanish else framework.label_en

    catalog = {r.id: f"{framework_label(r.framework)} {r.reference}" for r in REGULATORY_CATALOG}
    needs_by_id = {need.id: need for need in form.needs}

    def need_ref(need_id) -> str:
        need = needs_by_id.get(need_id)
        return _ref(need.code, need.title or need.finding) if need else ""

    def requirements(ids: list[str]) -> str:
        return ", ".join(md(catalog.get(r, r)) for r in ids) or none

    def join(values: list[str]) -> str:
        return ", ".join(md(v) for v in values if v) or none

    def kv(rows: list[tuple[str, str]]) -> list[str]:
        return [*(f"- **{md(label)}:** {value}" for label, value in rows), ""]

    tlp = TLP_TEXT[form.tlp]
    out: list[str] = [
        f"**{tlp}**",
        "",
        f"# {md(labels['title'])}",
        "",
        f"**{md(ttx.code)}** · {md(ttx.name)}",
        "",
    ]
    if incomplete:
        missing = labels["incomplete_notice"].format(count=incomplete)
        out += [f"> **{md(labels['draft_banner'])}**", ">", f"> {md(missing)}", ""]
    elif form.status != "approved":
        notice = labels["draft_notice"].format(
            version=form.version, status=labels["statuses"][form.status]
        )
        out += [f"> {md(notice)}", ""]

    def section(key: str) -> None:
        # Our own copy ("5. SMART objectives"): never escaped as a list.
        out.extend([f"## {labels['sections'][key]}", ""])

    section("document")
    out += kv(
        [
            (labels["code"], md(ttx.code)),
            (labels["exercise"], md(ttx.name)),
            (labels["version"], str(form.version)),
            (labels["status"], md(labels["statuses"][form.status])),
            (labels["date"], md(_format_date(form.document_date, months))),
            (labels["design_lead"], md(form.design_lead)),
            (labels["tlp"], tlp),
        ]
    )

    section("sponsorship")
    aar = (
        form.aar_recipient_other
        if form.aar_recipient == "other"
        else labels["aar_recipients"].get(form.aar_recipient or "", "")
    )
    sponsor = ", ".join(v for v in (form.sponsor_name, form.sponsor_role) if v.strip())
    out += kv(
        [
            (fields["sponsor"], md(sponsor)),
            (fields["sponsor_motivation"], md(form.sponsor_motivation)),
            (
                fields["findings_commitment"],
                md(labels["yes"] if form.findings_closure_commitment else labels["no"]),
            ),
            (fields["findings_owner"], md(form.findings_owner)),
            (fields["aar_recipient"], md(aar)),
        ]
    )

    section("triggers")
    triggers = [
        form.trigger_other if t == "other" and form.trigger_other else labels["triggers"][t]
        for t in form.triggers
    ]
    regulations = [
        form.regulatory_framework_other or labels["other_regulation"]
        if f == FRAMEWORK_OTHER
        else framework_label(f)
        for f in form.regulatory_frameworks
    ]
    out += kv([(fields["triggers"], join(triggers)), (fields["regulations"], join(regulations))])
    rationale = [
        [
            md(framework_label(f.id)),
            md(f.rationale_es if spanish else f.rationale_en),
            md(f.rationale_reference),
        ]
        for f in FRAMEWORK_CATALOG
        if f.id in form.regulatory_frameworks
    ]
    if rationale:
        out += _table(
            [table[k] for k in ("regulation", "tabletop_rationale", "reference")], rationale, none
        )

    section("needs")
    out += _table(
        [table[k] for k in ("need", "finding", "source", "capability", "priority")],
        [
            [
                _ref(need.code, need.title or need.finding),
                md(need.finding) if need.title else none,
                md(labels["sources"][need.source]),
                md(labels["capabilities"][need.affected_capability]),
                md(labels["priorities"][need.priority]),
            ]
            for need in form.needs
        ],
        none,
    )

    section("capabilities")
    out += [*(f"- {md(labels['capabilities'][c])}" for c in form.capabilities)] or [none]
    out.append("")

    section("objectives")
    if not form.objectives:
        out += [none, ""]
    levels = labels["measure"]["levels"]
    for o in form.objectives:
        out += [f"### {_ref(o.code, objective_name(o))}", ""]
        if o.title.strip() and o.statement.strip():
            out += [md(o.statement), ""]
        out += kv(
            [
                (table["capability"], md(labels["capabilities"][o.capability])),
                (table["needs"], ", ".join(need_ref(n) for n in o.linked_need_ids) or none),
                (table["requirements"], requirements(o.regulatory_requirement_ids)),
            ]
        )
        out += [f"**{md(table['criterion'])}**", ""]
        conditions = condition_lines(o.success_criterion)
        out += [f"{n}. {md(line)}" for n, line in enumerate(conditions, 1)] or [none]
        out.append("")
        notes = [md(line) for line in measure_lines(o, labels["measure"])]
        for key, value in (
            ("achieved", o.achieved_note),
            ("partial", o.partially_achieved),
            ("not", o.not_achieved),
        ):
            if value.strip():
                notes.append(f"**{md(levels[key])}:** {md(value)}")
        if notes:
            out += [*(f"- {n}" for n in notes), ""]
        evidence = evidence_items(o.evidence)
        if evidence:
            out += [f"**{md(table['evidence'])}**", "", *(f"- {md(e)}" for e in evidence), ""]

    section("scope")
    out += kv(
        [
            (fields["levels"], join([labels["levels"][lv] for lv in form.levels])),
            (fields["participating_areas"], join(form.participating_areas)),
            (fields["third_parties"], join(form.third_parties)),
            (fields["perimeter"], md(form.perimeter)),
            (fields["out_of_scope"], md(form.out_of_scope)),
        ]
    )

    section("constraints")
    window = (
        f"{_format_date(form.date_window_start, months)} – "
        f"{_format_date(form.date_window_end, months)}"
        if form.date_window_start or form.date_window_end
        else none
    )
    out += kv(
        [
            (fields["date_window"], md(window)),
            (
                fields["max_duration"],
                md(fields["hours"].format(hours=form.max_duration_hours))
                if form.max_duration_hours
                else none,
            ),
            (fields["availability"], md(form.key_participants_availability)),
            (fields["confidentiality"], md(form.confidentiality_restrictions)),
            (fields["budget"], md(form.budget_and_external_support)),
            (fields["operational_impact"], md(fields["operational_impact_value"])),
        ]
    )

    section("risks")
    out += kv([(fields["stop_keyword"], md(form.stop_exercise_keyword))])
    out += _table(
        [table[k] for k in ("risk", "mitigation", "owner")],
        [[md(r.risk), md(r.mitigation), md(r.owner)] for r in form.risks],
        none,
    )

    section("traceability")
    linked = {n for o in form.objectives for n in o.linked_need_ids}
    rows = [
        [
            need_ref(need_id) or none,
            md(labels["capabilities"][o.capability]),
            _ref(o.code, objective_name(o)),
            "\n".join(
                f"{n}. {md(line)}" for n, line in enumerate(condition_lines(o.success_criterion), 1)
            )
            or none,
            requirements(o.regulatory_requirement_ids),
        ]
        for o in form.objectives
        for need_id in o.linked_need_ids
    ] + [
        [need_ref(need.id), f"**{md(table['orphan'])}**", none, none, none]
        for need in form.needs
        if need.priority == "high" and need.id not in linked
    ]
    out += _table(
        [table[k] for k in ("need", "capability", "objective", "criterion", "requirements")],
        rows,
        none,
    )

    section("approval")
    sig = labels["signature"]
    current = {a.approver_kind: a for a in form.approvals if a.version == form.version}
    for kind in ("sponsor", "design_lead", "compliance"):
        approval = current.get(kind)
        title = labels["approvers"][kind] + (f" {sig['optional']}" if kind == "compliance" else "")
        if approval:
            who = ", ".join(
                md(v) for v in (approval.approver_name, approval.approver_role) if v.strip()
            )
            recorded = sig["recorded"].format(
                date=_format_date(approval.recorded_at, months), name=approval.recorded_by_name
            )
            out.append(f"- **{md(title)}:** {who} — {md(recorded)}")
        else:
            out.append(f"- **{md(title)}:** {md(labels['pending'])}")
    out += [
        "",
        f"*{md(labels['generated'].format(date=_format_date(datetime.now(UTC), months)))}*",
        "",
        f"**{tlp}**",
        "",
    ]
    draft = "_DRAFT" if incomplete else ""
    name = f"{ttx.code}_v{form.version}{draft}_{tlp_file_part(form.tlp)}.md"
    return "\n".join(out), name
