# Playground (conduct phase) — design

Status: **built** (all five slices; see Delivery slices and Open items). This is the agreed design for running a live session; the rest is built in the remaining slices. Read it together with `docs/features/msel.md` (the snapshot it plays) and `docs/features/conduct-prep.md` (the plan and EEGs it rates).

## Concept

- **One common Playground**: what the Players see. Facilitators, Observers, Evaluators and Controllers see the identical view, so an Evaluator rates exactly what the table saw.
- **A docked panel per role** on the right. The role selected in the ContextBar decides which panel shows.

| Role        | Panel                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Player      | Personal notes                                                                                            |
| Facilitator | Inject notes and general notes; key questions of the phase and the inject's facilitator notes (read-only) |
| Observer    | Inject notes and general notes                                                                            |
| Evaluator   | EEG points of the current inject, P/S/M/U picker, notes                                                   |
| Controller  | **Control center**: release injects per the MSEL, key questions, expected actions                         |

- **Modules.** **Playground** (`/playground`) for Players, Facilitators, Observers and Evaluators. Control stays the Controller's module, and its main section **Control center** is the same Playground with the control panel. One module per role still holds; the ContextBar's Role selector is the only switch. The Feed and Decisions placeholders go: the feed _is_ the Playground, and the table's decisions and votes live in it (see Decisions and votes).
- **Inputs.** It plays the frozen READY `MselSnapshot` and rates with the READY `ConductPrepSnapshot`. A run can't start without both (409).

## UX principles

1. **One visible truth** — per room. Only the panel varies by role. In an exercise played in rooms (`docs/features/rooms.md`) each room has its truth: a Player sees their room or the main room, and the team picks the room to look at, seeing what its Players see.
2. **Safety always on screen.** A sticky band reads "EXERCISE · EXERCISE · EXERCISE" and carries the stop keyword (`TTXNeedsForm.stop_exercise_keyword`; «REAL WORLD» when none is set).
   - **REAL WORLD button.** While the session runs (live or paused), the keyword is a button: "If a real incident happens, press «…»". The Playground is digital, so saying the keyword reaches no one.
     - **Who:** any participant may press it, Players included.
     - **Confirmation:** `RealWorldDialog` asks them to type the keyword (case-insensitive, trimmed); the server checks it again (422 `KEYWORD_MISMATCH`).
     - **Effect:** it **pauses** the session (`POST /run/real-world`, `ExerciseRun.real_world_at` / `real_world_by_id`; a `PAUSE` event with `real_world: true`, "Real-world event" in the log). A normal pause already running keeps its start; a second press changes nothing.
     - **Every screen** shows it: the band turns red ("Paused · Real-world event") and a notice under the presence strip, in the same sticky band, shows who paused it and when.
     - **Resuming:** only a Controller resumes, which clears the flag, or ends the run (End's emergency stop if needed).
     - **No step-up:** a re-authentication prompt must never delay it.
   - Before the start and once over, the band shows the keyword as text.
   - This deliberately widens where the keyword appears: it was once only in the Facilitator guide; the SitMan carries it too. Every participant must know how to halt.
   - A STOP covers every screen with a `danger` overlay that shows the reason.
3. **The Controller sets the pace and everyone else reacts.** A new inject lands on top and is announced with `aria-live="polite"` (STOP: `assertive`). It never steals focus from someone typing a note.
4. **Progressive reveal.** Anyone who doesn't control sees nothing ahead: no future phase names, no undelivered injects, no expected actions, no triggers.
5. **Colour = state only:**
   - phase done → `success`
   - current → `accent` (same "active" as the navigation)
   - future → neutral outline
   - stopped → `danger`
   - `severity-*` stays reserved for inject severity.
6. **Recoverable.** Every action is a DB event. A reload or a late joiner sees exactly the same state. Never `localStorage` for run state.
7. **Command-center tone.** Dark by default, IBM Plex Mono for clocks and codes, flat panels per the design system.

## Screen anatomy

```
┌ EXERCISE · EXERCISE · EXERCISE ───────────── Stop keyword: «APPLE» ┐  sticky
│ SUN 3 MAY · 13:25 │ ✓Escalation ✓Data theft ●Attribution Phase 6 … │  phase track
│ Session 11:00 · T+01:10 │ #1 SOC alert   #3 100 GB…   #6 Attrib… ● │  injects per phase
│                         │ #2 Supplier…   #4 Ransom…               │
│ ● LIVE    Present: 6 Players · 1 Controller · 2 Evaluators · 1 Obs. │
├──────────────────────────────────────────────┬─────────────────────┤
│ CURRENT INJECT                               │ ROLE PANEL          │
│ #7 (INJ-07: team only) · Email from the CISO │ resizable, foldable │
│ From: CISO (Email) → To: Legal, Comms        │ (a tab on narrow    │
│ [image] [image] (lightbox)                   │  screens)           │
│ Formatted content…                           │                     │
│ Questions for the table (released)           │                     │
└──────────────────────────────────────────────┴─────────────────────┘
```

**Phase track (`PhaseTrack`)**, following the reference mock-up:

- **Clock block.** The scenario date and time of the current inject (`incidentMinutesAt`, `clockAt` in `lib/msel.ts`). Below it: "Session {planned start} · T+{real elapsed since start, pauses excluded}".
- **One column per phase**: its chip (names wrap to two lines, then clamp; the whole name stays in the tooltip and the DOM), its headline (two lines at most), then its delivered injects:
  - Done: ✓, name, headline.
  - Current: filled `accent`, name, headline.
  - Future: "Phase N", outlined, nameless.
- With many phases the track scrolls horizontally and the current phase is always in view.
- The headline is the phase's own `MselPhase.headline` (≤ 80 chars, set in the MSEL's phase dialog), and nothing when the phase has none. The inject list below already says what happened in it.
- **The story so far**: under each phase, the injects on the stage delivered in it, oldest first, one line each: `#N` and the title (clamped, whole in the tooltip). ENDEX, which has no phase, closes the last phase that has begun. The one in play carries a dot. Each list scrolls on its own (about three rows, kept at its newest) so the sticky band stays short. This is the session's whole history; there is no "Earlier" list under the stage.
- **Picking one** puts it on the stage, headed "Reviewing · {phase}", with its row marked (`aria-current`). A bar above names the inject in play and offers "Back to the inject in play".
- **Stepping**: on the stage card, the `#N` line sits between two small buttons, "←" and "→" (`InjectPager`, a pager: the controls sit on the value they change), to the shown inject's neighbours on the stage, on the inject in play too ("←" starts a review). Stepping onto the one in play ends the review; at either end the button is disabled. Each button names its target in a tooltip and its accessible name. Floating, half-overhanging buttons were rejected: they hide the panel edge and the title, clash with the text-size controls and the timer, and are hard targets on touch. A new inject never pulls a reader away mid-read: it's announced (`aria-live`) and named in that bar. The pick is local to the viewer and dropped on a new run or another room (`PlaygroundPage`'s `picked`, scoped by run number and place).
- **Numbers, not codes**: `#N` is the inject's place in the story as the viewer lives it, in release order (`injectSequence` in `lib/run.ts`; a re-sent inject is the latest again). A Player numbers only what reaches them (their room's injects and the main room's screen), so they never see a gap, and an inject keeps its number wherever it shows. A Player never sees an MSEL code: not on the track, the stage, the announcement or their notes ("On #3"). The team (every other role) sees `#N` plus the code, to cross-reference the MSEL (`StageView.showCodes`).
- The date comes from `TTXMsel.incident_date` ("Scenario date" in the MSEL's Scenario tab), advanced by the scene's days (`lib/run.ts scenarioClock`), shown as "Sun 3 May · 13:25" in the user's language. Fallback: "Day 1 · 13:25".

**Run status** is one of Not started / Live / Paused / Ended / **Stopped**.

**Text size**: two buttons ("A−" / "A+") at the right of the inject in play's header, before the timer, step its text two sizes down or two up from the default (`hooks/useInjectTextSize`, `localStorage` `ttx_inject_text_step`, the step from the default, per device); a reviewed inject follows.

**On a projector**: a button at the right of the stage's head (four arrows; wide screens, where the dock shows) puts the Playground on the room's screen (`PlaygroundPage`'s `Projector`, `hooks/usePresentation`). It uses the browser's full screen (`requestFullscreen` on the page's root; Escape is the browser's); without one, or if it's refused, the root is raised over the page (`hooks/useMaximize`: no page scroll, focus in and Tab kept there, Escape restores). Either way focus returns to the button. The layout: the exercise band edge to edge at the top (REAL WORLD still works; its dialog portals into the full-screen element), with the way out at its end; the session's notices second; the stage, with who is present in a column at its right (the Players by name, the team only counted, as a Player sees it); and the storyline (the phase track) along the bottom, sticky when the stage runs longer than the screen. The presence column and the storyline are open by default and fold (`FoldIcon`, right and bottom), each remembered on the device (`hooks/useProjectorFold`, `ttx_projector_presence` / `ttx_projector_storyline`). Presented, the inject text is two steps above the reader's A−/A+ choice (`StageView.presenting`) and no MSEL code shows, whoever presents. The page under it (the dock, the Controller's storyline map) stays mounted but hidden, so nothing being typed is lost and nothing reloads.

**Delivery header** (`DeliveryHeader`): above each inject's body, **Source** (the sender's monogram, name and actor type; left out without a sender) and **Channel** (the delivery method with its icon) on one line, and **Audience** on a full-width row of its own below, headed with the count (one chip per in-scenario recipient, flowing across the width; past seven it folds to six and a "+N more" / "Show less" toggle, folded again for each new inject; left out when empty). Monochrome: nothing in it is a state.

**Notices** (`SessionNotices`): every session-wide notice -- stopped (with the reason), paused (for a real-world event or not), ended (points to the hot wash), connection lost -- sits in the sticky band under the presence strip, an icon ahead and a thick left strip: danger red for what stops the table, accent otherwise. The stage keeps only content (the scenario before the start, the hot-wash questions once ended).

**Presence:**

- Counts per role; clicking them lists names with `RoleBadge`.
- Players see the Players' names and only counts for the team.

**Current inject card.** It carries:

- `#N` (plus the code for the team) and title.
- **Time since the last inject** (`InjectTimer`), quiet at the right of the code line, on the latest released inject only: mm:ss counting from the latest release, pauses left out like T+ (`ExerciseRun.inject_timer_at` + `inject_timer_paused_seconds`, the pause seconds already counted then; `injectElapsedSeconds` in `lib/run.ts`), frozen while paused or over. A Controller resets it from the sequence window's In play band (`POST …/run/inject-timer/reset`, an `INJECT_TIMER_RESET` event in the log), on every screen; each release or re-send restarts it too. One timer per run, rooms included.
- Phase and scenario time.
- Simulated sender, channel and recipients.
- Formatted content.
- Images: a gallery with a lightbox, with known dimensions so nothing shifts.
- Files: name (the download, through `useApiDownload`), size, description and SHA-256 with a copy button, so the table can check what it analyses.
- The key questions the Controller released onto it.

**Other states:**

- **Before start**: the MSEL's Player summary, the session's when/where/link, and "Waiting for the Controller to start the exercise".
- **After end**: a close screen pointing to the hot wash, and the feedback form in each participant's panel (see Participant feedback form).

## Role panels

**Player — My notes:**

- A private pad, autosaved.
- Each note is tagged with the current inject; the tag can be removed.
- The list is grouped by inject.

**Facilitator / Observer:**

- "Inject note" and "General notes" tabs.
- The Facilitator also gets, read-only, the phase's key questions and the current inject's `facilitator_notes`.

**Evaluator:**

- By default, their assigned EEG points for the current inject (`ConductPrepEegPoint.source_inject_code` + `ConductPrepEvaluatorObjective`). A toggle shows all their points.
- Each point has a P/S/M/U picker showing the level's definition (`criteria_p..u`, else the common scale) and a rationale.
- Inject and general notes.
- Progress: rated / assigned.

**Controller — Control center** (the panel can widen to 50 %):

1. **Session controls**:
   - StartEx, Pause/Resume (reversible, one click), Next phase. Once started, Pause/Resume and End are icon buttons in the Session panel's header (`ControlIcons`: neutral pause, CTA play while paused, ghost-danger stop), not text buttons in the body: they're pressed once or never.
   - **End exercise** (the one way to end): a confirmation that it can't be undone (`EndDialog`). Ticking **Emergency stop** (a real incident, the stop keyword) asks for a mandatory reason and stops instead (`/run/stop`, broadcast to all); unticked it ends (`/run/end`). There is no separate STOP button.
   - **Restart exercise**, once ended or stopped (`RestartDialog`), back to Not started: **Start a new run** archives the current run (kept with its log, ratings, notes and feedback, listed under **Previous runs** — `PastRuns`, with its log PDF/CSV), or **Delete this run's data** (refused with `RUN_HAS_REPORT`, and disabled in the dialog via `RunRead.can_delete`, when an after-action report was written from it). Typing the control word «restart» (any case; `CONFIRMATION_MISMATCH` otherwise) confirms it -- no step-up. The next Start takes the current READY MSEL and plan.
2. **MSEL queue by phase**:
   - The next mandatory inject with its planned time and a countdown or delay, plus **Release** (or Skip with a reason).
   - **Sequence window** (`InjectSequence`, from `lib/run.ts`'s `controlSequence`), the Session panel's body, three bands with one row grammar (due T+, inject, badges, icon actions at the right in the table-action style, `btnNeutralIconGhost` with label and tooltip): **Previous** (the inject delivered before the one in play, muted; **Release again** — `POST …/injects/{code}/resend`, brief confirmation: an `inject_resent` event moves it to the end of the release order, so it's back in play everywhere, and the time since the last inject restarts), **In play** (the latest delivered, framed, with the time since it went out; **Reset** the timer, `POST …/inject-timer/reset`, no confirmation) and **Next** (what can go out, in T+ order: the open branches — pending contingents hanging from the inject in play, from the frozen MSEL's `branch_from_id`, and every suggested one — **Fire**, with its reason dialog, under them the action whose absence fires it and where the storyline resumes (`rejoin_inject_id`, only when later); and the pending mandatory injects due from the one in play on, filling three rows with at least two: the first **Release**s at once, the rest **Jump & release**, confirmed (`ConfirmActionDialog` listing the injects jumped over, `jumpedOver`); those **stay pending** and drop out of the window, releasable later from the full queue; injects due the same minute are marked Parallel). A rail at the rows' left (`SequenceRail`) draws it like the storyline map: the storyline in the accent with dots, each branch on its own lane in `chart-2` with a diamond, forking off the inject in play and curving back into the storyline row where it resumes (a short stub when that row isn't shown, dashed with no way back); with a fork, a caption under Next says there are two ways on. Other contingents and **Skip** live only in the full MSEL queue below, which asks before releasing ahead too. Once every mandatory inject is released or skipped, Next offers **Send ENDEX** (`EndexDialog`: title and message worded by default in the exercise's content language — `TTX.content_language`, else the Controller's —, editable, the dialog itself in the Controller's; `POST …/run/endex`): an `endex` event the table reads as the last inject (code `ENDEX`, every room, notes allowed on it), every phase turns done and no phase is current, and nothing else can be released, re-sent, skipped or paused (`pause` and REAL WORLD answer 409 `ENDEX_RELEASED`). The default message is formatted (bold lead, paragraphs, the hot wash's two points as a list) and the dialog edits it with `FormattedTextArea`. On the stage ENDEX is a closing card (`InjectStage`'s `EndexBody`): no delivery header and no timer, a flag and `ENDEX` eyebrow in mono, the title large, the text centred one size above the reader's A−/A+ choice. From then on no inject timer runs (stage or In play band, no Reset), the banner reads "ENDEX · Play is over" with neither REAL WORLD nor the stop keyword, every screen gets an accent notice and the hot-wash questions under the stage, and the Session panel's Pause/Stop icons give way to one **End exercise** button whose dialog has no emergency stop. The session stays live for the hot wash; End is still its own step.
   - The phase's contingents with their trigger and the expected action they hang on. They are released with a reason, and suggested when that action is marked "Not observed".
3. **Original storyline**: read-only `StorylineGraph` with a "now" cursor (a 1px line in `--color-playhead` at the latest delivered inject; once ENDEX is out it reaches the end of the storyline in `--color-success` and the storyline up to there counts as run through -- ENDEX closes it like a last inject -- while undelivered branches stay faded) and per-mark run state: released, skipped, pending (new props).
4. **Key questions of the phase**:
   - Each is pending / released / covered.
   - Tick several and "Release on INJ-07": they appear under the inject in the Playground.
5. **Expected actions of the current inject**: Observed / Partial / Not observed, with time and a short note. Logged, and visible to Evaluators.

## Visibility

- Player notes: author only.
- Observer and Facilitator notes, Evaluator ratings, action tracking and question tracking: the author, the Lead Evaluator, Controllers and Planners of the exercise (for the hot wash and the report). Never Players.
- **Player projection** (`PlayerInjectRead`, same approach as `InjectCard` in `msel_pdf_service.py`): delivered injects only.
  - It never carries expected actions, `facilitator_notes`, triggers, ATT&CK or unreleased contingents.
  - Content tests mirror the SitMan ones.

## Backend

**Models** (one migration):

- `ExerciseRun`: one **current** run per TTX (`archived_at` null; partial unique index `uq_exercise_run_current`), plus the archived ones a restart left, numbered 1, 2… (`number`, `RunRead.run_number`). `find_run` is the current one; `run_of` any of the exercise's; `delete_runs_for_ttx` takes them all. The Playground remounts its panels when `run_number` changes.
  - Fields: `number`, `archived_at`, `status` (NOT_STARTED / LIVE / PAUSED / ENDED / STOPPED), `msel_snapshot_id`, `plan_snapshot_id`, `started_at`, `ended_at`, `paused_seconds`, `current_phase_code`, `stop_reason`.
- `RunEvent`: the append-only execution log.
  - Fields: monotonic `seq`, `type`, JSON `payload` with stable inject / action / question codes, `actor_id`, `at`.
  - Types: start, pause, resume, phase_open, inject_released, inject_resent, inject_skipped, endex, questions_launched, action_marked, stop, end, decision_recorded, decision_edited, decision_deleted, poll_opened, vote_cast, poll_closed, poll_results_shown.
- `RunNote`: `run_id` (null while waiting for the start: the run adopts it at Start; a new run starts with none), `author_id`, `role`, `inject_code` (null = general), `text`, `updated_at`.
- `RunRating`: `evaluator_id`, `eeg_point_id`, `level` P/S/M/U, `rationale`, `inject_code`, `room_code` (in rooms each place is rated on its own, as its notes and key questions are: `docs/features/rooms.md`).
- `RunPresence`: `user_id`, `role`, `last_seen_at`.

**Endpoints** (router `ttx_run.py`, all under `/ttx/{ttx_id}/run`):

- Reads:
  - `GET /run?since={seq}`: run state plus new events, **projected per role**. It refreshes presence and is sent with `X-Background-Request: 1`. A Player's view is the part their room's Players share, built once per change per process (`player_view`), plus what is theirs (their decisions, their vote, their room); it names at most 30 Players present, with `presence_counts` for how many of each role. Someone coming or going rings the team's streams, not the Players' (their presence panel catches up with the next change or the page's 30 s fetch) -- `docs/deployment.md` §10.
  - `GET /run/images/{image_id}`: only images of delivered injects; a Controller gets all.
  - `GET /run/files/{file_id}`: the same rule for inject files (`released_file_ids`, sharing `_released_injects` with images), always as an `attachment` download; `GET /run/files/{file_id}/preview` shows a text file's beginning in the browser (`common/TextFilePreview`, see `docs/features/msel.md` → Inject files).
  - An inject with an `artifact` is drawn on the stage as a simulated email, press release, social post or chat message (`common/InjectArtifactView`, see `docs/features/msel.md` → Rendered artifacts); `RunInjectRead.artifact` carries it.
- Controller (`RequiresOrgAndTTXAccess(TTXContextRole.CONTROLLER)`, CSRF):
  - `POST /run/start|pause|resume|end|phase`.
  - `POST /run/stop`, with a reason.
  - `POST /run/restart` (`{mode: delete|archive}`, the word typed, no step-up; 409 `RUN_NOT_FINISHED`, `RUN_HAS_REPORT`) and `GET /run/history` (the archived runs; same readers as the summary).
  - `POST /run/injects/{code}/release|skip`.
  - `POST /run/questions`.
  - `POST /run/actions/{code}`.
- Notes and ratings:
  - `GET/PUT /run/notes[/{id}]`, with the visibility above.
  - `PUT /run/ratings/{point_id}` (Evaluator).
- **Transport: server push (SSE) as a doorbell, polling as the fallback.** `GET /run/stream?as=` (`services/run_stream.py`) sends `event: change` whenever the log moves or someone comes or goes, and `: ping` keep-alives; the page then fetches `GET /run?since=` — the per-role projection stays in one place. One watcher per exercise per process checks the fingerprint (last `seq` + who is present) every `RUN_STREAM_TICK_SECONDS` and fans out to every open stream (`listen`, asyncio queues): a query per exercise, not per viewer. Streams are async (no worker thread held), read the DB in the thread pool with their own sessions, keep the viewer present every `RUN_STREAM_KEEPALIVE_SECONDS`, end when the sign-in lapses or after `RUN_STREAM_MAX_SECONDS` (the browser reconnects), and are never activity. Headers `Cache-Control: no-store`, `X-Accel-Buffering: no` for production proxies.
- **Client** (`useRunFeed`): an `EventSource`; each ring fetches (coalesced), plus a safety fetch every 30 s. No `EventSource`, or three errors in a row, polls every 3 s and retries the stream a minute later. Closed while the tab is hidden, reopened (and fetched) when visible.
- Later, if several backend processes need to ring each other's streams instantly: Postgres `LISTEN/NOTIFY` behind the same `listen` interface.
- **MSEL additions** (built): `MselPhase.headline` and `TTXMsel.incident_date`, in the schema, the phase and scenario editors; the headline also in the `.ttx.md` export (format version 2), the date not (like the scene's start time).

## Frontend

- Components in `components/playground/`:
  - Layout and chrome: `PlaygroundPage`, `ExerciseBanner`, `PhaseTrack`, `PresenceBar`.
  - Content and dock: `InjectStage`, `InjectHistory`, `RoleDock`.
  - Role panels: `PlayerNotesPanel`, `TeamNotesPanel`, `EvaluationPanel`, `ControlCenterPanel`.
- Hook `useRunFeed(ttxId)`.
- Reuse:
  - `StorylineGraph`, with new `runState` / `nowAt` props.
  - `lib/msel.ts` time helpers and `draftFromMsel`.
  - `CodeRef`, `Panel`, `RoleBadge`, and `RatingLevels` / `EegView` for the evaluation panel.
- The module is `playground` (`ModuleName`, `PLAYGROUND_SECTIONS`, `/playground`). The i18n namespace and the `executionRole` state are named `execution`.

## Delivery slices

1. **Live skeleton** — built:
   - `ExerciseRun` + `RunEvent` (`app/models/exercise_run.py`, `services/exercise_run_service.py`, `endpoints/ttx_run.py`; tests `test_exercise_run.py`). Deleting the exercise deletes its run first (`delete_runs_for_ttx`).
   - Start, end, STOP (Control center, `ControlCenterPanel`).
   - Release mandatory injects, in planned order or any of the queue.
   - The common Playground (`PlaygroundPage`): band, phase track, current inject, history, images (`GET …/run/images`).
   - The Player projection and polling (`useRunFeed`).
   - Deviations then, all since resolved: the module was only labelled Playground (now `/playground`), there were no phase headline or scenario date fields, and the dock was a fixed column.
2. **Full control center** — built:
   - Pause / resume (`PAUSED`; `paused_at` + `paused_seconds` keep T+ honest), release with an optional reason (a contingent needs one: 422 `REASON_REQUIRED`), skip with a reason, key questions put to the table on the inject in play (`RunInjectRead.questions`; `released_questions` per phase), expected actions marked observed / partial / not observed with a note (the latest mark counts; a "not observed" flags the contingent hanging from it as `suggested`).
   - The Controller's view carries the frozen MSEL (`control.msel`) for the storyline map: `ControlStoryline` reuses `StorylineGraph` read-only with `fadeUntraversed`: what the exercise hasn't run through -- the storyline past `now` (all of it before the first inject), the stretch of storyline a delivered branch took the play off (fork to rejoin, unless a mandatory inject in between was delivered too: `lib/storylineMap.ts`'s `storylineRuns`), and the branch of every contingent not delivered -- is drawn paler (`FADED_STROKE`, a solid `color-mix` into the panel, never opacity) and dotted (a branch with no way back keeps its dash between the dots), and an undelivered inject's label is muted; every node stays the same diamond. The MSEL strip never fades lines.
     - It spans the full width above the exercise band, the stage and the dock (`PlaygroundPage`'s `top` slot, from `App.tsx`'s `ControlSectionOutlet`), not inside `ControlCenterPanel`.
     - Same frame as the MSEL strip (`StorylineFrame` + `hooks/useStorylineFrame`): legend (plus delivered / not yet / now / clock entries), session time, maximize, pin and fold, remembered under `ttx_control_storyline_*`. Defaults: folded, unpinned, legend shown (it explains the paler lines and labels), no session time; a choice already saved in the browser wins. Pinned, it sticks at the top and the Playground's sticky header (band, phases, presence) sticks below it (`--playground-top-offset`, the frame's `offsetVar`). The REAL WORLD dialog is portaled to `document.body`, since the sticky header's stacking context would leave it under the pinned storyline.
     - A solid ink line (`now`; deliberately not the accent the phase boxes use) marks where the exercise stands: the due minute of the latest delivered inject (`storylineProgress` in `lib/run.ts`).
     - A fainter dashed line (`clock`) marks the session's elapsed time.
     - The summary says how far off schedule that leaves the exercise: behind when the clock has passed the next pending mandatory inject; ahead when delivered injects are due later than the clock.
     - The drawing is its own stacking context (`isolate`), so the sticky header covers the lines on scroll.
   - Components: `ControlCenterPanel` (session + next inject), `InPlayPanel` (actions, key questions), `InjectQueue` ("Full MSEL": every inject by phase, with the sequence window's icon actions -- Release/Fire, Skip, Project in rooms --, a contingent's in the branch colour), `ReasonDialog`. The control center's dock takes half the width (`wideDock`).
   - Key questions are released and marked as discussed, by the Controller or a Facilitator.
3. **Presence and notes** — built:
   - `RunPresence` (per exercise, so it works before the start): every poll sends `?as=<role>` (validated against the caller's grant: `acting_role`) and marks them present; present = seen in the last 15 s. The poll cursor (`RunRead.cursor` = `seq` + a digest of who is present) makes arrivals and departures reach everyone without an event. A Player sees Players by name and the team only as counts (`PresenceBar`).
   - `RunNote`: one note per author, role and inject (`inject_code`; "" = general), upserted by `PUT /run/notes?as=` (empty text deletes; only on released injects: `INJECT_NOT_RELEASED`), listed by `GET /run/notes?as=` (403 `NOT_ACTING_AS`). `NotesPanel` autosaves each pad 800 ms after typing stops; notes on earlier injects are listed below. A Player's notes are private; `GET /run/notes/team` (Controllers, Planners, the Lead Evaluator) returns every other role's. Closing an account deletes its Player notes and presence (`forget_participant`); what it wrote for the team stays.
   - Facilitators get `RunRead.facilitation` (when polling as facilitator): the phase's key questions (asked ones marked) and the facilitator notes of the inject in play (`FacilitationPanel`). Controllers also take notes, and read the team's (`TeamNotesPanel`, loaded on unfold).
4. **Live evaluation** — built:
   - `RunRating` (per run, Evaluator and point; the latest counts; records the inject in play when rated). Points come from the run's own plan snapshot (`plan["eeg"]`); an Evaluator rates the EEGs assigned to them in the plan (`plan["evaluators"][].objective_ids`), the Lead Evaluator all of them (403 `POINT_NOT_ASSIGNED` otherwise).
   - `GET /run/evaluation` and `PUT /run/ratings/{point_id}` (`{level|null, rationale}`), Evaluators only (`TTXAccess.is_evaluator`), once the session has started — and still after it ends (ratings are due days later).
   - Each point carries what the Controller marked for its expected action (`action_mark`, `action_note`).
   - `EvaluationPanel` in the Evaluator's dock: progress bar, "On INJ-xx" / "All my points", P/S/M/U buttons with each level's meaning (the point's criterion, else the common scale) as tooltip and below the pick, a rationale saved on blur; refreshed whenever the log moves.
5. **Close** — built:
   - The table's end screen leads into the hot wash (what went well, what to change, what to do differently).
   - `GET /run/summary` (Controllers, Planners, Lead Evaluator; `RUN_NOT_STARTED` before the start): time played (pauses out), every inject with its state and reason, expected actions by mark, key questions asked, ratings per Evaluator (rated / their points) and by level, the team's notes count, and the plan's calendar dated from the session's day (`plan.session_date`, else the start). `SessionSummaryPanel` shows it in the control center once started -- read top-down: time played by the title; four key figures (mandatory injects out, with contingents fired / skipped / not reached; expected actions marked, with observed / partial / missed; key questions asked, with covered; the team's notes), only non-zero breakdowns shown; Evaluation (ratings by level with a bar each, each Evaluator's progress bar over the points they rate -- every point for the Lead Evaluator); skipped injects and why; feedback; What comes next, dated; the exports in the footer --, and to an Evaluator once the session is over (it renders nothing on a 403, so only the Lead Evaluator sees it).

## Decisions and votes

- **Decision log** (`DecisionLog`, a panel in every role's dock and in the Control center — under In play, above the MSEL queue — once the session has started): what the table decided, newest first, each with its inject (`CodeRef`), room, author, role and time, "edited" / "from a vote". Players, the Facilitator and the Controller record them (`POST …/run/decisions?as=`) while the session is live or paused — the hot wash too, after ENDEX, when they go on ENDEX —; the inject is the one in play where it's taken (in rooms: a Player's is where they are, a team member's the room they look at). The author, a Facilitator or a Controller rewords (`PUT`) or removes one (`DELETE`, behind the Undo toast); Observers and Evaluators read it. The Evaluator's panel also lists the decisions on the inject it rates (or all, with "All").
- **Votes**: a Facilitator or Controller puts a question with 2–6 options to the Players' vote ("Put to a vote" on the decision log, `PollDialog`; `POST …/run/polls`) on the inject in play; several can be open at once, each with its own tally. Each open one shows under the stage (`PollCard`): a Player picks an option (`PUT …/polls/{id}/vote`) and may change it while it's open; everyone sees the tally, never who voted (not in the view, not in the log). Closing it (`POST …/polls/{id}/close`) offers to record an option — the leading one by default — as the table's decision. ENDEX closes any vote still open; the hot wash can open new ones, on ENDEX. Closed votes are listed with their tallies under the decision log.
- **Polls of the MSEL** (`format: poll`, `docs/features/msel.md`): releasing the inject opens its vote (`POLL_OPENED` with `planned`), with no dialog. Played in rooms, one vote per room it's played in, each decided on its own; projecting it in the main room opens one there, once. The Players vote from the stage, with lettered options, and see how many voted and their own vote, never the tally: for a Player the server sends every option at 0. The team sees the tally, except in the Projector, where it would reach the room. Once closed, the Controller may **Show result** / **Hide result** (`POST …/polls/{id}/results`, `poll_results_shown`; never while open, so it can't sway the vote); it then reads ranked with shares, on the stage while the inject is in play and under the decision log after. Recording an option as a decision on closing shows it to the Players whatever the result's state, so here none is preselected, and the dialog says so. A poll has no delivery details on the stage.
- **Poll outcomes**: a poll of the MSEL may say what follows each option (`poll_outcomes`, frozen in `POLL_OPENED`). Closing it then asks which option the table settled on: the leading one comes selected (the first on a tie, none without votes), and the Controller or Facilitator may change it or choose no consequence (`outcome_option` on `POST …/polls/{id}/close`, kept in `POLL_CLOSED`). `RunPollRead.outcome` and `outcome_option` reach the Players with the result, under the tally; the team reads them once closed, except in the Projector until shown. A Player never receives the options not taken: `options[].outcome` is the team's. Played in rooms each room's vote settles on its own. The execution log and the draft report name the option and its consequence.
- **Impact meters** (`docs/features/msel.md`): each poll closed on an option adds that option's levels to the meters of its place (`meters_read`), against the most that poll could add, so a poll never reached counts for nothing. `RunRead.meters` is one group per place (`room_code`; one per room in rooms). The team follows them in `MetersPanel`, under the decision log, as soon as a poll settles; closing shows what each option adds. A Player gets them only once the Controller shows the summary (`POST …/run/meters {shown}`, `METERS_SHOWN`; also after the session ends), and never `options[].impacts`. The draft report lists them after the votes, and the after-action report's From the session panel reads them (`GET …/run/meters?run=`, the same readers as the feedback results). Once shown, the summary is on the Projector too.
- **Storage**: both are events of the execution log (`decision_*`, `poll_opened`, `vote_cast`, `poll_closed`, `poll_results_shown`), folded into `RunRead.decisions` / `RunRead.polls` (a Player gets their room's and the main room's). Every screen picks them up with the rest of the session; a restart archives or deletes them with the run.
- **Afterwards**: the execution log and the draft report carry them (see Exports), and the editable after-action report starts with each decision in the analysis of the objectives its inject serves (`docs/features/after-action.md`).

## Exports (execution log, draft after-action report)

- `GET /run/export/{log.pdf|log.csv|aar.pdf}?lang=` (Controllers, Planners, Lead Evaluator; downloaded, never cached), `services/run_export_service.py` with copy in `run_pdf_labels.py` merged over the MSEL PDF copy. Every PDF carries the exercise's TLP and the EXERCISE band.
- **Execution log**: every event in order — T+, wall-clock time in the plan's time zone, event, detail (inject, reason, questions, action and mark, decision, vote), who (a vote's voter shows as "—": votes stay anonymous). The CSV has the same rows (UTF-8 with BOM; a cell starting like a formula is kept as text).
- **Draft after-action report** (marked DRAFT): 1. exercise and session (times, time played, who took part by role — from presence —, stop reason); 2. objectives — each EEG point with every rating, its rationale and evaluator, and what the Controller marked for its expected action; 3. inject chronology with reasons; 4. the table's decisions by inject (when, who and as what, room, "from a vote") and its votes with their tallies; 5. the team's notes (never a Player's); 6. the feedback form's aggregates (or only the count under 3 answers); 7. next steps (the plan's calendar). The stop keyword never appears. The editable report and improvement plan are a later phase.
- In the session summary (`RunDownloads`).

## Participant feedback form

- One questionnaire for paper and screen: `app/data/feedback_form.py` (7 statements with stable keys, one per objective keyed by its code, 4 open questions, en/es); the session plan's PDF reads it too.
- Once the session is over (`ended`/`stopped`), Players, Facilitators, Observers and Evaluators answer it from their panel (`FeedbackForm`): `GET /run/feedback` (form + `submitted`), `POST /run/feedback?as=` (`{scores: {key: 1..5}, answers: {key: text}}`, all optional; 409 `RUN_NOT_OVER`, `FEEDBACK_ALREADY_SENT`, 422 `FEEDBACK_UNKNOWN_ITEM`).
- **Anonymous by construction**: `RunFeedbackSubmission` records _who_ answered (so once only), `RunFeedbackResponse` _what_ — no author, no time, only `group` player/team — never linked. Closing an account deletes its submission, not the answer.
- `GET /run/feedback/results` (Controllers, Planners, Lead Evaluator): per statement n, average and 1–5 distribution, open answers shuffled; under `FEEDBACK_MINIMUM` (3) answers only the count. Shown in the session summary (`FeedbackResults`).

## Key questions covered

- A key question put to the table can be marked covered (and unmarked) by a Controller (`InPlayPanel`) or a Facilitator (`FacilitationPanel`): `POST /run/questions/covered` (`{phase_code, position, covered}`, 409 `QUESTION_NOT_ASKED`), event `QUESTION_COVERED`. The table sees it struck through and marked; the summary counts asked and covered.

## Dock

- On `lg` and wider the dock sits beside the Playground behind a separator (a hairline with a grip that stays in view while scrolling): drag it, or focus it and use ←/→ (16 px), Home/End; between 280 px and half the page (360 px by default; the control center starts at half). A button folds it to a rail. Width and fold are remembered per module on the device (`hooks/useDockLayout`, `localStorage` `ttx_dock_<module>`). The stage is headed by a "Playground" badge, level with the dock's role badge, so each column says what it is.
- Narrower, the Playground and the dock are two tabs ("Playground" / "Your panel"; `useIsWide`).

## Open items

- Several backend processes ringing each other's streams instantly (Postgres `LISTEN/NOTIFY` behind `run_stream.listen`; `docs/roadmap.md`, section 3).
