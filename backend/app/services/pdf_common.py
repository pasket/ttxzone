"""Shared building blocks for TTX-Zone's PDF exports (the needs analysis,
the MSEL documents): fonts, the FIRST TLP label, styles, tables, the
TTX-Zone wordmark and the page decoration (logo + header + TLP top and
bottom + "Page n of N", optionally an EXERCISE band).

All user-typed text must go through `text()` (html.escape) before it
reaches a Paragraph: reportlab parses markup, so an unescaped value like
`<img src="/etc/...">` would be interpreted, not printed."""

import io
import re
from datetime import date, datetime
from html import escape
from pathlib import Path

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    SimpleDocTemplate,
    Table,
    TableStyle,
)

# Bitstream Vera ships with reportlab: covers Latin-1 (accents, ñ, «»,
# curly quotes) without bundling or downloading a font.
_FONT_DIR = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("Vera", str(_FONT_DIR / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("Vera-Bold", str(_FONT_DIR / "VeraBd.ttf")))
pdfmetrics.registerFont(TTFont("Vera-Italic", str(_FONT_DIR / "VeraIt.ttf")))
pdfmetrics.registerFont(TTFont("Vera-BoldItalic", str(_FONT_DIR / "VeraBI.ttf")))
# So <b> and <i> in Paragraph markup pick the right face.
registerFontFamily(
    "Vera", normal="Vera", bold="Vera-Bold", italic="Vera-Italic", boldItalic="Vera-BoldItalic"
)

# FIRST TLP 2.0 colours: coloured text on black.
TLP_COLORS = {
    "clear": colors.HexColor("#FFFFFF"),
    "green": colors.HexColor("#33FF00"),
    "amber": colors.HexColor("#FFC000"),
    "amber_strict": colors.HexColor("#FFC000"),
    "red": colors.HexColor("#FF2B2B"),
}
TLP_TEXT = {
    "clear": "TLP:CLEAR",
    "green": "TLP:GREEN",
    "amber": "TLP:AMBER",
    "amber_strict": "TLP:AMBER+STRICT",
    "red": "TLP:RED",
}

INK = colors.HexColor("#10131A")
MUTED = colors.HexColor("#5B6270")
LINE = colors.HexColor("#D5D9E0")
BAND = colors.HexColor("#F2F4F7")
DANGER = colors.HexColor("#B42318")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 18 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
# A landscape page (build_pdf's `landscape_pages`): the same margins.
LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT = landscape(A4)
LANDSCAPE_CONTENT_WIDTH = LANDSCAPE_WIDTH - 2 * MARGIN


def _vertical_margins(banner: str | None) -> tuple[float, float]:
    """Top and bottom margins: room for the header and footer, and for the
    banner under and above them when there is one."""
    return (26 if banner else 22) * mm, (24 if banner else 20) * mm


def landscape_content_height(banner: str | None) -> float:
    top, bottom = _vertical_margins(banner)
    return LANDSCAPE_HEIGHT - top - bottom


_BASE = ParagraphStyle("base", fontName="Vera", fontSize=9, leading=12.5, textColor=INK)
STYLES = {
    "body": _BASE,
    "small": ParagraphStyle("small", parent=_BASE, fontSize=7.5, leading=10, textColor=MUTED),
    "cell": ParagraphStyle("cell", parent=_BASE, fontSize=8, leading=10.5),
    "head": ParagraphStyle("head", parent=_BASE, fontName="Vera-Bold", fontSize=8, leading=10.5),
    "label": ParagraphStyle("label", parent=_BASE, fontSize=8, leading=10.5, textColor=MUTED),
    "title": ParagraphStyle("title", parent=_BASE, fontName="Vera-Bold", fontSize=18, leading=22),
    "subtitle": ParagraphStyle("subtitle", parent=_BASE, fontSize=11, leading=15, textColor=MUTED),
    "h2": ParagraphStyle(
        "h2", parent=_BASE, fontName="Vera-Bold", fontSize=11.5, leading=15, spaceBefore=10
    ),
    "notice": ParagraphStyle("notice", parent=_BASE, textColor=DANGER),
    "right": ParagraphStyle("right", parent=_BASE, alignment=TA_RIGHT),
    "center": ParagraphStyle("center", parent=_BASE, alignment=TA_CENTER),
}


def text(value: str | None, none: str = "—") -> str:
    """Escape user text for Paragraph markup, keeping line breaks."""
    if value is None or not str(value).strip():
        return none
    return escape(str(value).strip()).replace("\n", "<br/>")


_BULLET = re.compile(r"^\s*[-*]\s+(.*)$")
_NUMBER = re.compile(r"^\s*\d+[.)]\s+(.*)$")
_INLINE = re.compile(r"\*\*(.+?)\*\*|(?<![\w*])_(.+?)_(?!\w)|(?<![\w*])\*(?!\s)(.+?)\*(?![\w*])")


def _inline(line: str) -> str:
    """**bold** and _italic_ (or *italic*) as <b>/<i>, the rest escaped."""
    parts, last = [], 0
    for match in _INLINE.finditer(line):
        parts.append(escape(line[last : match.start()]))
        if match.group(1) is not None:
            parts.append(f"<b>{escape(match.group(1))}</b>")
        else:
            parts.append(f"<i>{escape(match.group(2) or match.group(3))}</i>")
        last = match.end()
    parts.append(escape(line[last:]))
    return "".join(parts)


def formatted(value: str | None, none: str = "—") -> str:
    """Formatted text (the frontend's `FormattedText` Markdown subset:
    **bold**, _italic_, "- " bullets, "1. " numbered lists, blank-line
    paragraphs) as Paragraph markup. Escaped piece by piece, so nothing
    typed becomes markup; anything else shows as typed."""
    if value is None or not str(value).strip():
        return none
    blocks: list[list[str]] = [[]]
    counter = 0
    for raw in str(value).strip().replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        bullet = _BULLET.match(raw)
        number = None if bullet else _NUMBER.match(raw)
        if not raw.strip():
            # A blank line ends the paragraph or list.
            if blocks[-1]:
                blocks.append([])
            counter = 0
        elif bullet:
            blocks[-1].append(f"• {_inline(bullet.group(1))}")
            counter = 0
        elif number:
            counter += 1
            blocks[-1].append(f"{counter}. {_inline(number.group(1))}")
        else:
            blocks[-1].append(_inline(raw))
            counter = 0
    return "<br/><br/>".join("<br/>".join(block) for block in blocks if block)


def numbered(items: list[str], none: str = "—") -> str:
    """Escaped items as "1. …" lines."""
    return "<br/>".join(f"{i}. {escape(item)}" for i, item in enumerate(items, 1)) or none


def bullets(items: list[str], mark: str = "•", none: str = "—") -> str:
    """Escaped items, one per line, each after `mark` ("•", "[ ]")."""
    return "<br/>".join(f"{mark} {escape(item)}" for item in items) or none


def para(value: str, style: str = "cell") -> Paragraph:
    return Paragraph(value, STYLES[style])


def format_date(value: date | datetime | None, months: list[str], none: str = "—") -> str:
    if value is None:
        return none
    return f"{value.day} {months[value.month - 1]} {value.year}"


def kv_table(rows: list[tuple[str, str]]) -> Table:
    """Label/value rows; values are already-escaped markup."""
    table = Table(
        [[para(escape(label), "label"), para(value)] for label, value in rows],
        colWidths=[55 * mm, CONTENT_WIDTH - 55 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def grid(header: list[str], rows: list[list[str]], widths: list[float]) -> Table:
    """A bordered data table; header labels and cells are escaped markup."""
    table = Table(
        [[para(h, "head") for h in header]] + [[para(cell) for cell in row] for row in rows],
        colWidths=[w * CONTENT_WIDTH for w in widths],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), BAND),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def join(values: list[str], none: str = "—") -> str:
    return escape(", ".join(values)) if values else none


# Coded rows (a need, objective, phase, inject, threat actor, action or
# ATT&CK technique) are named the app's way: code first, then title; never
# a code alone, never several run together with commas (one per line).
_MUTED_HEX = "#5B6270"


def _cut(title: str, cut: int | None) -> str:
    title = title.strip()
    return f"{title[:cut].rstrip()}…" if cut and len(title) > cut else title


def code_ref(code: str, title: str, cut: int | None = None) -> str:
    """'OBJ-01 | Contain the…' as Paragraph markup: the code bold, a muted
    bar, the title (escaped; cut to `cut` characters when given)."""
    title = _cut(title, cut)
    ref = f'<font name="Vera-Bold">{escape(code)}</font>' if code else ""
    if not title:
        return ref or "—"
    return f'{ref} <font color="{_MUTED_HEX}">|</font> {escape(title)}' if ref else escape(title)


def code_ref_cell(code: str, title: str) -> str:
    """A table cell's reference: the code bold, the title under it, muted
    and smaller."""
    ref = f'<font name="Vera-Bold">{escape(code)}</font>' if code else ""
    title = title.strip()
    if not title:
        return ref or "—"
    return f'{ref}<br/><font size="7.5" color="{_MUTED_HEX}">{escape(title)}</font>'


def ref_lines(refs: list[str], none: str = "—") -> str:
    """Several references (already markup), one per line."""
    return "<br/>".join(r for r in refs if r) or none


# The TTX-Zone wordmark, drawn natively from the geometry of
# frontend/src/assets/logos/logo-modo-light.svg (the variant for light
# backgrounds): "TTX" bold + "-" in brand blue + "Zone" regular, all
# Helvetica -- a PDF standard font, exactly what the SVG asks for -- and
# the two-layer glyph. Vector, so it prints sharp, and no image to ship.
# Coordinates are SVG units; the drawing is cropped to the artwork's own
# box (x 40..596, y 80..152).
_LOGO_LEFT, _LOGO_BASELINE, _LOGO_TOP, _LOGO_RIGHT = 40, 152, 80, 596
_LOGO_TEXT = (
    ("TTX", "Helvetica-Bold", "#0B0E14"),
    ("-", "Helvetica-Bold", "#1A9AD6"),
    ("Zone", "Helvetica", "#3A4456"),
)
_LOGO_GLYPH = (
    ("#0A5E8A", (566, 117.43, 595.43, 134.43, 566, 151.42, 536.57, 134.43)),
    ("#1A9AD6", (566, 80.58, 593, 96.17, 566, 111.76, 539, 96.17)),
)


def draw_logo(canvas: pdf_canvas.Canvas, x: float, bottom: float, height: float) -> float:
    """Draw the wordmark with its baseline at `bottom` and its artwork
    `height` points tall; returns the drawn width."""
    scale = height / (_LOGO_BASELINE - _LOGO_TOP)

    def point(svg_x: float, svg_y: float) -> tuple[float, float]:
        return x + (svg_x - _LOGO_LEFT) * scale, bottom + (_LOGO_BASELINE - svg_y) * scale

    font_size = 100 * scale
    char_space = -1 * scale  # the SVG's letter-spacing="-1"
    cursor = x
    for text, font, color in _LOGO_TEXT:
        label = canvas.beginText(cursor, bottom)
        label.setFont(font, font_size)
        label.setCharSpace(char_space)
        label.setFillColor(colors.HexColor(color))
        label.textOut(text)
        canvas.drawText(label)
        cursor += canvas.stringWidth(text, font, font_size) + char_space * len(text)

    for color, coords in _LOGO_GLYPH:
        path = canvas.beginPath()
        corners = [point(coords[i], coords[i + 1]) for i in range(0, len(coords), 2)]
        path.moveTo(*corners[0])
        for corner in corners[1:]:
            path.lineTo(*corner)
        path.close()
        canvas.setFillColor(colors.HexColor(color))
        canvas.drawPath(path, stroke=0, fill=1)
    return (_LOGO_RIGHT - _LOGO_LEFT) * scale


class NumberedCanvas(pdf_canvas.Canvas):
    """Defers page output so each page can say "Page n of N" and carry the
    TLP label top and bottom. `banner` (e.g. "EXERCISE – EXERCISE –
    EXERCISE") is printed centred under the header and above the footer,
    so no page of an exercise document can be mistaken for a real one."""

    def __init__(
        self, *args, header: str, tlp: str, labels: dict, banner: str | None = None, **kwargs
    ):
        super().__init__(*args, **kwargs)
        self._saved_pages: list[dict] = []
        self._header = header
        self._tlp = tlp
        self._labels = labels
        self._banner = banner

    def showPage(self) -> None:  # noqa: N802 (reportlab API)
        self._saved_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total = len(self._saved_pages)
        for state in self._saved_pages:
            self.__dict__.update(state)
            self._decorate(total)
            super().showPage()
        super().save()

    def _tlp_badge(self, x_right: float, y: float) -> None:
        text = TLP_TEXT[self._tlp]
        self.setFont("Vera-Bold", 8)
        width = self.stringWidth(text, "Vera-Bold", 8) + 8
        self.setFillColor(colors.black)
        self.rect(x_right - width, y - 3, width, 12, stroke=0, fill=1)
        self.setFillColor(TLP_COLORS[self._tlp])
        self.drawRightString(x_right - 4, y, text)

    def _decorate(self, total: int) -> None:
        # The page's own size: a document may mix portrait and landscape.
        page_width, page_height = self._pagesize
        top = page_height - 12 * mm
        bottom = 10 * mm
        logo_width = draw_logo(self, MARGIN, top - 1, 5.2 * mm)
        self.setFillColor(MUTED)
        self.setFont("Vera", 7.5)
        self.drawString(MARGIN + logo_width + 5 * mm, top, self._header)
        self._tlp_badge(page_width - MARGIN, top)
        self.setStrokeColor(LINE)
        self.setLineWidth(0.4)
        self.line(MARGIN, top - 4 * mm, page_width - MARGIN, top - 4 * mm)
        self.setFillColor(MUTED)
        self.setFont("Vera", 7.5)
        self.drawString(
            MARGIN,
            bottom,
            self._labels["page"].format(page=self._pageNumber, pages=total),
        )
        self._tlp_badge(page_width - MARGIN, bottom)
        if self._banner:
            self.setFillColor(DANGER)
            self.setFont("Vera-Bold", 8)
            self.drawCentredString(page_width / 2, top - 8.5 * mm, self._banner)
            self.drawCentredString(page_width / 2, bottom + 5 * mm, self._banner)


def build_pdf(
    story: list,
    *,
    header: str,
    title: str,
    tlp: str,
    labels: dict,
    banner: str | None = None,
    landscape_pages: bool = False,
) -> bytes:
    """Lay `story` out on decorated A4 pages; `labels` needs "page".
    `landscape_pages`: the story may switch to landscape pages with
    `NextPageTemplate("landscape")` + `PageBreak()` (and back with
    "portrait") -- e.g. for a wide drawing."""
    buffer = io.BytesIO()
    top, bottom = _vertical_margins(banner)
    if landscape_pages:
        document = BaseDocTemplate(buffer, pagesize=A4, title=title, author="TTX-Zone")
        document.addPageTemplates(
            [
                PageTemplate(
                    id=name,
                    pagesize=size,
                    frames=[
                        Frame(
                            MARGIN,
                            bottom,
                            size[0] - 2 * MARGIN,
                            size[1] - top - bottom,
                            leftPadding=0,
                            rightPadding=0,
                            topPadding=0,
                            bottomPadding=0,
                        )
                    ],
                )
                for name, size in (("portrait", A4), ("landscape", landscape(A4)))
            ]
        )
    else:
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=top,
            bottomMargin=bottom,
            title=title,
            author="TTX-Zone",
        )
    document.build(
        story,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(
            *args, header=header, tlp=tlp, labels=labels, banner=banner, **kwargs
        ),
    )
    return buffer.getvalue()


def tlp_file_part(tlp: str) -> str:
    """The TLP as it goes in a file name: AMBER, AMBER-STRICT..."""
    return TLP_TEXT[tlp].removeprefix("TLP:").replace("+", "-")
