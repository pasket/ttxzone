"""The storyline map in a PDF: the MSEL laid out as the app draws it
(frontend `lib/storylineMap.ts` + `StorylineGraph.tsx`) -- mandatory
injects along the session, each contingent inject on a lane below from
the point it hangs from to where the storyline resumes, inside the phase
boxes -- drawn with reportlab primitives in the app's light-theme colours.

`storyline_layout` mirrors `storylineMap()`: change both together."""

from dataclasses import dataclass, field
from datetime import time

from reportlab.lib import colors
from reportlab.platypus import Flowable

from app.models import InjectKind
from app.schemas.ttx_msel import InjectRead, MselRead

# The app's light theme (frontend/src/index.css).
ACCENT = colors.HexColor("#17B4C4")  # --color-accent: the storyline, its stops
BRANCH = colors.HexColor("#6A5BD6")  # --color-chart-2: contingent branches
PHASE_FILL = colors.HexColor("#F2FBFC")
PHASE_LINE = colors.HexColor("#C9E9EE")
INK = colors.HexColor("#10131A")
MUTED = colors.HexColor("#5B6270")
HAIRLINE = colors.HexColor("#E2E5EA")

# Minutes after the fork a branch sits at when nothing says better
# (storylineMap.ts's DEFAULT_BRANCH_DELAY).
DEFAULT_BRANCH_DELAY = 10


@dataclass
class Stop:
    inject: InjectRead
    time: int


@dataclass
class Branch:
    inject: InjectRead
    from_time: float
    from_lane: int
    time: float
    lane: int
    rejoin: Stop | None


@dataclass
class Storyline:
    duration: int
    stops: list[Stop] = field(default_factory=list)
    branches: list[Branch] = field(default_factory=list)
    loose: list[InjectRead] = field(default_factory=list)
    lanes: int = 0


def storyline_layout(msel: MselRead) -> Storyline:
    """Where each inject sits on the map (a mirror of `storylineMap()`)."""
    duration = msel.duration_minutes or 0

    def clamp(minutes: float) -> float:
        return min(duration, max(0, minutes))

    by_id = {i.id: i for i in msel.injects}
    phases = {p.id: p for p in msel.phases}
    stops = sorted(
        (
            Stop(i, clamp(i.offset_minutes))
            for i in msel.injects
            if i.kind == InjectKind.MANDATORY and i.offset_minutes is not None
        ),
        key=lambda s: s.time,
    )
    stop_of = {s.inject.id: s for s in stops}

    placed: dict = {}

    def place(inject: InjectRead, seen: frozenset) -> float | None:
        if inject.id in placed:
            return placed[inject.id]
        if inject.id in seen:
            return None
        parent = by_id.get(inject.branch_from_id) if inject.branch_from_id else None
        fork: float | None = None
        if parent is not None and parent.kind == InjectKind.MANDATORY:
            stop = stop_of.get(parent.id)
            fork = stop.time if stop else None
        elif parent is not None:
            fork = place(parent, seen | {inject.id})
        if fork is None:
            placed[inject.id] = None
            return None
        action = next(
            (
                a
                for a in (parent.expected_actions if parent else [])
                if a.id == inject.branch_action_id
            ),
            None,
        )
        rejoin = stop_of.get(inject.rejoin_inject_id) if inject.rejoin_inject_id else None
        phase = phases.get(inject.phase_id)
        if phase is not None and inject.fires_at_minute is not None:
            at = phase.start_offset + inject.fires_at_minute
        elif action is not None and action.expected_within_minutes is not None:
            at = fork + action.expected_within_minutes
        elif rejoin is not None and rejoin.time > fork:
            at = (fork + rejoin.time) / 2
        else:
            at = fork + DEFAULT_BRANCH_DELAY
        placed[inject.id] = clamp(at)
        return placed[inject.id]

    contingent = [i for i in msel.injects if i.kind == InjectKind.CONTINGENT]
    anchored = [(i, place(i, frozenset())) for i in contingent]
    anchored = [(i, at) for i, at in anchored if at is not None]
    loose = [i for i in contingent if placed.get(i.id) is None]

    def depth(inject: InjectRead) -> int:
        parent = by_id.get(inject.branch_from_id) if inject.branch_from_id else None
        return 1 + depth(parent) if parent and parent.kind == InjectKind.CONTINGENT else 0

    anchored.sort(key=lambda row: (depth(row[0]), row[1]))
    lane_ends: list[float] = []  # per lane (index 0 = lane 1), when it's free again
    lane_of: dict = {}
    branches: list[Branch] = []
    for inject, at in anchored:
        source = by_id[inject.branch_from_id]
        from_lane = 0 if source.kind == InjectKind.MANDATORY else lane_of.get(source.id, 0)
        from_time = (
            stop_of[source.id].time
            if source.kind == InjectKind.MANDATORY and source.id in stop_of
            else placed.get(source.id) or at
        )
        rejoin_stop = stop_of.get(inject.rejoin_inject_id) if inject.rejoin_inject_id else None
        # A way back that isn't later than the branch is drawn as no way back.
        rejoin = rejoin_stop if rejoin_stop and rejoin_stop.time >= at else None
        busy_until = rejoin.time if rejoin else at
        lane = next((n for n, end in enumerate(lane_ends) if end < from_time), len(lane_ends))
        if lane == len(lane_ends):
            lane_ends.append(busy_until)
        else:
            lane_ends[lane] = busy_until
        lane_of[inject.id] = lane + 1
        branches.append(Branch(inject, from_time, from_lane, at, lane + 1, rejoin))
    return Storyline(duration, stops, branches, loose, len(lane_ends))


# -- time labels (the map's: session T+ and elapsed scenario time) ----------


def _offset(minutes: float) -> str:
    minutes = int(round(minutes))
    return f"T+{minutes // 60:02d}:{minutes % 60:02d}"


def _span(minutes: int) -> str:
    days, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    parts = [
        f"{days} d" if days else "",
        f"{hours} h" if hours else "",
        f"{mins} min" if mins else "",
    ]
    return " ".join(p for p in parts if p) or "0 min"


def _incident(msel: MselRead, minutes: float) -> int:
    """Elapsed scenario time at a session minute (`incidentMinutesAt`)."""
    jumps = sum(p.incident_jump_minutes for p in msel.phases if 0 < p.start_offset <= minutes)
    return int(round(minutes * msel.time_compression)) + jumps


def _scenario_label(msel: MselRead, minutes: float) -> str:
    elapsed = _incident(msel, minutes)
    rounded = round(elapsed / 60) * 60 if elapsed >= 1440 else elapsed
    span = f"+{_span(rounded)}" if elapsed > 0 else "+0"
    start: time | None = msel.incident_start
    if start is None:
        return span
    total = (start.hour * 60 + start.minute + elapsed) % 1440
    hour, minute = divmod(total, 60)
    return f"{span} · {hour % 12 or 12}:{minute:02d} {'am' if hour < 12 else 'pm'}"


def _tick_step(duration: int, min_step: float = 0) -> int:
    """Minutes between axis ticks: at most ~10 of them, and no closer than
    `min_step` (what their labels need)."""
    for step in (5, 10, 15, 20, 30, 60, 90, 120, 180, 240, 360, 720):
        if duration / step <= 10 and step >= min_step:
            return step
    return 1440


def _cut(text: str, chars: int) -> str:
    text = text.strip()
    return text if len(text) <= chars else text[: chars - 1].rstrip() + "…"


def _fit(canvas, text: str, font: str, size: float, width: float) -> str:
    """`text`, cut with "…" to fit `width` points in that font."""
    if canvas.stringWidth(text, font, size) <= width:
        return text
    while text and canvas.stringWidth(text + "…", font, size) > width:
        text = text[:-1]
    return text.rstrip() + "…" if text else ""


class StorylineFlowable(Flowable):
    """The storyline map, `width` × `height` points: phase boxes, the
    storyline in the accent colour with its stops (code and the start of
    the title, tilted up), branches in purple on lanes below (dashed when
    they don't come back), each label above its lane's line, the T+ and
    scenario-time axis, and a legend."""

    TOP = 120  # room above the storyline: phase names, then the stops' labels
    AXIS = 34
    LEGEND = 22
    # Stop labels sit in rows above the storyline: each takes the lowest row
    # where it doesn't overlap the label before it, a leader line down to
    # its stop -- so close stops stay legible.
    ROW_STEP = 11

    def __init__(self, msel: MselRead, width: float, height: float, labels: dict):
        super().__init__()
        self.msel = msel
        self.map = storyline_layout(msel)
        self.width = width
        self.height = height
        self.labels = labels

    def wrap(self, available_width, available_height):
        return self.width, self.height

    def _x(self, minutes: float) -> float:
        duration = self.map.duration or 1
        return self.pad + (self.width - self.pad - self.right) * minutes / duration

    def draw(self) -> None:  # noqa: PLR0915 (one drawing, top to bottom)
        canvas = self.canv
        self.pad, self.right = 4.0, 60.0  # the last stops' tilted labels run right
        drawing_bottom = self.AXIS + self.LEGEND
        line_y = self.height - self.TOP
        lanes = self.map.lanes
        # The lanes share the page's height (not past a comfortable size).
        lane_h = min(80.0, (line_y - drawing_bottom - 24) / (lanes + 0.5)) if lanes else 0

        def lane_y(lane: int) -> float:
            return line_y - lane * lane_h

        # The phase boxes reach down to the axis.
        box_bottom = drawing_bottom + 4

        # Phase boxes, with name and session band.
        for phase in sorted(self.msel.phases, key=lambda p: p.start_offset):
            left, right = self._x(phase.start_offset) + 1, self._x(phase.end_offset) - 1
            canvas.setFillColor(PHASE_FILL)
            canvas.setStrokeColor(PHASE_LINE)
            canvas.setLineWidth(0.5)
            canvas.roundRect(left, box_bottom, right - left, self.height - box_bottom, 3, 1, 1)
            canvas.setFillColor(INK)
            canvas.setFont("Vera-Bold", 7.5)
            room = right - left - 6
            canvas.drawString(
                left + 3,
                self.height - 10,
                _fit(canvas, f"{phase.code} | {phase.name}", "Vera-Bold", 7.5, room),
            )
            canvas.setFillColor(MUTED)
            canvas.setFont("Vera", 6.5)
            band = f"{_offset(phase.start_offset)}–{_offset(phase.end_offset)}"
            canvas.drawString(left + 3, self.height - 19, _fit(canvas, band, "Vera", 6.5, room))

        # The storyline, broken with "⋯" where a phase opens with a time jump.
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(2)
        canvas.line(self._x(0), line_y, self._x(self.map.duration), line_y)
        for phase in self.msel.phases:
            if phase.start_offset > 0 and phase.incident_jump_minutes > 0:
                x = self._x(phase.start_offset)
                canvas.setFillColor(colors.white)
                canvas.rect(x - 6, line_y - 3, 12, 6, stroke=0, fill=1)
                canvas.setFillColor(ACCENT)
                canvas.setFont("Vera-Bold", 8)
                canvas.drawCentredString(x, line_y - 2.5, "···")
                canvas.setFillColor(MUTED)
                canvas.setFont("Vera", 6.5)
                canvas.drawString(
                    x + 4,
                    self.height - 28,
                    self.labels["jump"].format(span=_span(phase.incident_jump_minutes)),
                )

        # Branches: from the fork down to the lane, along it, back up.
        for branch in self.map.branches:
            y = lane_y(branch.lane)
            path = canvas.beginPath()
            path.moveTo(self._x(branch.from_time), lane_y(branch.from_lane))
            path.lineTo(self._x(branch.from_time), y)
            path.lineTo(self._x(branch.time), y)
            if branch.rejoin is not None:
                path.lineTo(self._x(branch.rejoin.time), y)
                path.lineTo(self._x(branch.rejoin.time), line_y)
            canvas.setStrokeColor(BRANCH)
            canvas.setLineWidth(1.2)
            canvas.setDash([] if branch.rejoin else [3, 2])
            canvas.drawPath(path, stroke=1, fill=0)
            canvas.setDash([])

        # Mandatory stops: a dot, and the code + start of the title in the
        # lowest row above where it doesn't overlap the previous label.
        row_ends: list[float] = []  # per row, where its last label ends
        labels: list[tuple] = []
        rows_room = int((self.TOP - 34) // self.ROW_STEP)
        for stop in self.map.stops:
            x = self._x(stop.time)
            code_width = canvas.stringWidth(stop.inject.code + " ", "Vera-Bold", 7)
            title = _cut(stop.inject.title, 28)
            width = code_width + canvas.stringWidth(title, "Vera", 7)
            row = next((n for n, end in enumerate(row_ends) if x - 2 > end), len(row_ends))
            row = min(row, rows_room - 1)
            if row == len(row_ends):
                row_ends.append(x + width + 6)
            else:
                row_ends[row] = x + width + 6
            label_y = line_y + 8 + row * self.ROW_STEP
            canvas.setStrokeColor(MUTED if row else HAIRLINE)
            canvas.setLineWidth(0.4)
            canvas.line(x, line_y + 3, x, label_y - 1.5)
            canvas.setFillColor(ACCENT)
            canvas.setStrokeColor(colors.white)
            canvas.setLineWidth(1)
            canvas.circle(x, line_y, 3.6, stroke=1, fill=1)
            labels.append((x, label_y, width, stop.inject.code, code_width, title))
        # Labels last, over every leader line: a line never crosses a label.
        for x, label_y, width, code, code_width, title in labels:
            canvas.setFillColor(colors.white)
            canvas.rect(x - 1, label_y - 2, width + 3, 9, stroke=0, fill=1)
            canvas.setFillColor(INK)
            canvas.setFont("Vera-Bold", 7)
            canvas.drawString(x + 1, label_y, code)
            canvas.setFont("Vera", 7)
            canvas.setFillColor(MUTED)
            canvas.drawString(x + 1 + code_width, label_y, title)

        # Contingent marks: a diamond on the lane, the label just above it.
        for branch in self.map.branches:
            x, y = self._x(branch.time), lane_y(branch.lane)
            canvas.saveState()
            canvas.translate(x, y)
            canvas.rotate(45)
            canvas.setFillColor(BRANCH)
            canvas.setStrokeColor(colors.white)
            canvas.setLineWidth(1)
            canvas.rect(-3, -3, 6, 6, stroke=1, fill=1)
            canvas.restoreState()
            title = _cut(branch.inject.title, 40)
            code_width = canvas.stringWidth(branch.inject.code + " ", "Vera-Bold", 7)
            width = code_width + canvas.stringWidth(title, "Vera", 7) + 4
            canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.9))
            canvas.rect(x - 2, y + 4, width, 10, stroke=0, fill=1)
            canvas.setFillColor(INK)
            canvas.setFont("Vera-Bold", 7)
            canvas.drawString(x, y + 6.5, branch.inject.code)
            canvas.setFont("Vera", 7)
            canvas.setFillColor(MUTED)
            canvas.drawString(x + code_width, y + 6.5, title)

        # Axis: session T+ and scenario time.
        axis_y = self.LEGEND + self.AXIS - 4
        canvas.setStrokeColor(HAIRLINE)
        canvas.setLineWidth(0.5)
        canvas.line(self._x(0), axis_y, self._x(self.map.duration), axis_y)
        # Ticks as close as their labels allow.
        widest = max(
            canvas.stringWidth(_scenario_label(self.msel, m), "Vera", 6.5)
            for m in range(0, self.map.duration + 1, 5)
        )
        per_minute = (self._x(self.map.duration) - self._x(0)) / (self.map.duration or 1)
        step = _tick_step(self.map.duration, (widest + 10) / per_minute)
        canvas.setFont("Vera", 6.5)
        for minute in range(0, self.map.duration + 1, step):
            x = self._x(minute)
            canvas.setStrokeColor(HAIRLINE)
            canvas.line(x, axis_y, x, axis_y - 3)
            canvas.setFillColor(INK)
            canvas.drawCentredString(x, axis_y - 11, _offset(minute))
            canvas.setFillColor(MUTED)
            canvas.drawCentredString(x, axis_y - 20, _scenario_label(self.msel, minute))

        # Legend, and the injects the map can't place.
        y = 6
        x = self._x(0)
        canvas.setFillColor(ACCENT)
        canvas.circle(x + 3, y + 2, 3, stroke=0, fill=1)
        canvas.setFillColor(MUTED)
        canvas.setFont("Vera", 7)
        canvas.drawString(x + 9, y, self.labels["mandatory"])
        x += 18 + canvas.stringWidth(self.labels["mandatory"], "Vera", 7)
        canvas.saveState()
        canvas.translate(x + 3, y + 2)
        canvas.rotate(45)
        canvas.setFillColor(BRANCH)
        canvas.rect(-2.5, -2.5, 5, 5, stroke=0, fill=1)
        canvas.restoreState()
        canvas.drawString(x + 9, y, self.labels["contingent"])
        x += 18 + canvas.stringWidth(self.labels["contingent"], "Vera", 7)
        canvas.setStrokeColor(BRANCH)
        canvas.setDash([3, 2])
        canvas.line(x, y + 2, x + 14, y + 2)
        canvas.setDash([])
        canvas.drawString(x + 18, y, self.labels["no_rejoin"])
        if self.map.loose:
            x += 26 + canvas.stringWidth(self.labels["no_rejoin"], "Vera", 7)
            canvas.drawString(
                x, y, self.labels["loose"].format(codes=", ".join(i.code for i in self.map.loose))
            )
