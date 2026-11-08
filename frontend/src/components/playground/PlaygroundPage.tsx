import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DOCK_MIN, useDockLayout, useIsWide } from '../../hooks/useDockLayout'
import { useElementWidth } from '../../hooks/useElementWidth'
import { usePlaceName } from '../../hooks/usePlaceName'
import { usePresentation } from '../../hooks/usePresentation'
import { useProjectorFold } from '../../hooks/useProjectorFold'
import { useRunFeed } from '../../hooks/useRunFeed'
import { useStageRoom } from '../../hooks/useViewedRoom'
import { foldToggle } from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import { injectSequence, stageInjects } from '../../lib/run'
import type { RunRead } from '../../lib/types'
import { FoldIcon } from '../common/FoldIcon'
import { FormattedText } from '../common/FormattedText'
import { HelpText } from '../common/HelpText'
import { MaximizeIcon } from '../common/MaximizeIcon'
import { Panel } from '../common/Panel'
import { RoleBadge } from '../common/RoleBadge'
import { RoleIcon } from '../common/RoleIcon'
import { MeterGroups } from './MetersPanel'
import { ExerciseBanner } from './ExerciseBanner'
import type { StageView } from './InjectStage'
import { PhaseTrack } from './PhaseTrack'
import { PollCard } from './PollCard'
import { PresenceBar, PresenceColumn } from './PresenceBar'
import { RoomBar, RoomStage } from './RoomStage'

/** What a role does at the table, under the dock's header: `id` is the
 * text's i18n key (HelpText remembers its fold by it). */
export interface DockNote {
  id: string
  text: string
}

/** The Playground: the live session as the table sees it, identical for
 * every role -- the exercise band with the stop keyword, the phase track
 * (the story so far, each inject to pick and read again on the stage),
 * the inject in play -- with the role's own panel
 * docked beside it (`dock`, given the view and how to apply a change),
 * headed by who the user takes part as. `top` spans the page above it all,
 * the exercise band included (the Controller's storyline). On a projector
 * (`Projector`) the table's view alone fills the screen; the page stays
 * mounted, hidden, so nothing in the dock is lost. */
export function PlaygroundPage({
  ttxId,
  role,
  dock,
  dockNote,
  wideDock = false,
  top,
}: {
  ttxId: string
  /** The role the user takes part as: marks them present as it. */
  role: ContextRole | null
  dock: (run: RunRead, apply: (next: RunRead) => void) => ReactNode
  dockNote?: DockNote
  /** The control center: the dock takes up to half the width. */
  wideDock?: boolean
  top?: (run: RunRead) => ReactNode
}) {
  const { t } = useTranslation()
  const { run, error, apply } = useRunFeed(ttxId, role)
  const wide = useIsWide()
  const [tab, setTab] = useState<'stage' | 'dock'>('stage')
  const where = useStageRoom(run?.rooms)
  // The inject picked on the phase track to read again, for the run and
  // the place it was picked in (a new run or another room drops it).
  const [picked, setPicked] = useState<{ code: string; scope: string } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const presentRef = useRef<HTMLButtonElement>(null)
  const presentation = usePresentation(rootRef, presentRef)
  const presenting = presentation.presenting

  if (!run) {
    return error ? (
      <p className="text-sm text-danger-fg">{t('playground.loadError')}</p>
    ) : (
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">{t('common.loading')}</p>
    )
  }

  const scope = `${run.run_number ?? 0}:${where ?? ''}`
  const injects = stageInjects(run, where)
  const view: StageView = {
    sequence: injectSequence(run),
    showCodes: role !== 'player',
    reviewing: picked?.scope === scope ? picked.code : null,
    onReview: (code) => setPicked(code ? { code, scope } : null),
  }
  const inPlayCode =
    run.rooms && where === 'main'
      ? run.rooms.main_projected
      : (injects[injects.length - 1]?.code ?? null)

  const stageWith = (stageView: StageView) => (
    <>
      <SessionState run={run} />
      {run.state !== 'not_started' && <RoomStage ttxId={ttxId} run={run} view={stageView} />}
      <PollCard
        ttxId={ttxId}
        run={run}
        role={role}
        inPlayCode={inPlayCode}
        presenting={Boolean(stageView.presenting)}
        showCodes={stageView.showCodes}
        onChange={apply}
      />
      {/* Between ENDEX and the end, the hot wash runs under the closing
          message. */}
      {run.state === 'live' && run.endex_released_at && <HotWash run={run} />}
    </>
  )
  const stage = stageWith(view)
  const presentLabel = presenting ? t('playground.projector.stop') : t('playground.projector.start')
  const presentButton = (className: string) => (
    <button
      ref={presentRef}
      type="button"
      onClick={presentation.toggle}
      aria-pressed={presenting}
      aria-label={presentLabel}
      title={presentLabel}
      className={className}
    >
      <MaximizeIcon restore={presenting} />
    </button>
  )

  return (
    <div
      ref={rootRef}
      tabIndex={presenting ? -1 : undefined}
      className={
        presenting
          ? `h-screen overflow-y-auto overscroll-contain bg-paper text-paper-ink focus:outline-none dark:bg-ink dark:text-fg ${
              presentation.fullscreen ? '' : 'fixed inset-0 z-50'
            }`
          : ''
      }
    >
      {presenting && (
        <Projector
          ttxId={ttxId}
          run={run}
          apply={apply}
          connectionLost={Boolean(error)}
          injects={injects}
          inPlayCode={inPlayCode}
          // Never an MSEL code on the room's screen, whoever presents.
          view={{ ...view, showCodes: false, presenting: true }}
          stage={stageWith({ ...view, showCodes: false, presenting: true })}
          exit={presentButton(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs hover:bg-current/15 focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:outline-none',
          )}
        />
      )}
      <h1 className="sr-only">{t('playground.pageTitle')}</h1>
      <div hidden={presenting} className="space-y-4">
        {top?.(run)}
        {/* Sticks below a pinned `top` (which keeps its height in
          `--playground-top-offset`), else at the top. */}
        <div className="sticky top-[var(--playground-top-offset,0px)] z-10 space-y-2 bg-paper pb-2 dark:bg-ink">
          <ExerciseBanner ttxId={ttxId} run={run} apply={apply} />
          <PhaseTrack run={run} injects={injects} inPlayCode={inPlayCode} view={view} />
          <PresenceBar
            presence={run.presence}
            counts={run.presence_counts}
            aside={run.rooms && run.state !== 'not_started' ? <RoomBar run={run} /> : undefined}
          />
          <SessionNotices run={run} connectionLost={Boolean(error)} />
        </div>
        {/* A new run starts every panel afresh (notes, ratings, feedback). */}
        <div key={run.run_number ?? 0}>
          {wide ? (
            <DockedColumns
              present={presenting ? null : presentButton(foldToggle)}
              module={wideDock ? 'control' : 'playground'}
              wideDock={wideDock}
              role={role}
              note={dockNote}
              stage={stage}
              dock={dock(run, apply)}
            />
          ) : (
            <div className="space-y-4">
              <div
                role="tablist"
                aria-label={t('playground.views')}
                className="flex gap-1 border-b border-panel-line"
              >
                {(['stage', 'dock'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`playground-tab-${key}`}
                    aria-selected={tab === key}
                    aria-controls={`playground-view-${key}`}
                    onClick={() => setTab(key)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                      tab === key
                        ? 'border-accent font-semibold text-accent-fg'
                        : 'border-transparent text-paper-ink/70 dark:text-fg-muted'
                    }`}
                  >
                    {key === 'stage' ? t('playground.tabs.stage') : t('playground.rolePanel')}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`playground-view-${tab}`}
                aria-labelledby={`playground-tab-${tab}`}
              >
                {tab === 'stage' ? (
                  stage
                ) : (
                  <>
                    <DockHeader role={role} note={dockNote} />
                    {dock(run, apply)}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** The Playground on a projector, for the room: the exercise band edge to
 * edge at the top with the way out at its end, the session's notices
 * under it, the stage with who is present in a column at its right, and
 * the storyline (the phase track) along the bottom, sticking there when
 * the stage runs longer than the screen. The presence column and the
 * storyline fold, each remembered on this device (`useProjectorFold`). */
/** The impact meters' summary on the room's screen, once shown. */
function ProjectedMeters({ run }: { run: RunRead }) {
  const { t } = useTranslation()
  const placeName = usePlaceName(run)
  const groups = run.meters ?? []
  if (groups.length === 0) return null
  return (
    <Panel title={t('playground.meters.title')}>
      <MeterGroups groups={groups} placeName={placeName} />
    </Panel>
  )
}

function Projector({
  ttxId,
  run,
  apply,
  connectionLost,
  injects,
  inPlayCode,
  view,
  stage,
  exit,
}: {
  ttxId: string
  run: RunRead
  apply: (next: RunRead) => void
  connectionLost: boolean
  injects: ReturnType<typeof stageInjects>
  inPlayCode: string | null
  view: StageView
  stage: ReactNode
  exit: ReactNode
}) {
  const { t } = useTranslation()
  const presence = useProjectorFold('presence')
  const storyline = useProjectorFold('storyline')
  const presenceLabel = presence.folded
    ? t('playground.projector.showPresence')
    : t('playground.projector.hidePresence')
  const storylineLabel = storyline.folded
    ? t('playground.projector.showStoryline')
    : t('playground.projector.hideStoryline')
  const current = run.phases.find((phase) => phase.state === 'current')
  return (
    <div className="flex min-h-full flex-col">
      <ExerciseBanner ttxId={ttxId} run={run} apply={apply} className="" aside={exit} />
      <div className="space-y-2 px-4 pt-3 empty:hidden sm:px-6">
        <SessionNotices run={run} connectionLost={connectionLost} />
      </div>
      <div className="flex flex-1 items-start gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1 space-y-4">
          {run.rooms && run.state !== 'not_started' && <RoomBar run={run} />}
          {stage}
          {run.meters_shown && <ProjectedMeters run={run} />}
        </div>
        <div className="sticky top-4 shrink-0">
          <PresenceColumn
            presence={run.presence}
            counts={run.presence_counts}
            folded={presence.folded}
            toggle={
              <button
                type="button"
                onClick={presence.toggle}
                aria-expanded={!presence.folded}
                aria-label={presenceLabel}
                title={presenceLabel}
                className={foldToggle}
              >
                <FoldIcon collapsed={presence.folded} side="right" />
              </button>
            }
          />
        </div>
      </div>
      <section
        aria-label={t('playground.projector.storyline')}
        className="sticky bottom-0 z-10 bg-paper px-4 pt-2 pb-4 sm:px-6 dark:bg-ink"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {storyline.folded ? (
              <p className="flex h-8 items-center gap-2 text-sm">
                <span className="font-semibold">{t('playground.projector.storyline')}</span>
                {current && (
                  <span className="text-paper-ink/70 dark:text-fg-muted">
                    {current.name ?? t('playground.phaseNumber', { number: current.number })}
                  </span>
                )}
              </p>
            ) : (
              <PhaseTrack run={run} injects={injects} inPlayCode={inPlayCode} view={view} />
            )}
          </div>
          <button
            type="button"
            onClick={storyline.toggle}
            aria-expanded={!storyline.folded}
            aria-label={storylineLabel}
            title={storylineLabel}
            className={foldToggle}
          >
            <FoldIcon collapsed={storyline.folded} side="bottom" />
          </button>
        </div>
      </section>
    </div>
  )
}

/** The stage's head, level with the dock's: names the shared view the way
 * the dock's badge names the role's panel, in the same badge -- with the
 * way to show it on a projector (`present`) at the right. */
function StageHeader({ present }: { present?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex h-8 items-center justify-between gap-2">
      <span className="inline-flex h-5 items-center gap-1 rounded-xs bg-accent/10 px-1.5 text-xs font-medium whitespace-nowrap text-accent-fg">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="4" rx="1" />
          <rect x="13" y="10" width="7" height="10" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
        </svg>
        {t('playground.tabs.stage')}
      </span>
      {present}
    </div>
  )
}

/** The dock's head: who the user takes part as -- said once, here (the
 * ContextBar and the presence bar only name the role) -- what that means at
 * the table, folded to a line once read, and the fold toggle (`toggle`)
 * at the right, on the same row, so the dock starts level with the stage. */
function DockHeader({
  role,
  note,
  toggle,
}: {
  role: ContextRole | null
  note?: DockNote
  toggle?: ReactNode
}) {
  const { t } = useTranslation()
  if (!role && !toggle) return null
  return (
    <div className="mb-3 space-y-1">
      <div className="flex h-8 items-center justify-between gap-2">
        {role && (
          <p className="min-w-0 text-sm">
            <span className="sr-only">
              {t('execution.landing.actingAs', { role: t(CONTEXT_ROLE_LABEL_KEYS[role]) })}
            </span>
            <span aria-hidden="true">
              <RoleBadge role={role} className="" />
            </span>
          </p>
        )}
        {toggle}
      </div>
      {role && note && (
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText id={note.id} text={note.text} />
        </p>
      )}
    </div>
  )
}

/** Side by side: the Playground, a separator to drag (or move with the
 * arrow keys) and the dock, which folds to a rail on the right edge -- the
 * Primary Menu's fold, mirrored. Its width and fold are remembered per
 * module; it never goes under DOCK_MIN or over half the page. */
function DockedColumns({
  present,
  module,
  wideDock,
  role,
  note,
  stage,
  dock,
}: {
  present?: ReactNode
  module: string
  wideDock: boolean
  role: ContextRole | null
  note?: DockNote
  stage: ReactNode
  dock: ReactNode
}) {
  const { t } = useTranslation()
  const { width, folded, setWidth, toggleFold } = useDockLayout(module)
  const [rowRef, rowWidth] = useElementWidth<HTMLDivElement>()
  const dragging = useRef(false)
  // Half the row (unmeasured -- no ResizeObserver -- as on a 1280 px page).
  const max = Math.max(DOCK_MIN, Math.floor((rowWidth || 1280) / 2))
  const clamp = (value: number) => Math.min(max, Math.max(DOCK_MIN, Math.round(value)))
  const current = width ?? (wideDock ? null : 360)

  function onKeyDown(event: KeyboardEvent) {
    const from = current ?? max
    const next =
      event.key === 'ArrowLeft'
        ? from + 16
        : event.key === 'ArrowRight'
          ? from - 16
          : event.key === 'Home'
            ? DOCK_MIN
            : event.key === 'End'
              ? max
              : null
    if (next === null) return
    event.preventDefault()
    setWidth(clamp(next))
  }
  const toggleLabel = folded ? t('playground.dock.unfold') : t('playground.dock.fold')
  const toggle = (
    <button
      type="button"
      onClick={toggleFold}
      aria-expanded={!folded}
      aria-label={toggleLabel}
      title={toggleLabel}
      className={foldToggle}
    >
      <FoldIcon collapsed={folded} side="right" />
    </button>
  )
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const row = event.currentTarget.parentElement
    if (!dragging.current || !row) return
    setWidth(clamp(row.getBoundingClientRect().right - event.clientX))
  }

  return (
    <div ref={rowRef} className="flex items-start gap-0">
      <div className="min-w-0 flex-1 space-y-3 pr-2">
        <StageHeader present={present} />
        <div className="space-y-4">{stage}</div>
      </div>
      {!folded && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('playground.dock.resize')}
          aria-valuemin={DOCK_MIN}
          aria-valuemax={max}
          aria-valuenow={current ?? max}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            dragging.current = true
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            dragging.current = false
          }}
          className="group flex w-3 shrink-0 cursor-col-resize justify-center self-stretch rounded-sm hover:bg-accent/10 focus-visible:bg-accent/20 focus-visible:outline-none"
          style={{ touchAction: 'none' }}
        >
          {/* A hairline the full height, with a grip that stays in view
              while the page scrolls, so the dock reads as resizable. */}
          <span className="relative w-px bg-panel-line group-hover:bg-accent group-focus-visible:bg-accent">
            <span
              aria-hidden="true"
              className="sticky top-1/2 -ml-[3px] flex h-10 w-[7px] flex-col items-center justify-center gap-[3px] rounded-full border border-panel-line bg-panel group-hover:border-accent group-focus-visible:border-accent"
            >
              <span className="h-[3px] w-[3px] rounded-full bg-paper-ink/40 dark:bg-fg-muted" />
              <span className="h-[3px] w-[3px] rounded-full bg-paper-ink/40 dark:bg-fg-muted" />
              <span className="h-[3px] w-[3px] rounded-full bg-paper-ink/40 dark:bg-fg-muted" />
            </span>
          </span>
        </div>
      )}
      <aside
        aria-label={t('playground.rolePanel')}
        className="shrink-0 pl-2"
        style={{ width: folded ? 40 : current === null ? '50%' : current }}
      >
        {folded ? (
          // The rail: the toggle, and the role as an icon so who the user
          // takes part as stays on screen.
          <div className="flex flex-col items-center gap-2">
            {toggle}
            {role && (
              <span
                title={t(CONTEXT_ROLE_LABEL_KEYS[role])}
                className="flex h-8 w-8 items-center justify-center text-accent-fg"
              >
                <RoleIcon role={role} />
                <span className="sr-only">
                  {t('execution.landing.actingAs', { role: t(CONTEXT_ROLE_LABEL_KEYS[role]) })}
                </span>
              </span>
            )}
          </div>
        ) : (
          <>
            <DockHeader role={role} note={note} toggle={toggle} />
            {dock}
          </>
        )}
      </aside>
    </div>
  )
}

/** The session's notices -- stopped, paused (for a real-world event or
 * not), ended, the connection lost -- in the sticky band under the presence
 * strip, so they stay in sight while the table scrolls. */
function SessionNotices({ run, connectionLost }: { run: RunRead; connectionLost: boolean }) {
  const { t, i18n } = useTranslation()
  const notices: ReactNode[] = []
  if (connectionLost) {
    notices.push(
      <Notice
        key="connection"
        tone="danger"
        icon={<OfflineIcon />}
        title={t('playground.connectionLost')}
      />,
    )
  }
  if (run.state === 'stopped') {
    notices.push(
      <Notice
        key="stopped"
        tone="danger"
        icon={<StopIcon />}
        title={t('playground.state.stopped')}
        body={run.stop_reason}
      />,
    )
  } else if (run.state === 'paused' && run.real_world_at) {
    notices.push(
      <Notice
        key="real-world"
        tone="danger"
        icon={<AlertIcon />}
        title={t('playground.realWorld.paused')}
        body={t('playground.realWorld.pausedBy', {
          name: run.real_world_by ?? '—',
          time: new Date(run.real_world_at).toLocaleTimeString(i18n.language, {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })}
      />,
    )
  } else if (run.state === 'paused') {
    notices.push(
      <Notice
        key="paused"
        tone="accent"
        icon={<PauseIcon />}
        title={t('playground.state.paused')}
        body={t('playground.state.pausedHint')}
      />,
    )
  } else if (run.state === 'live' && run.endex_released_at) {
    notices.push(
      <Notice
        key="endex"
        tone="accent"
        icon={<FlagIcon />}
        title={t('playground.state.endex')}
        body={t('playground.state.endedNext')}
      />,
    )
  } else if (run.state === 'ended') {
    notices.push(
      <Notice
        key="ended"
        tone="accent"
        icon={<FlagIcon />}
        title={t('playground.state.ended')}
        body={t('playground.state.endedNext')}
      />,
    )
  }
  return notices.length > 0 ? <>{notices}</> : null
}

/** One notice: an icon ahead and a thick left strip in the state's colour
 * -- the danger red for what stops the table, the accent otherwise. */
function Notice({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'danger' | 'accent'
  icon: ReactNode
  title: string
  body?: string | null
}) {
  const danger = tone === 'danger'
  return (
    <div
      role={danger ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-sm border border-l-4 px-4 py-2.5 ${
        danger
          ? 'border-danger border-l-danger bg-danger/10'
          : 'border-accent/40 border-l-accent bg-accent/10'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${danger ? 'text-danger-fg' : 'text-accent-fg'}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className={`font-semibold ${danger ? 'text-danger-fg' : ''}`}>{title}</p>
        {body && <p className="mt-0.5 text-sm text-paper-ink/70 dark:text-fg-muted">{body}</p>}
      </div>
    </div>
  )
}

function NoticeIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  )
}

function StopIcon() {
  return (
    <NoticeIcon>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </NoticeIcon>
  )
}

function FlagIcon() {
  return (
    <NoticeIcon>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </NoticeIcon>
  )
}

function OfflineIcon() {
  return (
    <NoticeIcon>
      <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M12 20h.01M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5" />
    </NoticeIcon>
  )
}

function PauseIcon() {
  return (
    <NoticeIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </NoticeIcon>
  )
}

function AlertIcon() {
  return (
    <NoticeIcon>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </NoticeIcon>
  )
}

/** The hot wash's questions: from ENDEX on, and once ended (with where to
 * answer the feedback form). */
function HotWash({ run }: { run: RunRead }) {
  const { t } = useTranslation()
  const ended = run.state === 'ended'
  return (
    <Panel label={t(ended ? 'playground.state.ended' : 'playground.state.endex')}>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{t('playground.hotWash.wentWell')}</li>
        <li>{t('playground.hotWash.improve')}</li>
        <li>{t('playground.hotWash.takeAway')}</li>
      </ul>
      {ended && (
        <p className="mt-3 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.feedback.where')}
        </p>
      )}
    </Panel>
  )
}

/** Before it starts: the scenario's summary for the table and a word on
 * waiting; once ended, the hot wash's questions (the notice above says it
 * ended). */
function SessionState({ run }: { run: RunRead }) {
  const { t } = useTranslation()
  if (run.state === 'ended') return <HotWash run={run} />
  if (run.state === 'not_started') {
    return (
      <Panel title={run.scenario_title || t('playground.state.notStarted')}>
        {run.scenario_summary && <FormattedText text={run.scenario_summary} />}
        <p className="mt-3 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.state.waiting')}
        </p>
      </Panel>
    )
  }
  return null
}
