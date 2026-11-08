import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { mergeMselProposals, mselMetaRow, renumberRow } from '../../../lib/proposals'
import { ProposalsPanel } from '../../assistant/ProposalsPanel'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../../hooks/useAuth'
import { useAutosavedDocument } from '../../../hooks/useAutosavedDocument'
import { useMselIssueMessage } from '../../../hooks/useMselIssueMessage'
import { useRenumberCodes } from '../../../hooks/useRenumberCodes'
import { useToast } from '../../../hooks/useToast'
import { useUndoableRowRemoval, restoreRow } from '../../../hooks/useUndoableRowRemoval'
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning'
import { apiFetch, ApiError } from '../../../lib/api'
import { btnPrimary, btnSecondary, linkAccent } from '../../../lib/buttonStyles'
import {
  adoptSavedIds,
  draftFromMsel,
  INJECT_ROW_FIELDS,
  MSEL_TABS,
  mselFieldId,
  payloadFromDraft,
  PHASE_ROW_FIELDS,
  reconcileSaved,
  sameMselDraft,
  tabIssues,
  tabWarnings,
  INJECT_FILTERS,
  issueInjectFilter,
  relocateIssues,
  issueFixes,
  type MselDraft,
  injectFiltersFrom,
  type MselTabKey,
  phaseSnapshot,
  restoreSnapshot,
  type PhaseSnapshot,
} from '../../../lib/msel'
import type {
  AttackCatalog,
  AttackUpgradeResult,
  Msel,
  MselRenumberKind,
  MselRenumberResult,
  MselStatus,
} from '../../../lib/types'
import { IssueSummary, SectionIssueList, type IssueTarget } from '../../common/IssueSummary'
import { StatusTrack } from '../../common/StatusTrack'
import { Modal } from '../../common/Modal'
import { Panel } from '../../common/Panel'
import { RenumberButton } from '../../common/RenumberButton'
import { SaveStatus } from '../../common/SaveStatus'
import { SectionHeader } from '../../common/SectionHeader'
import { TlpBadge } from '../../common/TlpBadge'
import { FieldGroup } from '../../common/FieldGroup'
import { CoverageTab, LoadTable } from './AnalysisTabs'
import { StorylineStrip } from './StorylineStrip'
import { InjectsTab } from './InjectsTab'
import { MselDownloads } from './MselDownloads'
import { PhasesTab } from './PhasesTab'
import { ScenarioTab } from './ScenarioTab'
import { ThreatActorsTab } from './ThreatActorsTab'
import type { TabProps } from './tabProps'
import { HelpText } from '../../common/HelpText'

/** Issues (from the live report) that make the backend reject a save. */
const SAVE_BLOCKING_CODES = new Set(['UNKNOWN_OBJECTIVE'])

const TOAST_BY_TARGET: Record<MselStatus, 'inReview' | 'ready' | 'backToDraft'> = {
  in_review: 'inReview',
  ready: 'ready',
  draft: 'backToDraft',
}

const TAB_COMPONENTS: Partial<Record<MselTabKey, (props: TabProps) => React.ReactNode>> = {
  scenario: ScenarioTab,
  phases: PhasesTab,
  injects: InjectsTab,
  threats: ThreatActorsTab,
  coverage: CoverageTab,
}

/** Creator -> MSEL: the exercise's Master Scenario Events List, one tab at
 * a time (`?tab=`). Same model as the needs analysis: one page-level draft
 * that saves itself a moment after the user stops editing, and the
 * backend's validation report -- of the saved MSEL, or a dry run of the
 * unsaved draft -- driving the summary and the tab states. Read-only while
 * the needs analysis is being revised. */
/** At most this many steps back in the Phases tab (the original stays). */
const PHASE_HISTORY_LIMIT = 20

interface PhaseHistory {
  /** The phases as they were before the first change of this visit. */
  original: PhaseSnapshot | null
  steps: PhaseSnapshot[]
}

const EMPTY_PHASE_HISTORY: PhaseHistory = { original: null, steps: [] }

export function CreatorMselSection() {
  const { ttxId } = useParams<{ ttxId: string }>()
  const { data, error, refetch } = useApiResource<Msel>(`/ttx/${ttxId}/msel`)
  const { t } = useTranslation()

  // `baseline` is the draft that matches the saved MSEL, `draft` what the
  // user sees; they differ while there are unsaved edits.
  const [msel, setMsel] = useState<Msel | null>(null)
  const [baseline, setBaseline] = useState<MselDraft | null>(null)
  const [draft, setDraft] = useState<MselDraft | null>(null)
  const [loaded, setLoaded] = useState<Msel | null>(null)
  if (data && data !== loaded) {
    setLoaded(data)
    setMsel(data)
    setBaseline(draftFromMsel(data))
    setDraft(draftFromMsel(data))
  }
  // The ATT&CK release the MSEL is pinned to (it changes on an upgrade).
  const catalog = useApiResource<AttackCatalog>(msel ? `/attack/${msel.attack_version}` : null).data

  if (error && !msel) {
    return (
      <div className="space-y-4">
        <SectionHeader title={t('creator.msel.title')} />
        <p role="alert" className="text-sm text-danger-fg">
          {t('creator.msel.loadError')}{' '}
          <button type="button" onClick={refetch} className="underline">
            {t('creator.msel.retry')}
          </button>
        </p>
      </div>
    )
  }
  if (!msel || !draft || !baseline || !ttxId) return null

  return (
    <MselEditor
      ttxId={ttxId}
      msel={msel}
      draft={draft}
      baseline={baseline}
      catalog={catalog}
      onDraftChange={setDraft}
      onServerMsel={(next) => {
        setMsel(next)
        setBaseline(draftFromMsel(next))
        setDraft(draftFromMsel(next))
      }}
      onSaved={(next, sent) => {
        const saved = reconcileSaved(sent, next)
        setMsel(next)
        setBaseline(saved)
        // Edits made while the save was in flight stay; rows created
        // before it just adopt the ids the server gave them.
        setDraft((current) =>
          current === null || sameMselDraft(current, sent) ? saved : adoptSavedIds(current, saved),
        )
      }}
      onReload={refetch}
    />
  )
}

function MselEditor({
  ttxId,
  msel,
  draft,
  baseline,
  catalog,
  onDraftChange,
  onServerMsel,
  onSaved,
  onReload,
}: {
  ttxId: string
  msel: Msel
  draft: MselDraft
  baseline: MselDraft
  catalog: AttackCatalog | null
  onDraftChange: Dispatch<SetStateAction<MselDraft | null>>
  onServerMsel: (msel: Msel) => void
  onSaved: (msel: Msel, sent: MselDraft) => void
  onReload: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const readOnly = !msel.editable
  // Editing an MSEL past draft sends it back to draft: the first edit asks,
  // and the answer holds for this status and version.
  const [pendingPatch, setPendingPatch] = useState<Partial<MselDraft> | null>(null)
  const [editConfirmedFor, setEditConfirmedFor] = useState<string | null>(null)
  const statusKey = `${msel.version}:${msel.status}`
  const editingAllowed = !readOnly && (msel.status === 'draft' || editConfirmedFor === statusKey)
  // `?inject=<id>` (Library -> Injects' edit link) opens that inject.
  const [focusRow, setFocusRow] = useState<TabProps['focusRow']>(() => {
    const injectId = searchParams.get('inject')
    return injectId ? { field: 'title', itemId: injectId } : null
  })
  // A field to focus once `tab` has rendered -- it names its tab: see the
  // same ref on the needs analysis page (a click before the first effects
  // must not be consumed by the tab being left).
  const pendingFocusRef = useRef<{ tab: string; id: string } | null>(null)

  const requested = searchParams.get('tab')
  // It only opens it once: drop it so a reload or Back doesn't reopen it.
  useEffect(() => {
    if (!searchParams.has('inject')) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('inject')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])
  // The old timeline / storyline map tab lives above every tab now; its
  // links land on Injects.
  const tab =
    MSEL_TABS.find(
      (item) =>
        item.key ===
        // Retired tabs: the timeline is the storyline map above every tab
        // (its links land on Injects); the load by recipient is in Review.
        (requested === 'timeline' ? 'injects' : requested === 'load' ? 'review' : requested),
    ) ?? MSEL_TABS[0]
  const dirty = !sameMselDraft(draft, baseline)
  useUnsavedChangesWarning(dirty)

  // The Phases tab's history: a snapshot before each change made there
  // (map or table), to undo step by step or go back to how the phases
  // were when the tab was opened. Leaving the tab forgets it.
  const [phaseHistory, setPhaseHistory] = useState<PhaseHistory>(EMPTY_PHASE_HISTORY)
  const [historyTab, setHistoryTab] = useState(tab.key)
  if (historyTab !== tab.key) {
    setHistoryTab(tab.key)
    setPhaseHistory(EMPTY_PHASE_HISTORY)
  }
  function recordPhaseStep(patch: Partial<MselDraft>) {
    if (tab.key !== 'phases') return
    const touches =
      ('phases' in patch && patch.phases !== draft.phases) ||
      ('injects' in patch && patch.injects !== draft.injects) ||
      ('duration_minutes' in patch && patch.duration_minutes !== draft.duration_minutes)
    if (!touches) return
    const snapshot = phaseSnapshot(draft)
    setPhaseHistory((history) => ({
      original: history.original ?? snapshot,
      steps: [...history.steps, snapshot].slice(-PHASE_HISTORY_LIMIT),
    }))
  }
  function undoPhaseStep() {
    const last = phaseHistory.steps.at(-1)
    if (!last) return
    onDraftChange((current) => current && restoreSnapshot(current, last))
    setPhaseHistory((history) => ({ ...history, steps: history.steps.slice(0, -1) }))
    showToast(t('creator.msel.phaseHistory.undone'))
  }
  function revertPhases() {
    const original = phaseHistory.original
    setConfirmRevert(false)
    if (!original) return
    onDraftChange((current) => current && restoreSnapshot(current, original))
    setPhaseHistory(EMPTY_PHASE_HISTORY)
    showToast(t('creator.msel.phaseHistory.reverted'))
  }
  const [confirmRevert, setConfirmRevert] = useState(false)
  // A kind to renumber once the Planner confirms that the frozen versions
  // keep the old codes.
  const [confirmRenumber, setConfirmRenumber] = useState<MselRenumberKind | null>(null)
  const canRevertPhases =
    phaseHistory.original !== null &&
    !sameMselDraft(restoreSnapshot(draft, phaseHistory.original), draft)

  function apiErrorToast(err: unknown) {
    if (err instanceof ApiError && err.code === 'MSEL_STALE') {
      showToast(t('creator.msel.toast.stale'), {
        variant: 'error',
        action: { label: t('creator.msel.actions.reload'), onAction: onReload },
      })
      return
    }
    showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
      variant: 'error',
    })
  }

  const payload = dirty ? JSON.stringify(payloadFromDraft(draft, msel.revision)) : null
  const rowRemoval = useUndoableRowRemoval<MselDraft>((change) =>
    onDraftChange((current) => current && change(current)),
  )
  const {
    report: liveReport,
    saveState,
    blocked,
  } = useAutosavedDocument<Msel>({
    payload,
    savedReport: msel.validation,
    validateUrl: `/ttx/${ttxId}/msel/validate`,
    saveUrl: `/ttx/${ttxId}/msel`,
    // Held while a removed row can still be brought back.
    enabled: editingAllowed && !rowRemoval.holding,
    blockingCodes: SAVE_BLOCKING_CODES,
    onSaved: (next) => {
      const statusChanged = next.status !== msel.status
      onSaved(next, draft)
      if (statusChanged) void refresh()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'MSEL_STALE') apiErrorToast(err)
    },
  })
  // Warnings fixed by writing injects show in Injects (relocateIssues).
  const report = relocateIssues(liveReport)
  const message = useMselIssueMessage(draft, msel.needs, msel.rooms)
  // Looked up, not t(`...${id}`): fix ids are plain strings from lib/msel.
  const fixTexts = t('creator.msel.fixes', { returnObjects: true }) as Record<string, string>

  function update(patch: Partial<MselDraft>) {
    if (readOnly) return
    if (editingAllowed) {
      recordPhaseStep(patch)
      onDraftChange({ ...draft, ...patch })
    } else setPendingPatch(patch)
  }

  // A fix picked under a warning: applied to the draft at once (autosaved
  // like any edit), with an Undo that puts back the times it changed.
  function applyFix(label: string, apply: (d: MselDraft) => MselDraft) {
    const before = {
      phases: draft.phases,
      injects: draft.injects,
      duration_minutes: draft.duration_minutes,
    }
    const after = apply(draft)
    update({
      phases: after.phases,
      injects: after.injects,
      duration_minutes: after.duration_minutes,
    })
    if (editingAllowed) {
      showToast(t('creator.msel.fixes.applied', { fix: label }), {
        action: { label: t('common.toast.undo'), onAction: () => update(before) },
      })
    }
  }

  const removeRow: TabProps['removeRow'] = (field, key, message) => {
    if (readOnly) return
    type Row = { key: string }
    const rows = (d: MselDraft) => d[field] as Row[]
    const index = rows(draft).findIndex((row) => row.key === key)
    if (index < 0) return
    const row = rows(draft)[index]
    const without = (d: MselDraft) => ({ ...d, [field]: rows(d).filter((r) => r.key !== key) })
    // Past draft the reopen question comes first: it is the confirmation,
    // and the removal applies once it's answered.
    if (!editingAllowed) return update(without(draft))
    recordPhaseStep({ [field]: rows(without(draft)) })
    rowRemoval.remove(message, without, (d) => ({ ...d, [field]: restoreRow(rows(d), row, index) }))
  }

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending || pending.tab !== tab.key) return
    pendingFocusRef.current = null
    document.getElementById(pending.id)?.focus()
  }, [tab.key])

  function withTab(prev: URLSearchParams, key: MselTabKey) {
    const next = new URLSearchParams(prev)
    // Each table's grouping is its own: Phases' "by objective" isn't Injects'.
    if ((prev.get('tab') ?? 'scenario') !== key) next.delete('group')
    if (key === 'scenario') next.delete('tab')
    else next.set('tab', key)
    return next
  }

  function goToTab(key: MselTabKey) {
    setSearchParams((prev) => withTab(prev, key), { replace: true })
  }

  function moveTo(key: MselTabKey) {
    setFocusRow(null)
    goToTab(key)
    window.scrollTo?.({ top: 0 })
  }

  function openRow(key: 'injects' | 'phases', itemId: string) {
    setFocusRow({ field: key === 'injects' ? 'title' : 'name', itemId })
    goToTab(key)
  }

  function goToIssue(target: IssueTarget) {
    // A warning about a phase, a threat actor or a recipient with too few
    // or too many injects: Injects, filtered on it.
    const filter = target.code ? issueInjectFilter({ code: target.code }) : null
    if (filter && target.itemId) {
      setFocusRow(null)
      setSearchParams(
        (prev) => {
          const next = withTab(prev, 'injects')
          INJECT_FILTERS.forEach((key) => next.delete(key))
          next.set(filter, target.itemId as string)
          return next
        },
        { replace: true },
      )
      return
    }
    const destination = MSEL_TABS.find((item) => item.index === target.section) ?? MSEL_TABS[0]
    const rowFields =
      destination.key === 'injects'
        ? INJECT_ROW_FIELDS
        : destination.key === 'phases'
          ? PHASE_ROW_FIELDS
          : []
    if (target.itemId && target.field && rowFields.includes(target.field)) {
      setFocusRow({ field: target.field, itemId: target.itemId })
      goToTab(destination.key)
      return
    }
    // An uncovered objective: its "add mandatory inject" button in Coverage;
    // a threat actor of the scenario: its card's edit button.
    const id =
      destination.key === 'coverage' && target.itemId
        ? mselFieldId('coverage', target.itemId)
        : destination.key === 'threats' &&
            target.itemId &&
            (target.field === 'threat_actor_name' || target.field === 'threat_actors')
          ? mselFieldId('threat_actor', target.itemId)
          : target.field
            ? mselFieldId(target.field)
            : null
    if (destination.key === tab.key) {
      if (id) document.getElementById(id)?.focus()
      return
    }
    pendingFocusRef.current = id ? { tab: destination.key, id } : null
    goToTab(destination.key)
  }

  const isInvalid = (field: string, itemId?: string | null) =>
    [...report.ready, ...report.approved].some(
      (issue) =>
        issue.section === tab.index &&
        issue.field === field &&
        (itemId === undefined || issue.item_id === itemId),
    )

  async function run(action: () => Promise<Msel>, successMessage: string) {
    setBusy(true)
    try {
      const next = await action()
      const statusChanged = next.status !== msel.status
      onServerMsel(next)
      showToast(successMessage)
      if (statusChanged) void refresh()
    } catch (err) {
      apiErrorToast(err)
    } finally {
      setBusy(false)
    }
  }

  const transition = (to: MselStatus) =>
    run(
      () =>
        apiFetch<Msel>(`/ttx/${ttxId}/msel/transitions`, {
          method: 'POST',
          body: JSON.stringify({ to }),
        }),
      t(`creator.msel.toast.${TOAST_BY_TARGET[to]}`),
    )

  const acknowledge = () =>
    run(
      () => apiFetch<Msel>(`/ttx/${ttxId}/msel/acknowledge-needs-version`, { method: 'POST' }),
      t('creator.msel.toast.acknowledged'),
    )

  async function upgradeAttack() {
    setBusy(true)
    try {
      const result = await apiFetch<AttackUpgradeResult>(`/ttx/${ttxId}/msel/attack-upgrade`, {
        method: 'POST',
      })
      const statusChanged = result.msel.status !== msel.status
      onServerMsel(result.msel)
      showToast(
        [
          t('creator.msel.attack.upgraded', { version: result.msel.attack_version }),
          result.replaced.length
            ? t('creator.msel.attack.replaced', {
                count: result.replaced.length,
                list: result.replaced.map((r) => `${r.from_id} → ${r.to_id}`).join(', '),
              })
            : '',
          result.removed.length
            ? t('creator.msel.attack.removed', {
                count: result.removed.length,
                list: result.removed.join(', '),
              })
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      if (statusChanged) void refresh()
    } catch (err) {
      apiErrorToast(err)
    } finally {
      setBusy(false)
    }
  }

  // Codes in order (PH-01 the first phase): the server renumbers what's
  // saved, so it waits for unsaved edits; the Phases tab's history holds
  // the old codes, so it's forgotten.
  const renumbering = useRenumberCodes<MselRenumberKind, MselRenumberResult, Msel>({
    url: `/ttx/${ttxId}/msel/renumber`,
    read: (result) => result.msel,
    onServer: (next) => {
      onServerMsel(next)
      setPhaseHistory(EMPTY_PHASE_HISTORY)
    },
    onError: apiErrorToast,
  })
  const frozenVersions = msel.frozen_versions ?? []
  const renumberButton = (kind: MselRenumberKind) =>
    !readOnly && msel.renumberable.includes(kind) ? (
      <RenumberButton
        label={t(`creator.msel.renumber.${kind}`)}
        hint={t(
          kind === 'injects' ? 'creator.msel.renumber.injectsHint' : 'creator.msel.renumber.hint',
        )}
        blocked={busy || dirty || renumbering.busy}
        onClick={() =>
          frozenVersions.length > 0 ? setConfirmRenumber(kind) : renumbering.renumber(kind)
        }
      />
    ) : null

  const desynced = msel.editable && msel.needs.version !== msel.needs_form_version
  const position = MSEL_TABS.findIndex((item) => item.key === tab.key)
  const previousTab = position > 0 ? MSEL_TABS[position - 1] : null
  const nextTab = position < MSEL_TABS.length - 1 ? MSEL_TABS[position + 1] : null
  const TabComponent = TAB_COMPONENTS[tab.key]
  // The save state, in the panel header and in the inject dialog (which
  // writes into the draft as it goes).
  const saveStatus = (
    <SaveStatus
      state={saveState}
      dirty={dirty}
      blocked={blocked && editingAllowed}
      labels={{
        saving: t('creator.msel.saveState.saving'),
        saved: t('creator.msel.saveState.saved'),
        pending: t('creator.msel.saveState.pending'),
        blocked: t('creator.msel.saveState.blocked'),
        error: t('creator.msel.saveState.error'),
      }}
    />
  )
  const tabProps: TabProps = {
    saveStatus,
    msel,
    draft,
    update,
    removeRow,
    isInvalid,
    report,
    catalog,
    readOnly,
    upgradeAttack: () => void upgradeAttack(),
    attackUpgradeBlocked: busy || dirty,
    renumberButton,
    focusRow,
    openRow,
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('creator.msel.title')} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span translate="no" className="font-mono">
            {msel.exercise_code}
          </span>
          <span aria-hidden="true" className="text-paper-ink/30 dark:text-fg-faint">
            ·
          </span>
          <span className="font-mono">{t('creator.msel.version', { version: msel.version })}</span>
          <span className="inline-flex h-6 items-center rounded-xs border border-paper-line px-2 text-xs font-medium dark:border-line">
            {t(`creator.msel.status.${msel.status}`)}
          </span>
          <TlpBadge tlp={msel.needs.tlp} />
          <div className="ml-auto">
            <MselDownloads
              ttxId={ttxId}
              blockedReason={
                dirty
                  ? t('creator.msel.downloads.waitForSave')
                  : msel.status !== 'ready' && msel.validation.ready.length > 0
                    ? t('creator.msel.downloads.fixFirst')
                    : null
              }
            />
          </div>
        </div>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText id="creator.msel.intro" text={t('creator.msel.intro')} />
        </p>
        {readOnly && (
          <div
            role="status"
            className="rounded-sm border border-paper-line bg-hover/40 p-4 text-sm dark:border-line"
          >
            <p className="font-semibold">{t('creator.msel.readOnly.title')}</p>
            <p className="text-paper-ink/70 dark:text-fg-muted">
              {msel.needs.status === 'ready_for_approval'
                ? t('creator.msel.readOnly.bodyReady', { version: msel.needs.version })
                : t('creator.msel.readOnly.body', { version: msel.needs.version })}
            </p>
            <Link
              to={`/creator/${ttxId}/needs?step=approval`}
              className={`${linkAccent} mt-2 inline-block font-medium`}
            >
              {t('creator.msel.readOnly.action')}
            </Link>
          </div>
        )}
      </div>

      <ProposalsPanel<MselDraft>
        ttxId={ttxId}
        targets={[
          'msel_meta',
          'msel_renumber',
          'msel_phase',
          'msel_actor',
          'msel_threat',
          'inject',
        ]}
        draftRows={{
          msel_meta: [mselMetaRow(msel.id, draft)],
          msel_phase: draft.phases,
          msel_actor: draft.actors,
          msel_threat: draft.threat_actors,
          inject: draft.injects,
        }}
        savedRows={{
          msel_meta: [mselMetaRow(msel.id, baseline)],
          msel_renumber: [renumberRow(msel.id, msel.renumberable)],
          msel_phase: baseline.phases,
          msel_actor: baseline.actors,
          msel_threat: baseline.threat_actors,
          inject: baseline.injects,
        }}
        codeOf={(id) =>
          [
            ...draft.phases,
            ...draft.actors,
            ...draft.threat_actors,
            ...draft.injects,
            ...draft.injects.flatMap((i) => i.expected_actions),
            ...msel.needs.objectives.map((o) => ({ id: o.id, key: o.id, code: o.code })),
          ].find((row) => row.id === id || row.key === id)?.code || undefined
        }
        merge={(group, accepted) => mergeMselProposals(draft, group, accepted)}
        onAction={(proposal) => {
          const kind = proposal.patch.kind as MselRenumberKind
          if (frozenVersions.length > 0) setConfirmRenumber(kind)
          else void renumbering.renumber(kind)
        }}
        actionBlocked={
          dirty || renumbering.busy
            ? t('assistant.saveFirst')
            : msel.status !== 'draft'
              ? t('assistant.draftOnly')
              : null
        }
        issueMessage={message}
        apply={update}
        disabledReason={
          readOnly ? t('assistant.readOnly') : pendingPatch ? t('assistant.confirming') : null
        }
      />

      {/* The storyline map, above every tab: the exercise as it takes shape,
          and a place to edit it. */}
      <StorylineStrip
        msel={msel}
        draft={draft}
        update={update}
        catalog={catalog}
        readOnly={readOnly}
        report={report}
        tab={tab.key}
        filters={injectFiltersFrom(searchParams)}
        injectsHref={`?${withTab(searchParams, 'injects')}`}
        removeRow={removeRow}
        saveStatus={saveStatus}
        phaseHistory={
          tab.key === 'phases' && !readOnly
            ? {
                undoCount: phaseHistory.steps.length,
                canRevert: canRevertPhases,
                onUndo: undoPhaseStep,
                onRevert: () => setConfirmRevert(true),
              }
            : undefined
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="shrink-0 space-y-4 lg:sticky lg:top-[calc(var(--msel-strip-offset,0px)+1rem)] lg:w-60">
          <nav aria-label={t('creator.msel.tabsNavLabel')}>
            <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {MSEL_TABS.map((item) => {
                const count = tabIssues(report, item.index).length
                const toReview = tabWarnings(report, item.index).length
                return (
                  <li key={item.key} className="shrink-0">
                    <Link
                      to={{ search: `${withTab(searchParams, item.key)}` }}
                      replace
                      onClick={() => setFocusRow(null)}
                      aria-current={item.key === tab.key ? 'step' : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg lg:-ml-px lg:border-l-2 ${
                        item.key === tab.key
                          ? 'bg-accent/10 font-medium text-accent-fg lg:border-accent'
                          : 'text-paper-ink/80 hover:bg-hover dark:text-fg-nav lg:border-transparent'
                      }`}
                    >
                      <span>{t(`creator.msel.tabs.${item.key}`)}</span>
                      {/* Red count: what blocks the next step; an amber tick:
                          fine, with warnings worth reviewing; a green tick
                          otherwise. */}
                      {count > 0 ? (
                        <span
                          // The number counts what's left to fix here, not rows:
                          // say so on hover (screen readers get the sr-only text).
                          title={t('creator.msel.tabStatus.issues', { count })}
                          className="rounded-xs bg-danger/10 px-1.5 text-xs tabular-nums text-danger-fg"
                        >
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">
                            {t('creator.msel.tabStatus.issues', { count })}
                          </span>
                        </span>
                      ) : toReview > 0 ? (
                        // Only warnings: the tab is fine -- a tick, in the
                        // warning colour (the box in the tab lists them).
                        <span
                          title={t('creator.msel.tabStatus.toReview', { count: toReview })}
                          className="text-inactive-1"
                        >
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">
                            {t('creator.msel.tabStatus.toReview', { count: toReview })}
                          </span>
                        </span>
                      ) : item.key === 'review' ? (
                        // Review: a green tick once the MSEL is ready.
                        msel.status === 'ready' ? (
                          <span className="text-success-fg">
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">{t('creator.msel.status.ready')}</span>
                          </span>
                        ) : null
                      ) : (
                        <span className="text-success-fg">
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">{t('creator.msel.tabStatus.complete')}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ol>
          </nav>
          <StatusTrack
            id="msel-status-title"
            states={(['draft', 'in_review', 'ready'] as const).map((key) => ({
              key,
              label: t(`creator.msel.status.${key}`),
            }))}
            current={msel.status}
          />
          <IssueSummary
            id="msel-validation-title"
            report={report}
            message={message}
            labels={{
              title: t('creator.msel.summary.title'),
              allClear:
                msel.status === 'ready'
                  ? t('creator.msel.summary.allClearReady')
                  : msel.status === 'in_review'
                    ? t('creator.msel.summary.allClearInReview')
                    : t('creator.msel.summary.allClear'),
              ready: t('creator.msel.summary.toReview'),
              approved: t('creator.msel.summary.toReady'),
              warnings: t('creator.msel.summary.warnings'),
            }}
            onSelect={goToIssue}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <Panel
            title={t(`creator.msel.tabs.${tab.key}`)}
            description={
              <HelpText
                id={`creator.msel.tabDescriptions.${tab.key}`}
                text={t(`creator.msel.tabDescriptions.${tab.key}`)}
              />
            }
            aside={readOnly ? undefined : saveStatus}
            footer={
              <div className="flex gap-2">
                {previousTab && (
                  <button
                    type="button"
                    onClick={() => moveTo(previousTab.key)}
                    className={btnSecondary}
                  >
                    <span aria-hidden="true">← </span>
                    {t('creator.msel.actions.previous')}
                  </button>
                )}
                {nextTab && (
                  <button
                    type="button"
                    onClick={() => moveTo(nextTab.key)}
                    className={btnSecondary}
                  >
                    {t('creator.msel.actions.next')}
                    <span aria-hidden="true"> →</span>
                  </button>
                )}
              </div>
            }
          >
            <SectionIssueList
              idPrefix="msel"
              report={report}
              section={tab.index}
              message={message}
              titles={{
                blocking: (count) => t('creator.msel.sectionIssues.title', { count }),
                review: t('creator.msel.sectionIssues.review'),
              }}
              fixes={(issue) =>
                readOnly
                  ? []
                  : issueFixes(draft, issue).map((fix) => {
                      const label = (fixTexts[fix.id] ?? fix.id).replace(
                        /\{\{(\w+)\}\}/g,
                        (_, key: string) => fix.values[key] ?? '',
                      )
                      return { label, onSelect: () => applyFix(label, fix.apply) }
                    })
              }
              onSelect={goToIssue}
            />
            {TabComponent ? (
              <TabComponent {...tabProps} />
            ) : (
              <div className="space-y-5">
                {/* A re-approved needs analysis is confirmed here, before
                    submitting (its blocking issue is listed above). */}
                {desynced && (
                  <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-inactive-1/60 bg-inactive-1/10 p-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{t('creator.msel.sync.title')}</p>
                      <p className="text-paper-ink/70 dark:text-fg-muted">
                        {t('creator.msel.sync.body', {
                          version: msel.needs.version,
                          previous: msel.needs_form_version,
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => void acknowledge()}
                      className={btnSecondary}
                    >
                      {t('creator.msel.sync.action')}
                    </button>
                  </div>
                )}
                <FieldGroup
                  id="msel-review-status-title"
                  title={t('creator.msel.review.statusTitle')}
                  hint={t('creator.msel.review.statusHint')}
                >
                  <ReviewTab
                    msel={msel}
                    dirty={dirty}
                    busy={busy}
                    readOnly={readOnly}
                    onTransition={(to) => void transition(to)}
                  />
                </FieldGroup>
                <FieldGroup
                  id="msel-load-title"
                  title={t('creator.msel.load.title')}
                  hint={t('creator.msel.load.description')}
                >
                  <LoadTable {...tabProps} />
                </FieldGroup>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {confirmRevert && (
        <Modal titleId="msel-revert-phases-title" onClose={() => setConfirmRevert(false)}>
          <h2
            id="msel-revert-phases-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('creator.msel.phaseHistory.confirmTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.msel.phaseHistory.confirmBody')}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmRevert(false)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button type="button" onClick={revertPhases} className={btnPrimary}>
              {t('creator.msel.phaseHistory.confirmAction')}
            </button>
          </div>
        </Modal>
      )}

      {confirmRenumber && (
        <Modal titleId="msel-renumber-frozen-title" onClose={() => setConfirmRenumber(null)}>
          <h2
            id="msel-renumber-frozen-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t(`creator.msel.renumber.frozen.title.${confirmRenumber}`)}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.msel.renumber.frozen.intro', { count: frozenVersions.length })}
          </p>
          <ul className="space-y-1 text-sm">
            {frozenVersions.map((frozen) => (
              <li key={frozen.version}>
                {t('creator.msel.renumber.frozen.version', {
                  version: frozen.version,
                  date: new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(frozen.ready_at)),
                  name: frozen.ready_by || t('creator.msel.validatedByUnknown'),
                })}
                {frozen.sessions > 0 &&
                  ` · ${t('creator.msel.renumber.frozen.sessions', { count: frozen.sessions })}`}
              </li>
            ))}
          </ul>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.msel.renumber.frozen.loss')}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmRenumber(null)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                renumbering.renumber(confirmRenumber, { confirm_frozen: true })
                setConfirmRenumber(null)
              }}
              className={btnPrimary}
            >
              {t('creator.msel.renumber.frozen.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {pendingPatch && (
        <Modal titleId="msel-withdraw-title" onClose={() => setPendingPatch(null)}>
          <h2
            id="msel-withdraw-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('creator.msel.dialogs.withdrawTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {msel.status === 'ready'
              ? t('creator.msel.dialogs.withdrawReady', {
                  version: msel.version,
                  next: msel.version + 1,
                })
              : t('creator.msel.dialogs.withdrawReview')}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPendingPatch(null)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditConfirmedFor(statusKey)
                recordPhaseStep(pendingPatch)
                onDraftChange({ ...draft, ...pendingPatch })
                setPendingPatch(null)
              }}
              className={btnPrimary}
            >
              {t('creator.msel.dialogs.withdrawConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** The review tab: where the MSEL is in its lifecycle and the transitions
 * available from there. Acts on the saved MSEL, so it waits for autosave. */
function ReviewTab({
  msel,
  dirty,
  busy,
  readOnly,
  onTransition,
}: {
  msel: Msel
  dirty: boolean
  busy: boolean
  readOnly: boolean
  onTransition: (to: MselStatus) => void
}) {
  const { t, i18n } = useTranslation()
  const disabled = busy || dirty || readOnly
  const { ready: blocking, approved: unvalidated } = msel.validation
  const reason = readOnly
    ? t('creator.msel.review.readOnly')
    : dirty
      ? t('creator.msel.review.waitForSave')
      : null
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <span className="font-medium">{t('creator.msel.review.status')}: </span>
        {t(`creator.msel.status.${msel.status}`)} ·{' '}
        {t('creator.msel.version', { version: msel.version })}
      </p>
      {reason && <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{reason}</p>}
      <div className="flex flex-wrap gap-2">
        {msel.status === 'draft' && (
          <button
            type="button"
            disabled={disabled || blocking.length > 0}
            onClick={() => onTransition('in_review')}
            className={btnPrimary}
          >
            {t('creator.msel.actions.submit')}
          </button>
        )}
        {msel.status === 'in_review' && (
          <button
            type="button"
            disabled={disabled || blocking.length > 0 || unvalidated.length > 0}
            onClick={() => onTransition('ready')}
            className={btnPrimary}
          >
            {t('creator.msel.actions.markReady')}
          </button>
        )}
        {msel.status !== 'draft' && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTransition('draft')}
            className={btnSecondary}
          >
            {t('creator.msel.actions.backToDraft')}
          </button>
        )}
      </div>
      <ReviewStepNote
        msel={msel}
        // Another reason already explains a disabled button.
        quiet={reason !== null}
        language={i18n.language}
      />
    </div>
  )
}

/** Under the review buttons: what still blocks the next step (the button
 * is disabled), or that nothing does; once READY, who marked it so. */
function ReviewStepNote({
  msel,
  quiet,
  language,
}: {
  msel: Msel
  quiet: boolean
  language: string
}) {
  const { t } = useTranslation()
  const { ready: blocking, approved: unvalidated } = msel.validation
  const muted = 'text-xs text-paper-ink/60 dark:text-fg-faint'
  const ok = (text: string) => (
    <p className="text-xs text-success-fg" role="status">
      <span aria-hidden="true">✓ </span>
      {text}
    </p>
  )

  if (msel.status === 'ready') {
    if (!msel.ready_at) return null
    return (
      <p className={muted}>
        {t('creator.msel.review.readyBy', {
          name: msel.ready_by || t('creator.msel.validatedByUnknown'),
          date: new Intl.DateTimeFormat(language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(msel.ready_at)),
        })}
      </p>
    )
  }
  if (msel.status === 'draft') {
    if (blocking.length > 0) return <p className={muted}>{t('creator.msel.review.submitHint')}</p>
    if (quiet) return null
    return ok(
      unvalidated.length > 0
        ? t('creator.msel.review.submitOkPending')
        : t('creator.msel.review.submitOk'),
    )
  }
  if (blocking.length > 0 || unvalidated.length > 0) {
    return <p className={muted}>{t('creator.msel.review.readyHint')}</p>
  }
  return quiet ? null : ok(t('creator.msel.review.readyOk'))
}
