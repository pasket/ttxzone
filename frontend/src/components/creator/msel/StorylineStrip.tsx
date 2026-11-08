import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useDisclosureMenu } from '../../../hooks/useDisclosureMenu'
import { useSavePhase } from '../../../hooks/useSavePhase'
import { useStorylineFrame } from '../../../hooks/useStorylineFrame'
import { useToast } from '../../../hooks/useToast'
import {
  emptyInjectDraft,
  incidentMinutesAt,
  hasInjectFilter,
  matchesInjectFilters,
  injectDialogPatch,
  formatOffset,
  movePhaseBox,
  newMselKey,
  resizePhase,
  type InjectDraft,
  type InjectFilters,
  type MselDraft,
  type PhaseDraft,
} from '../../../lib/msel'
import { floatingSurface } from '../../../lib/buttonStyles'
import { codeRefText } from '../../../lib/codeRef'
import {
  moveBranch,
  moveStop,
  newBranchFrom,
  newStopAt,
  storylineMap,
} from '../../../lib/storylineMap'
import type { AttackCatalog, Msel, ValidationReport } from '../../../lib/types'
import { InjectDialog } from './InjectDialog'
import { PhaseDialog } from './PhasesTab'
import { StorylineFrame, iconButtonClass, mutedClass } from './StorylineFrame'
import { StorylineGraph, type MarkAction, type PhaseEditing } from './StorylineGraph'
import type { TabProps } from './tabProps'

/** Open by default on a wide screen, pinned, session time hidden; the
 * viewer's choices are remembered in this browser only. */
const STORAGE = {
  open: 'ttx_msel_storyline_strip',
  pinned: 'ttx_msel_storyline_pinned',
  session: 'ttx_msel_storyline_session',
  legend: 'ttx_msel_storyline_legend',
}
const DEFAULTS = { pinned: true, session: false, legend: true }

export interface PhaseHistoryControls {
  /** Steps that can be undone, one at a time. */
  undoCount: number
  /** Whether the phases differ from when the tab was opened. */
  canRevert: boolean
  onUndo: () => void
  onRevert: () => void
}

/** "How does this work?" -- a "?" that opens a short note, instead of an
 * instruction that stays on screen once it's been learnt. A <details>
 * disclosure (Escape and click-outside via useDisclosureMenu), sized like
 * the strip's other header buttons. */
function StripHelp({ text, label }: { text: string; label: string }) {
  const ref = useDisclosureMenu()
  return (
    <details ref={ref} className="relative flex">
      <summary
        aria-label={label}
        title={label}
        className={`${iconButtonClass} list-none [&::-webkit-details-marker]:hidden`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" />
          <path d="M12 17h.01" />
        </svg>
      </summary>
      <p
        className={`absolute right-0 top-full z-30 mt-2 w-72 p-3 text-xs text-pretty ${floatingSurface}`}
      >
        {text}
      </p>
    </details>
  )
}

/** The storyline map, above the MSEL tabs: the exercise as it takes shape
 * -- the session axis once there's a duration, the phase bands, the
 * storyline (mandatory injects at their T+), and each contingent inject as
 * a branch from the inject it hangs from to where the storyline resumes --
 * redrawn from the page's draft as it's edited. It follows the open tab
 * (Phases brings the bands forward, Injects dims what its filters leave
 * out), and it edits: clicking the storyline adds a mandatory inject at
 * that time, a mark's menu opens its inject or starts a branch off it --
 * all in the inject dialog, right here, added only when it's done.
 * Foldable. */
export function StorylineStrip({
  msel,
  draft,
  update,
  catalog,
  readOnly,
  report,
  tab,
  filters,
  injectsHref,
  removeRow,
  saveStatus,
  phaseHistory,
}: {
  /** The Phases tab's step-by-step undo (the page keeps the history);
   * only while the phases can be edited here. */
  phaseHistory?: PhaseHistoryControls
  msel: Msel
  draft: MselDraft
  update: (patch: Partial<MselDraft>) => void
  removeRow: TabProps['removeRow']
  /** The page's save state, shown in the inject dialog. */
  saveStatus: ReactNode
  catalog: AttackCatalog | null
  readOnly: boolean
  report: ValidationReport
  tab: string
  filters: InjectFilters
  /** The Injects tab, where branch warnings are listed. */
  injectsHref: string
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const frame = useStorylineFrame(STORAGE, DEFAULTS)
  // Going to Phases with none yet unfolds the strip: it's where they're
  // drawn as they're added (not remembered -- the fold choice stays).
  const [shownTab, setShownTab] = useState(tab)
  if (tab !== shownTab) {
    setShownTab(tab)
    if (tab === 'phases' && draft.phases.length === 0 && !frame.open) frame.setOpen(true)
  }
  const [editing, setEditing] = useState<{ inject: InjectDraft; isNew: boolean } | null>(null)

  const map = draft.duration_minutes ? storylineMap(draft) : null
  const pending = t('creator.msel.table.pendingCode')
  const code = (inject: InjectDraft) => inject.code || pending
  const branchWarnings = report.warnings.filter((issue) => issue.code.startsWith('BRANCH_')).length
  const loose = map?.loose ?? []
  const highlight =
    tab === 'injects' && hasInjectFilter(filters)
      ? new Set(draft.injects.filter((i) => matchesInjectFilters(i, filters)).map((i) => i.key))
      : null

  const openInject = (inject: InjectDraft) => setEditing({ inject, isNew: false })
  const create = (inject: InjectDraft) => setEditing({ inject, isNew: true })
  // A mark dropped after a drag: a mandatory inject takes the new time (and
  // the phase holding it); a contingent one may change line (what it
  // branches off) and its trigger action's window. Into the draft with an
  // Undo -- or said why not.
  function moveInject(inject: InjectDraft, minutes: number, lane: number) {
    if (readOnly) return
    const before = draft.injects
    const result =
      inject.kind === 'mandatory'
        ? { draft: moveStop(draft, inject.key, minutes), refused: null }
        : moveBranch(draft, inject.key, minutes, lane)
    if (result.refused) {
      showToast(t(`creator.msel.map.moveRefused.${result.refused}`), { variant: 'error' })
      return
    }
    update({ injects: result.draft.injects })
    showToast(t('creator.msel.map.moved', { code: inject.code || pending }), {
      action: { label: t('common.toast.undo'), onAction: () => update({ injects: before }) },
    })
  }
  // The Phases tab: phase boxes are edited right on the map.
  const [phaseEdit, setPhaseEdit] = useState<{ phase: PhaseDraft; isNew: boolean } | null>(null)
  const savePhase = useSavePhase(draft, update)
  const phaseName = (phase: PhaseDraft) => codeRefText(phase.code, phase.name, pending)
  function withUndo(message: string, before: Pick<MselDraft, 'phases' | 'injects'>) {
    showToast(message, {
      action: { label: t('common.toast.undo'), onAction: () => update(before) },
    })
  }
  const phaseEditing: PhaseEditing | undefined =
    tab === 'phases' && !readOnly
      ? {
          onEdit: (phase) => setPhaseEdit({ phase, isNew: false }),
          deleteBlockedBy: (phase) =>
            draft.injects.some((i) => i.phase_key === phase.key)
              ? t('creator.msel.map.phaseMenu.deleteInUse')
              : null,
          onDelete: (phase) =>
            removeRow(
              'phases',
              phase.key,
              t('creator.msel.map.phaseRemoved', { phase: phaseName(phase) }),
            ),
          onMoveBox: (phase, start) => {
            const before = { phases: draft.phases, injects: draft.injects }
            const next = movePhaseBox(draft, phase.key, start)
            update({ phases: next.phases, injects: next.injects })
            withUndo(t('creator.msel.map.phaseMoved', { phase: phaseName(phase) }), before)
          },
          onResize: (phase, edge, minutes) => {
            const before = { phases: draft.phases, injects: draft.injects }
            const next = resizePhase(draft, phase.key, edge, minutes)
            const resized = next.phases.find((p) => p.key === phase.key) ?? phase
            update({ phases: next.phases })
            withUndo(
              t('creator.msel.map.phaseResized', {
                phase: phaseName(phase),
                from: formatOffset(resized.start_offset),
                to: formatOffset(resized.end_offset),
              }),
              before,
            )
          },
          onCreate: (start, end) =>
            setPhaseEdit({
              phase: {
                id: null,
                key: newMselKey(),
                code: '',
                name: '',
                start_offset: start,
                end_offset: end,
                incident_jump_minutes: 0,
                headline: '',
                situation_update: '',
                key_questions: [],
                objective_ids: [],
                due_objective_ids: [],
              },
              isNew: true,
            }),
        }
      : undefined

  const markActions = (inject: InjectDraft): MarkAction[] => [
    {
      label: t('creator.msel.map.open', { code: code(inject) }),
      onSelect: () => openInject(inject),
    },
    ...(readOnly
      ? []
      : [
          {
            label: t('creator.msel.map.branchFrom', { code: code(inject) }),
            onSelect: () => create(newBranchFrom(draft, inject)),
          },
        ]),
  ]

  // What to do next while there's still nothing (or little) to draw.
  const hint = !draft.duration_minutes
    ? t('creator.msel.strip.needsDuration')
    : draft.phases.length === 0
      ? t('creator.msel.strip.needsPhases')
      : map && map.stops.length === 0
        ? t('creator.msel.strip.needsInjects')
        : null
  const summary = map
    ? `${t('creator.msel.strip.stops', { count: map.stops.length })} · ${t(
        'creator.msel.strip.branches',
        { count: map.branches.length },
      )}`
    : null
  return (
    <StorylineFrame
      frame={frame}
      title={t('creator.msel.strip.title')}
      summary={hint ?? summary}
      hasMap={map !== null}
      offsetVar="--msel-strip-offset"
      meta={
        <>
          {branchWarnings > 0 && (
            <Link
              to={injectsHref}
              replace
              className="rounded-xs border border-inactive-1/60 bg-inactive-1/10 px-1.5 text-xs text-paper-ink hover:bg-inactive-1/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg"
            >
              {t('creator.msel.strip.warnings', { count: branchWarnings })}
            </Link>
          )}
          {phaseHistory && map && (
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Says why the boxes look different here: they can be edited. */}
              <span className="rounded-xs border border-dashed border-accent bg-accent/10 px-1.5 text-xs text-accent-fg">
                {t('creator.msel.phaseHistory.editing')}
              </span>
              <button
                type="button"
                disabled={phaseHistory.undoCount === 0}
                onClick={phaseHistory.onUndo}
                aria-label={t('creator.msel.phaseHistory.undoLabel', {
                  count: phaseHistory.undoCount,
                })}
                title={t('creator.msel.phaseHistory.undoLabel', { count: phaseHistory.undoCount })}
                className="flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-paper-ink/70 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-fg-muted"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
                <span aria-hidden="true" className="tabular-nums">
                  {phaseHistory.undoCount}
                </span>
              </button>
              <button
                type="button"
                disabled={!phaseHistory.canRevert}
                onClick={phaseHistory.onRevert}
                className="h-8 rounded-sm px-2 text-xs font-medium text-accent-fg hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:text-paper-ink/40 disabled:hover:bg-transparent dark:disabled:text-fg-faint"
              >
                {t('creator.msel.phaseHistory.revert')}
              </button>
            </div>
          )}
        </>
      }
      actions={
        map &&
        !readOnly && (
          <>
            <button
              type="button"
              onClick={() => create(emptyInjectDraft(draft, { kind: 'mandatory' }))}
              aria-label={t('creator.msel.map.addInject')}
              title={t('creator.msel.map.addInject')}
              className={iconButtonClass}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <StripHelp
              text={
                tab === 'phases'
                  ? `${t('creator.msel.map.editHint')} ${t('creator.msel.map.phasesHint')}`
                  : t('creator.msel.map.editHint')
              }
              label={t('creator.msel.map.helpLabel')}
            />
          </>
        )
      }
      belowMap={
        loose.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={mutedClass}>{t('creator.msel.map.looseTitle')}:</span>
            {loose.map((inject) => (
              <button
                key={inject.key}
                type="button"
                title={t('creator.msel.map.looseHint')}
                onClick={() => openInject(inject)}
                className="rounded-xs border border-dashed border-paper-line px-2 py-0.5 text-left text-xs hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:border-line"
              >
                <span translate="no" className="mr-1.5 font-mono">
                  {code(inject)}
                </span>
                {inject.title || '—'}
              </button>
            ))}
          </div>
        )
      }
      footer={
        <>
          {phaseEdit && (
            <PhaseDialog
              initial={phaseEdit.phase}
              draft={draft}
              needs={msel.needs}
              title={
                phaseEdit.isNew
                  ? t('creator.msel.dialogs.newPhase')
                  : t('creator.msel.dialogs.phaseTitle', { code: phaseName(phaseEdit.phase) })
              }
              initialFocusId={null}
              readOnly={readOnly}
              onCancel={() => setPhaseEdit(null)}
              onDone={(phase, pushLater) => {
                if (!readOnly) savePhase(phase, pushLater)
                setPhaseEdit(null)
              }}
            />
          )}
          {editing && (
            <InjectDialog
              rooms={msel.uses_rooms ? (msel.rooms ?? []) : []}
              ttxId={msel.ttx_id}
              initial={editing.inject}
              draft={draft}
              needs={msel.needs}
              catalog={catalog}
              readOnly={readOnly}
              isNew={editing.isNew}
              initialFocusId={null}
              saveStatus={saveStatus}
              onChange={(inject, newActors) => update(injectDialogPatch(draft, inject, newActors))}
              onDraftPatch={update}
              onClose={() => setEditing(null)}
              onDiscard={(inject) =>
                removeRow('injects', inject.key, t('creator.msel.wizard.discarded'))
              }
            />
          )}
        </>
      }
    >
      {({ maximized, showSession }) =>
        map && (
          <StorylineGraph
            map={map}
            phases={draft.phases}
            markActions={markActions}
            onAddAt={readOnly ? undefined : (minutes) => create(newStopAt(draft, minutes))}
            onMove={readOnly ? undefined : moveInject}
            phaseEditing={phaseEditing}
            highlight={highlight}
            emphasizePhases={tab === 'phases'}
            size={maximized ? 'large' : 'normal'}
            startTime={draft.exercise_start}
            incidentAt={(minutes) => incidentMinutesAt(draft, minutes)}
            incidentStart={draft.incident_start}
            showSession={showSession}
          />
        )
      }
    </StorylineFrame>
  )
}
