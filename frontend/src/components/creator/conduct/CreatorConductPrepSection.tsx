import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useApiResource } from '../../../hooks/useApiResource'
import { useAutosavedDocument } from '../../../hooks/useAutosavedDocument'
import { useConductPrepIssueMessage } from '../../../hooks/useConductPrepIssueMessage'
import { useToast } from '../../../hooks/useToast'
import { useUndoableRowRemoval } from '../../../hooks/useUndoableRowRemoval'
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning'
import { ApiError, apiFetch } from '../../../lib/api'
import { mergeConductPrepProposals } from '../../../lib/proposals'
import { btnPrimary, btnSecondary, linkAccent } from '../../../lib/buttonStyles'
import {
  adoptSavedIds,
  keepPointKeys,
  CONDUCT_STEPS,
  conductFieldId,
  conductStep,
  draftFromPrep,
  payloadFromDraft,
  samePrepDraft,
  stepIssues,
  stepWarnings,
  type ConductPrepDraft,
  type ConductStepKey,
} from '../../../lib/conductPrep'
import type { ConductPrep, ConductPrepStatus, ValidationIssue } from '../../../lib/types'
import { HelpText } from '../../common/HelpText'
import {
  IssueSummary,
  SectionIssueList,
  type IssueFix,
  type IssueTarget,
} from '../../common/IssueSummary'
import { StatusTrack } from '../../common/StatusTrack'
import { Modal } from '../../common/Modal'
import { Panel } from '../../common/Panel'
import { SaveStatus } from '../../common/SaveStatus'
import { SectionHeader } from '../../common/SectionHeader'
import { TlpBadge } from '../../common/TlpBadge'
import { ProposalsPanel } from '../../assistant/ProposalsPanel'
import { ConductPrepDownloads } from './ConductPrepDownloads'
import { DocumentsStep } from './DocumentsStep'
import { EvaluationGuide } from './EvaluationGuide'
import { EvaluationStep } from './EvaluationStep'
import { ReviewStep } from './ReviewStep'
import { SessionStep } from './SessionStep'
import type { StepProps } from './stepProps'
import { ValidationStep } from './ValidationStep'

/** Issues (from the live report) that make the backend reject a save. */
const SAVE_BLOCKING_CODES = new Set<string>()

const STEP_COMPONENTS: Record<
  Exclude<ConductStepKey, 'review'>,
  (props: StepProps) => React.ReactNode
> = {
  evaluation: EvaluationStep,
  validation: ValidationStep,
  session: SessionStep,
  documents: DocumentsStep,
}

/** Focuses the first of `ids` on the page, opening the optional group
 * folded around it first. */
function focusField(ids: string[]) {
  const element = ids.map((id) => document.getElementById(id)).find(Boolean)
  const group = element?.closest('details')
  if (group && !group.open) group.open = true
  element?.focus()
}

/** Creator -> Session plan: how the exercise is measured (the evaluation
 * plan) and how its session is secured (design validation, the session,
 * documents and follow-up), one step at a time (`?step=`). Only a small
 * core is required to be ready; every other group is optional and folds
 * while empty. Same model as the
 * MSEL: one page-level draft that saves itself, and the backend's
 * validation report -- of the saved plan or a dry run of the draft --
 * driving the summary and the step states. Read-only while the needs
 * analysis is being revised. */
export function CreatorConductPrepSection() {
  const { ttxId } = useParams<{ ttxId: string }>()
  const { data, error, refetch } = useApiResource<ConductPrep>(`/ttx/${ttxId}/conduct-prep`)
  const { t } = useTranslation()

  const [prep, setPrep] = useState<ConductPrep | null>(null)
  const [baseline, setBaseline] = useState<ConductPrepDraft | null>(null)
  const [draft, setDraft] = useState<ConductPrepDraft | null>(null)
  const [loaded, setLoaded] = useState<ConductPrep | null>(null)
  if (data && data !== loaded) {
    setLoaded(data)
    setPrep(data)
    setBaseline(draftFromPrep(data))
    setDraft(draftFromPrep(data))
  }

  if (error && !prep) {
    if (error instanceof ApiError && error.code === 'NEEDS_FORM_NOT_APPROVED') {
      return (
        <Panel title={t('creator.needs.gate.title')} className="max-w-2xl">
          <div className="space-y-4">
            <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
              {t('creator.conductPrep.gate.body')}
            </p>
            <Link to={`/creator/${ttxId}/needs?step=approval`} className={btnPrimary}>
              {t('creator.conductPrep.gate.action')}
            </Link>
          </div>
        </Panel>
      )
    }
    return (
      <div className="space-y-4">
        <SectionHeader title={t('creator.conductPrep.title')} />
        <p role="alert" className="text-sm text-danger-fg">
          {t('creator.conductPrep.loadError')}{' '}
          <button type="button" onClick={refetch} className="underline">
            {t('creator.conductPrep.retry')}
          </button>
        </p>
      </div>
    )
  }
  if (!prep || !draft || !baseline || !ttxId) return null

  return (
    <ConductPrepEditor
      ttxId={ttxId}
      prep={prep}
      draft={draft}
      baseline={baseline}
      onDraftChange={setDraft}
      onServerPrep={(next) => {
        setPrep(next)
        setBaseline(draftFromPrep(next))
        setDraft(draftFromPrep(next))
      }}
      onSaved={(next, sent) => {
        const saved = keepPointKeys(draftFromPrep(next), sent)
        setPrep(next)
        setBaseline(saved)
        // Edits made while the save was in flight stay; rows created
        // before it adopt the ids the server gave them.
        setDraft((current) =>
          current === null || samePrepDraft(current, sent)
            ? saved
            : adoptSavedIds(current, sent, saved),
        )
      }}
      onReload={refetch}
    />
  )
}

function ConductPrepEditor({
  ttxId,
  prep,
  draft,
  baseline,
  onDraftChange,
  onServerPrep,
  onSaved,
  onReload,
}: {
  ttxId: string
  prep: ConductPrep
  draft: ConductPrepDraft
  baseline: ConductPrepDraft
  onDraftChange: Dispatch<SetStateAction<ConductPrepDraft | null>>
  onServerPrep: (prep: ConductPrep) => void
  onSaved: (prep: ConductPrep, sent: ConductPrepDraft) => void
  onReload: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  // Issues shown here but fixed elsewhere -- the MSEL, the needs analysis,
  // the exercise team -- say where, and take you there.
  const elsewhere = t('creator.conductPrep.fixElsewhere', { returnObjects: true }) as Record<
    string,
    string
  >
  const fixesElsewhere = (issue: ValidationIssue): IssueFix[] => {
    const to: Record<string, [string, string]> = {
      MSEL_NOT_READY: [elsewhere.msel, `/creator/${ttxId}/msel?tab=review`],
      INJECTS_NOT_VALIDATED: [elsewhere.injects, `/creator/${ttxId}/msel?tab=injects`],
      SESSION_OUTSIDE_WINDOW: [elsewhere.window, `/creator/${ttxId}/needs?step=constraints`],
      STOP_KEYWORD_MISSING: [elsewhere.stopKeyword, `/creator/${ttxId}/needs?step=risks`],
      LEAD_EVALUATOR_MISSING: [elsewhere.leadEvaluator, `/creator/${ttxId}/exercise?edit=1`],
    }
    const target = to[issue.code]
    return target ? [{ label: target[0], onSelect: () => navigate(target[1]) }] : []
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const readOnly = !prep.editable
  // Editing a ready plan sends it back to draft: the first edit asks, and
  // the answer holds for this version.
  const [pendingPatch, setPendingPatch] = useState<Partial<ConductPrepDraft> | null>(null)
  const [editConfirmedFor, setEditConfirmedFor] = useState<string | null>(null)
  const statusKey = `${prep.version}:${prep.status}`
  const editingAllowed = !readOnly && (prep.status === 'draft' || editConfirmedFor === statusKey)
  const pendingFocusRef = useRef<{ step: string; ids: string[] } | null>(null)

  const step = conductStep(searchParams.get('step'))
  const dirty = !samePrepDraft(draft, baseline)
  useUnsavedChangesWarning(dirty)

  function apiErrorToast(err: unknown) {
    if (err instanceof ApiError && err.code === 'CONDUCT_PREP_STALE') {
      showToast(t('creator.conductPrep.toast.stale'), {
        variant: 'error',
        action: { label: t('creator.conductPrep.actions.reload'), onAction: onReload },
      })
      return
    }
    showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
      variant: 'error',
    })
  }

  const payload = dirty ? JSON.stringify(payloadFromDraft(draft, prep.revision)) : null
  const rowRemoval = useUndoableRowRemoval<ConductPrepDraft>((change) =>
    onDraftChange((current) => current && change(current)),
  )
  const { report, saveState, blocked } = useAutosavedDocument<ConductPrep>({
    payload,
    savedReport: prep.validation,
    validateUrl: `/ttx/${ttxId}/conduct-prep/validate`,
    saveUrl: `/ttx/${ttxId}/conduct-prep`,
    enabled: editingAllowed && !rowRemoval.holding,
    blockingCodes: SAVE_BLOCKING_CODES,
    onSaved: (next) => onSaved(next, draft),
    onError: (err) => apiErrorToast(err),
  })
  const message = useConductPrepIssueMessage(prep, draft)

  function update(patch: Partial<ConductPrepDraft>) {
    if (readOnly) return
    if (editingAllowed) onDraftChange({ ...draft, ...patch })
    else setPendingPatch(patch)
  }

  const removeRow: StepProps['removeRow'] = (text, without, restore) => {
    if (readOnly) return
    if (!editingAllowed) return update(without(draft))
    rowRemoval.remove(text, without, restore)
  }

  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending || pending.step !== step.key) return
    pendingFocusRef.current = null
    focusField(pending.ids)
  }, [step.key])

  function withStep(prev: URLSearchParams, key: ConductStepKey) {
    const next = new URLSearchParams(prev)
    if (key === 'evaluation') next.delete('step')
    else next.set('step', key)
    return next
  }

  function goToStep(key: ConductStepKey) {
    setSearchParams((prev) => withStep(prev, key), { replace: true })
  }

  function moveTo(key: ConductStepKey) {
    goToStep(key)
    window.scrollTo?.({ top: 0 })
  }

  function goToIssue(target: IssueTarget) {
    const destination =
      CONDUCT_STEPS.find((item) => item.index === target.section) ?? CONDUCT_STEPS[0]
    const ids = target.field
      ? [conductFieldId(target.field, target.itemId), conductFieldId(target.field)]
      : []
    if (destination.key === step.key) {
      focusField(ids)
      return
    }
    pendingFocusRef.current = { step: destination.key, ids }
    goToStep(destination.key)
  }

  const isInvalid = (field: string, itemId?: string | null) =>
    report.ready.some(
      (issue) =>
        issue.section === step.index &&
        issue.field === field &&
        (itemId === undefined || issue.item_id === itemId),
    )

  async function run(action: () => Promise<ConductPrep>, successMessage: string) {
    setBusy(true)
    try {
      onServerPrep(await action())
      showToast(successMessage)
    } catch (err) {
      apiErrorToast(err)
    } finally {
      setBusy(false)
    }
  }

  const transition = (to: ConductPrepStatus) =>
    run(
      () =>
        apiFetch<ConductPrep>(`/ttx/${ttxId}/conduct-prep/transitions`, {
          method: 'POST',
          body: JSON.stringify({ to }),
        }),
      to === 'ready'
        ? t('creator.conductPrep.toast.ready')
        : t('creator.conductPrep.toast.backToDraft'),
    )

  const reseed = () =>
    run(
      () => apiFetch<ConductPrep>(`/ttx/${ttxId}/conduct-prep/eeg/reseed`, { method: 'POST' }),
      t('creator.conductPrep.toast.reseeded'),
    )

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
  const downloadsBlocked = dirty
    ? t('creator.conductPrep.documents.waitForSave')
    : prep.context.msel_status === null
      ? t('creator.conductPrep.documents.mselFirst')
      : null
  const stepProps: StepProps = {
    prep,
    draft,
    update,
    removeRow,
    isInvalid,
    report,
    readOnly,
    ttxId,
    downloadsBlocked,
  }
  const position = CONDUCT_STEPS.findIndex((item) => item.key === step.key)
  const previousStep = position > 0 ? CONDUCT_STEPS[position - 1] : null
  const nextStep = position < CONDUCT_STEPS.length - 1 ? CONDUCT_STEPS[position + 1] : null
  const StepComponent = step.key === 'review' ? null : STEP_COMPONENTS[step.key]
  const drifted = prep.drift.needs_changed || prep.drift.msel_changed

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('creator.conductPrep.title')} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span translate="no" className="font-mono">
            {prep.exercise_code}
          </span>
          <span aria-hidden="true" className="text-paper-ink/30 dark:text-fg-faint">
            ·
          </span>
          <span className="font-mono">{t('creator.msel.version', { version: prep.version })}</span>
          <span className="inline-flex h-6 items-center rounded-xs border border-paper-line px-2 text-xs font-medium dark:border-line">
            {t(`creator.conductPrep.status.${prep.status}`)}
          </span>
          <TlpBadge tlp={prep.context.tlp} />
          <div className="ml-auto">
            <ConductPrepDownloads ttxId={ttxId} blockedReason={downloadsBlocked} />
          </div>
        </div>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText id="creator.conductPrep.intro" text={t('creator.conductPrep.intro')} />
        </p>
        {readOnly && (
          <div
            role="status"
            className="rounded-sm border border-paper-line bg-hover/40 p-4 text-sm dark:border-line"
          >
            <p className="font-semibold">{t('creator.conductPrep.readOnly.title')}</p>
            <p className="text-paper-ink/70 dark:text-fg-muted">
              {t('creator.conductPrep.readOnly.body', {
                version: prep.context.needs_form_version,
              })}
            </p>
            <Link
              to={`/creator/${ttxId}/needs?step=approval`}
              className={`${linkAccent} mt-2 inline-block font-medium`}
            >
              {t('creator.msel.readOnly.action')}
            </Link>
          </div>
        )}
        {drifted && !readOnly && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-inactive-1/60 bg-inactive-1/10 p-4 text-sm"
          >
            <div>
              <p className="font-semibold">{t('creator.conductPrep.drift.title')}</p>
              <p className="text-paper-ink/70 dark:text-fg-muted">
                {prep.drift.needs_changed && prep.drift.msel_changed
                  ? t('creator.conductPrep.drift.both')
                  : prep.drift.needs_changed
                    ? t('creator.conductPrep.drift.needs', {
                        version: prep.context.needs_form_version,
                      })
                    : t('creator.conductPrep.drift.msel', {
                        version: prep.context.msel_ready_version ?? '',
                      })}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || dirty}
              onClick={() => void reseed()}
              className={btnSecondary}
            >
              {t('creator.conductPrep.drift.action')}
            </button>
          </div>
        )}
      </div>

      <ProposalsPanel<ConductPrepDraft>
        ttxId={ttxId}
        targets={['eeg_point']}
        draftRows={{ eeg_point: pointRows(draft) }}
        savedRows={{ eeg_point: pointRows(baseline) }}
        codeOf={(id) => {
          const eeg = prep.eeg.find((o) => o.id === id)
          if (eeg) return eeg.code
          const owner = prep.eeg.find((o) => o.points.some((p) => p.id === id))
          return owner?.code
        }}
        merge={(group) => mergeConductPrepProposals(draft, group)}
        issueMessage={message}
        apply={update}
        disabledReason={
          readOnly ? t('assistant.readOnly') : pendingPatch ? t('assistant.confirming') : null
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-60">
          <nav aria-label={t('creator.conductPrep.stepsNavLabel')}>
            <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {CONDUCT_STEPS.map((item) => {
                const count = stepIssues(report, item.index).length
                const toReview = stepWarnings(report, item.index).length
                return (
                  <li key={item.key} className="shrink-0">
                    <Link
                      to={{ search: `${withStep(searchParams, item.key)}` }}
                      replace
                      aria-current={item.key === step.key ? 'step' : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg lg:-ml-px lg:border-l-2 ${
                        item.key === step.key
                          ? 'bg-accent/10 font-medium text-accent-fg lg:border-accent'
                          : 'text-paper-ink/80 hover:bg-hover dark:text-fg-nav lg:border-transparent'
                      }`}
                    >
                      <span>{t(`creator.conductPrep.steps.${item.key}`)}</span>
                      {count > 0 ? (
                        <span
                          title={t('creator.msel.tabStatus.issues', { count })}
                          className="rounded-xs bg-danger/10 px-1.5 text-xs tabular-nums text-danger-fg"
                        >
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">
                            {t('creator.msel.tabStatus.issues', { count })}
                          </span>
                        </span>
                      ) : toReview > 0 ? (
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
                        prep.status === 'ready' ? (
                          <span className="text-success-fg">
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">{t('creator.conductPrep.status.ready')}</span>
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
            id="conduct-prep-status-title"
            states={(['draft', 'ready'] as const).map((key) => ({
              key,
              label: t(`creator.conductPrep.status.${key}`),
            }))}
            current={prep.status}
          />
          <IssueSummary
            id="conduct-prep-validation-title"
            report={report}
            message={message}
            labels={{
              title: t('creator.msel.summary.title'),
              allClear:
                prep.status === 'ready'
                  ? t('creator.conductPrep.summary.allClearReady')
                  : t('creator.conductPrep.summary.allClear'),
              ready: t('creator.conductPrep.summary.toReady'),
              approved: t('creator.conductPrep.summary.toReady'),
              warnings: t('creator.msel.summary.warnings'),
            }}
            onSelect={goToIssue}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <Panel
            title={t(`creator.conductPrep.steps.${step.key}`)}
            description={
              <HelpText
                id={`creator.conductPrep.stepDescriptions.${step.key}`}
                text={t(`creator.conductPrep.stepDescriptions.${step.key}`)}
                extra={step.key === 'evaluation' ? <EvaluationGuide /> : undefined}
              />
            }
            aside={readOnly ? undefined : saveStatus}
            footer={
              <div className="flex gap-2">
                {previousStep && (
                  <button
                    type="button"
                    onClick={() => moveTo(previousStep.key)}
                    className={btnSecondary}
                  >
                    <span aria-hidden="true">← </span>
                    {t('creator.msel.actions.previous')}
                  </button>
                )}
                {nextStep && (
                  <button
                    type="button"
                    onClick={() => moveTo(nextStep.key)}
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
              idPrefix="conduct-prep"
              report={report}
              section={step.index}
              message={message}
              titles={{
                blocking: (count) => t('creator.msel.sectionIssues.title', { count }),
                review: t('creator.msel.sectionIssues.review'),
              }}
              fixes={fixesElsewhere}
              onSelect={goToIssue}
            />
            {StepComponent ? (
              <StepComponent {...stepProps} />
            ) : (
              <ReviewStep
                prep={prep}
                dirty={dirty}
                busy={busy}
                readOnly={readOnly}
                onTransition={(to) => void transition(to)}
              />
            )}
          </Panel>
        </div>
      </div>

      {pendingPatch && (
        <Modal titleId="conduct-prep-withdraw-title" onClose={() => setPendingPatch(null)}>
          <h2
            id="conduct-prep-withdraw-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('creator.conductPrep.dialogs.withdrawTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.conductPrep.dialogs.withdrawBody', {
              version: prep.version,
              next: prep.version + 1,
            })}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPendingPatch(null)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditConfirmedFor(statusKey)
                onDraftChange({ ...draft, ...pendingPatch })
                setPendingPatch(null)
              }}
              className={btnPrimary}
            >
              {t('creator.conductPrep.dialogs.withdrawConfirm', { next: prep.version + 1 })}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** The plan's points as the proposals panel names them: by key, which a
 * saved point doesn't carry until the page gives it one (its id). */
function pointRows(draft: ConductPrepDraft) {
  return draft.eeg.flatMap((o) => o.points.map((p) => ({ ...p, key: p.key ?? (p.id as string) })))
}
