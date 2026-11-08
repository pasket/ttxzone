import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../../hooks/useAuth'
import { useAutosavedDocument } from '../../../hooks/useAutosavedDocument'
import { useNeedsIssueMessage } from '../../../hooks/useNeedsIssueMessage'
import { mergeNeedsProposals, scopeRow, tlpRow } from '../../../lib/proposals'
import { ProposalsPanel } from '../../assistant/ProposalsPanel'
import { useApiDownload } from '../../../hooks/useApiDownload'
import { useRenumberCodes } from '../../../hooks/useRenumberCodes'
import { useToast } from '../../../hooks/useToast'
import { useUndoableAction } from '../../../hooks/useUndoableAction'
import { useUndoableRowRemoval, restoreRow } from '../../../hooks/useUndoableRowRemoval'
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning'
import { API_BASE, apiFetch, ApiError } from '../../../lib/api'
import { btnPrimary, btnSecondary, linkAccent } from '../../../lib/buttonStyles'
import {
  adoptSavedIds,
  draftFromForm,
  fieldDomId,
  NEEDS_STEPS,
  OUTPUT_STEPS,
  payloadFromDraft,
  reconcileSaved,
  sameDraft,
  sectionIssues,
  type NeedsFormDraft,
  type NeedsStepKey,
  type OutputStepKey,
} from '../../../lib/needsForm'
import type {
  ApprovalRead,
  EvidenceRead,
  NeedsForm,
  NeedsFormRenumberResult,
  NeedsFormStatus,
  NeedsRenumberKind,
  RegulatoryCatalog,
  ValidationIssue,
  ValidationReport,
} from '../../../lib/types'
import { RetestsPanel } from '../../aar/RetestsPanel'
import { Modal } from '../../common/Modal'
import { Panel } from '../../common/Panel'
import { RenumberButton } from '../../common/RenumberButton'
import { SaveStatus } from '../../common/SaveStatus'
import { SectionHeader } from '../../common/SectionHeader'
import { TlpBadge } from '../../common/TlpBadge'
import { ApprovalStep, type ApprovalInput } from './ApprovalStep'
import { NeedsStep } from './NeedsStep'
import { EegStep, TraceabilityStep } from './OutputSteps'
import { ObjectivesStep } from './ObjectivesStep'
import { RisksStep } from './RisksStep'
import { SectionIssues } from './SectionIssues'
import {
  CapabilitiesStep,
  ConstraintsStep,
  DocumentStep,
  ScopeStep,
  SponsorshipStep,
  TriggersStep,
} from './SimpleSteps'
import type { StepProps } from './stepProps'
import { ValidationSummary, type IssueTarget } from './ValidationSummary'
import type { IssueFix } from '../../common/IssueSummary'
import { StatusTrack } from '../../common/StatusTrack'
import { HelpText } from '../../common/HelpText'

const STEP_COMPONENTS: Partial<Record<NeedsStepKey, (props: StepProps) => React.ReactNode>> = {
  document: DocumentStep,
  sponsorship: SponsorshipStep,
  triggers: TriggersStep,
  needs: NeedsStep,
  capabilities: CapabilitiesStep,
  objectives: ObjectivesStep,
  scope: ScopeStep,
  constraints: ConstraintsStep,
  risks: RisksStep,
}

/** Fields edited inside a row dialog: the summary opens the row rather
 * than focusing a field on the page. */
const ROW_FIELDS: Record<number, string[]> = {
  3: ['title', 'finding'],
  5: ['title', 'statement', 'success_criterion', 'evidence', 'linked_need_keys', 'capability'],
  8: ['risks'],
}

/** Issues (from the live report) that make the backend reject a save. */
const SAVE_BLOCKING_CODES = new Set([
  'NEEDS_FORM_LIMIT',
  'OBJECTIVE_WITHOUT_NEED',
  'OBJECTIVE_CAPABILITY_NOT_SELECTED',
  'OBJECTIVE_IN_USE',
])

const TOAST_BY_TARGET: Record<NeedsFormStatus, 'submitted' | 'approved' | 'backToDraft'> = {
  ready_for_approval: 'submitted',
  approved: 'approved',
  draft: 'backToDraft',
}

/** Creator -> Needs: the exercise's needs & objectives form, one section
 * at a time (`?step=`). Edits go into one page-level draft that saves
 * itself (autosave) a moment after the user stops editing. The backend
 * owns the rules: its validation report -- of the saved form, or a dry run
 * of the unsaved draft -- drives the summary and the section states. */
export function CreatorNeedsFormSection() {
  const { ttxId } = useParams<{ ttxId: string }>()
  const { data, error, refetch } = useApiResource<NeedsForm>(`/ttx/${ttxId}/needs-form`)
  const catalog = useApiResource<RegulatoryCatalog>('/regulatory-requirements').data
  const { t } = useTranslation()

  // `baseline` is the draft that matches the saved form, `draft` what the
  // user sees; they differ while there are unsaved edits. A load, a
  // refetch (Reload after a conflict) or a transition resets both.
  const [form, setForm] = useState<NeedsForm | null>(null)
  const [baseline, setBaseline] = useState<NeedsFormDraft | null>(null)
  const [draft, setDraft] = useState<NeedsFormDraft | null>(null)
  const [loaded, setLoaded] = useState<NeedsForm | null>(null)
  if (data && data !== loaded) {
    setLoaded(data)
    setForm(data)
    setBaseline(draftFromForm(data))
    setDraft(draftFromForm(data))
  }

  if (error && !form) {
    return (
      <div className="space-y-4">
        <SectionHeader title={t('creator.needs.title')} />
        <p role="alert" className="text-sm text-danger-fg">
          {t('creator.needs.loadError')}{' '}
          <button type="button" onClick={refetch} className="underline">
            {t('creator.needs.retry')}
          </button>
        </p>
      </div>
    )
  }
  if (!form || !draft || !baseline || !ttxId) return null

  return (
    <NeedsFormEditor
      ttxId={ttxId}
      form={form}
      draft={draft}
      baseline={baseline}
      catalog={catalog}
      onDraftChange={setDraft}
      onFormMeta={setForm}
      onServerForm={(next) => {
        setForm(next)
        setBaseline(draftFromForm(next))
        setDraft(draftFromForm(next))
      }}
      onSaved={(next, sent) => {
        const saved = reconcileSaved(sent, next)
        setForm(next)
        setBaseline(saved)
        // Edits made while the save was in flight stay; rows created
        // before it just adopt the ids the server gave them.
        setDraft((current) =>
          current === null || sameDraft(current, sent) ? saved : adoptSavedIds(current, saved),
        )
      }}
      onReload={refetch}
    />
  )
}

function without(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids)
  next.delete(id)
  return next
}

function NeedsFormEditor({
  ttxId,
  form,
  draft,
  baseline,
  catalog,
  onDraftChange,
  onFormMeta,
  onServerForm,
  onSaved,
  onReload,
}: {
  ttxId: string
  form: NeedsForm
  draft: NeedsFormDraft
  baseline: NeedsFormDraft
  catalog: RegulatoryCatalog | null
  onDraftChange: Dispatch<SetStateAction<NeedsFormDraft | null>>
  /** Approvals/evidence changed, not the content: keep the draft. */
  onFormMeta: (form: NeedsForm) => void
  onServerForm: (form: NeedsForm) => void
  onSaved: (form: NeedsForm, sent: NeedsFormDraft) => void
  onReload: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const download = useApiDownload()
  const { refresh, ttxList } = useAuth()
  // Archived: read-only (the server refuses every change).
  const archived = !!ttxList.find((ttx) => ttx.id === ttxId)?.archived_at
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const runUndoable = useUndoableAction()
  // Approvals and evidence files removed but still inside their Undo window.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const shownForm: NeedsForm =
    hidden.size === 0
      ? form
      : {
          ...form,
          approvals: form.approvals
            .filter((approval) => !hidden.has(approval.id))
            .map((approval) => ({
              ...approval,
              evidence: approval.evidence.filter((file) => !hidden.has(file.id)),
            })),
        }
  // Editing a form past DRAFT withdraws its approval: the first edit asks,
  // and the answer holds for this status and version.
  const [pendingPatch, setPendingPatch] = useState<Partial<NeedsFormDraft> | null>(null)
  const [editConfirmedFor, setEditConfirmedFor] = useState<string | null>(null)
  const statusKey = `${form.version}:${form.status}`
  const editingAllowed = !archived && (form.status === 'draft' || editConfirmedFor === statusKey)
  const [focusRow, setFocusRow] = useState<StepProps['focusRow']>(null)
  const [newObjective, setNewObjective] = useState<StepProps['newObjective']>(null)
  // A field to focus once `step` has rendered. It names its step because
  // the effect can also run for the step being left: a click landing
  // between the first paint and the first effects (a slow machine) would
  // otherwise be consumed by the mount run, before its field exists.
  const pendingFocusRef = useRef<{ step: string; id: string } | null>(null)

  const requested = searchParams.get('step')
  const stepKey: NeedsStepKey | OutputStepKey =
    NEEDS_STEPS.find((s) => s.key === requested)?.key ??
    OUTPUT_STEPS.find((key) => key === requested) ??
    'document'
  const sectionIndex = NEEDS_STEPS.find((s) => s.key === stepKey)?.index ?? null
  const isOutput = sectionIndex === null
  const dirty = !sameDraft(draft, baseline)
  useUnsavedChangesWarning(dirty)

  // Live validation and autosave (see useAutosavedDocument). The status
  // is also on the exercise (ContextBar, identity band, gated sections),
  // so a save that changes it refreshes the auth snapshot carrying it.
  const payload = dirty ? JSON.stringify(payloadFromDraft(draft, form.revision)) : null
  const rowRemoval = useUndoableRowRemoval<NeedsFormDraft>((change) =>
    onDraftChange((current) => current && change(current)),
  )
  const {
    report: rawReport,
    saveState,
    blocked,
  } = useAutosavedDocument<NeedsForm>({
    payload,
    savedReport: form.validation,
    validateUrl: `/ttx/${ttxId}/needs-form/validate`,
    saveUrl: `/ttx/${ttxId}/needs-form`,
    // Held while a removed row can still be brought back.
    enabled: editingAllowed && !rowRemoval.holding,
    blockingCodes: SAVE_BLOCKING_CODES,
    onSaved: (next) => {
      const statusChanged = next.status !== form.status
      onSaved(next, draft)
      if (statusChanged) void refresh()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'NEEDS_FORM_STALE') apiErrorToast(err)
    },
  })

  // The saved report names rows by their database id, but rows keep the
  // key they were created with on this page (reconcileSaved): speak the
  // page's keys, so messages, highlights and "go to" find their row.
  const report = withRowKeys(rawReport, draft)
  const spanish = i18n.language.startsWith('es')
  const issueRows = {
    ...draft,
    frameworkLabels: Object.fromEntries(
      (catalog?.frameworks ?? []).map((f) => [f.id, spanish ? f.label_es : f.label_en]),
    ),
  }
  const needsIssueMessage = useNeedsIssueMessage(issueRows)

  function update(patch: Partial<NeedsFormDraft>) {
    if (editingAllowed) onDraftChange({ ...draft, ...patch })
    else if (!archived) setPendingPatch(patch)
  }

  const removeRow: StepProps['removeRow'] = (field, key, message) => {
    type Row = { key: string }
    const rows = (d: NeedsFormDraft) => d[field] as Row[]
    const index = rows(draft).findIndex((row) => row.key === key)
    if (index < 0) return
    const row = rows(draft)[index]
    const without = (d: NeedsFormDraft) => ({ ...d, [field]: rows(d).filter((r) => r.key !== key) })
    // Past DRAFT the withdraw-approval question comes first: it is the
    // confirmation, and the removal applies once it's answered.
    if (!editingAllowed) return update(without(draft))
    rowRemoval.remove(message, without, (d) => ({ ...d, [field]: restoreRow(rows(d), row, index) }))
  }

  // A summary entry on another section: focus its field once that section
  // has rendered.
  useEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending || pending.step !== stepKey) return
    pendingFocusRef.current = null
    document.getElementById(pending.id)?.focus()
  }, [stepKey])

  // Previous/Next walk the sections, then the outputs. Moving keeps the
  // unsaved draft (it lives on this page, not in the step).
  const allSteps: (NeedsStepKey | OutputStepKey)[] = [
    ...NEEDS_STEPS.map((item) => item.key),
    ...OUTPUT_STEPS,
  ]
  const position = allSteps.indexOf(stepKey)
  const previousStep = position > 0 ? allSteps[position - 1] : null
  const nextStep = position < allSteps.length - 1 ? allSteps[position + 1] : null

  /** Moving between sections only navigates: the draft lives on this page
   * and saves itself. */
  function leaveTo(go: () => void) {
    go()
  }

  function moveTo(key: NeedsStepKey | OutputStepKey) {
    void leaveTo(() => {
      setFocusRow(null)
      goToStep(key)
      // New section: start from its top, not wherever the footer was.
      window.scrollTo?.({ top: 0 })
    })
  }

  function withStep(prev: URLSearchParams, key: NeedsStepKey | OutputStepKey) {
    const next = new URLSearchParams(prev)
    if (key === 'document') next.delete('step')
    else next.set('step', key)
    return next
  }

  function goToStep(key: NeedsStepKey | OutputStepKey) {
    setSearchParams((prev) => withStep(prev, key), { replace: true })
  }

  /** Issues warned about where they show but fixed in another section
   * say so, and take you there (opening what needs opening). */
  function issueFixes(issue: ValidationIssue): IssueFix[] {
    const fixes = t('creator.needs.fixes', { returnObjects: true }) as Record<string, string>
    const item = issue.item_id
    switch (issue.code) {
      case 'HIGH_NEED_WITHOUT_OBJECTIVE':
        return [
          {
            label: fixes.createObjectiveForNeed,
            onSelect: () => {
              setNewObjective({ needKey: item ?? undefined })
              goToStep('objectives')
            },
          },
        ]
      case 'CAPABILITY_WITHOUT_OBJECTIVE':
        return [
          {
            label: fixes.createObjectiveForCapability,
            onSelect: () => setNewObjective({ capability: item ?? undefined }),
          },
          { label: fixes.untickCapability, onSelect: () => goToStep('capabilities') },
        ]
      case 'OBJECTIVE_CAPABILITY_NOT_SELECTED':
        return [{ label: fixes.tickCapability, onSelect: () => goToStep('capabilities') }]
      case 'OBJECTIVE_FRAMEWORK_NOT_NAMED':
        // Name it right here: the regulatory trigger too, if it isn't on.
        return item
          ? [
              {
                label: fixes.nameFramework.replace(
                  '{{framework}}',
                  issueRows.frameworkLabels[item] ?? item,
                ),
                onSelect: () =>
                  update({
                    triggers: draft.triggers.includes('regulatory')
                      ? draft.triggers
                      : ['regulatory', ...draft.triggers],
                    regulatory_frameworks: [...draft.regulatory_frameworks, item],
                  }),
              },
            ]
          : []
      default:
        return []
    }
  }

  function goToIssue(target: IssueTarget) {
    const destination = NEEDS_STEPS.find((s) => s.index === target.section) ?? NEEDS_STEPS[0]
    if (target.itemId && target.field && ROW_FIELDS[target.section]?.includes(target.field)) {
      setFocusRow({ field: target.field, itemId: target.itemId })
      goToStep(destination.key)
      return
    }
    const id = target.field ? fieldDomId(target.field) : null
    if (destination.key === stepKey) {
      if (id) document.getElementById(id)?.focus()
      return
    }
    pendingFocusRef.current = id ? { step: destination.key, id } : null
    goToStep(destination.key)
  }

  const isInvalid = (field: string, itemId?: string | null) =>
    sectionIndex !== null &&
    sectionIssues(report, sectionIndex).some(
      (issue: ValidationIssue) =>
        issue.field === field && (itemId === undefined || issue.item_id === itemId),
    )

  function apiErrorToast(err: unknown) {
    if (err instanceof ApiError && err.code === 'NEEDS_FORM_STALE') {
      showToast(t('creator.needs.toast.stale'), {
        variant: 'error',
        action: { label: t('creator.needs.actions.reload'), onAction: onReload },
      })
      return
    }
    showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
      variant: 'error',
    })
  }

  // Needs in creation order (only closing the gaps deletions left),
  // objectives by the needs they cover: the server renumbers
  // what's saved, so it waits for unsaved edits.
  const renumbering = useRenumberCodes<NeedsRenumberKind, NeedsFormRenumberResult, NeedsForm>({
    url: `/ttx/${ttxId}/needs-form/renumber`,
    read: (result) => result.form,
    onServer: onServerForm,
    onError: apiErrorToast,
  })
  const renumberButton = (kind: NeedsRenumberKind) =>
    form.renumberable.includes(kind) ? (
      <RenumberButton
        label={t(`creator.needs.renumber.${kind}`)}
        hint={t(`creator.needs.renumber.${kind}Hint`)}
        blocked={busy || dirty || renumbering.busy}
        onClick={() => renumbering.renumber(kind)}
      />
    ) : null

  async function run(action: () => Promise<NeedsForm>, successMessage: string) {
    setBusy(true)
    try {
      const next = await action()
      const statusChanged = next.status !== form.status
      onServerForm(next)
      showToast(successMessage)
      if (statusChanged) void refresh()
      return true
    } catch (err) {
      apiErrorToast(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  const transition = async (to: NeedsFormStatus) => {
    await run(
      () =>
        apiFetch<NeedsForm>(`/ttx/${ttxId}/needs-form/transitions`, {
          method: 'POST',
          body: JSON.stringify({ to }),
        }),
      t(`creator.needs.toast.${TOAST_BY_TARGET[to]}`),
    )
  }

  /** Approvals and evidence: they don't change the content, so the draft
   * (and any pending autosave) is left alone. */
  async function runMeta(action: () => Promise<NeedsForm>, successMessage: string | null) {
    setBusy(true)
    try {
      onFormMeta(await action())
      if (successMessage) showToast(successMessage)
      return true
    } catch (err) {
      apiErrorToast(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Uploads one file at a time; stops at the first refused file (its
   * error toasts) and returns the form after the last accepted one. */
  async function uploadEvidence(approvalId: string, files: File[]) {
    let latest: NeedsForm | null = null
    let uploaded = 0
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      try {
        latest = await apiFetch<NeedsForm>(
          `/ttx/${ttxId}/needs-form/approvals/${approvalId}/evidence`,
          { method: 'POST', body },
        )
        uploaded += 1
      } catch (err) {
        apiErrorToast(err)
        break
      }
    }
    return { latest, uploaded }
  }

  const recordApproval = async (input: ApprovalInput, files: File[]) => {
    let recorded: NeedsForm | null = null
    const ok = await runMeta(async () => {
      recorded = await apiFetch<NeedsForm>(`/ttx/${ttxId}/needs-form/approvals`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return recorded
    }, t('creator.needs.toast.approvalRecorded'))
    const approval = (recorded as NeedsForm | null)?.approvals.find(
      (a) => a.version === recorded!.version && a.approver_kind === input.approver_kind,
    )
    if (ok && approval && files.length > 0) {
      setBusy(true)
      const { latest } = await uploadEvidence(approval.id, files)
      if (latest) onFormMeta(latest)
      setBusy(false)
    }
    return ok
  }

  // Approvals and evidence leave the list at once; the DELETE waits for
  // the Undo window (useUndoableAction).
  const removeApproval = (approval: ApprovalRead) => {
    runUndoable({
      message: t('creator.needs.toast.approvalRemoved'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setHidden((ids) => new Set(ids).add(approval.id)),
      onRestore: () => setHidden((ids) => without(ids, approval.id)),
      onCommit: async () => {
        await runMeta(
          () =>
            apiFetch<NeedsForm>(`/ttx/${ttxId}/needs-form/approvals/${approval.id}`, {
              method: 'DELETE',
            }),
          null,
        )
        setHidden((ids) => without(ids, approval.id))
      },
    })
  }

  const addEvidence = async (approval: ApprovalRead, files: File[]) => {
    setBusy(true)
    const { latest, uploaded } = await uploadEvidence(approval.id, files)
    if (latest) onFormMeta(latest)
    if (uploaded > 0) showToast(t('creator.needs.toast.evidenceAdded', { count: uploaded }))
    setBusy(false)
  }

  const removeEvidence = (approval: ApprovalRead, evidence: EvidenceRead) => {
    runUndoable({
      message: t('creator.needs.toast.evidenceRemoved'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setHidden((ids) => new Set(ids).add(evidence.id)),
      onRestore: () => setHidden((ids) => without(ids, evidence.id)),
      onCommit: async () => {
        await runMeta(
          () =>
            apiFetch<NeedsForm>(
              `/ttx/${ttxId}/needs-form/approvals/${approval.id}/evidence/${evidence.id}`,
              { method: 'DELETE' },
            ),
          null,
        )
        setHidden((ids) => without(ids, evidence.id))
      },
    })
  }

  // The PDF is what the approvers sign. Saved changes only, so it matches
  // the screen; with anything but the approvals missing, it comes out as a
  // marked draft (the backend stamps it) and says how much is missing.
  const missingCount = dirty ? 0 : report.ready.length
  // What's missing, in the order the sections are shown: the link goes to
  // the first.
  const firstMissing = [...report.ready].sort(
    (a, b) =>
      NEEDS_STEPS.findIndex((step) => step.index === a.section) -
      NEEDS_STEPS.findIndex((step) => step.index === b.section),
  )[0]
  const pdfUrl = `/ttx/${ttxId}/needs-form/pdf?lang=${i18n.language.slice(0, 2)}`
  // The same document as Markdown, for a wiki or a repository.
  const markdownUrl = `/ttx/${ttxId}/needs-form/export.md?lang=${i18n.language.slice(0, 2)}`

  const StepComponent = isOutput ? undefined : STEP_COMPONENTS[stepKey as NeedsStepKey]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('creator.needs.title')} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span translate="no" className="font-mono">
            {form.exercise_code}
          </span>
          <span aria-hidden="true" className="text-paper-ink/30 dark:text-fg-faint">
            ·
          </span>
          <span className="font-mono">{t('creator.needs.version', { version: form.version })}</span>
          <span className="inline-flex h-6 items-center rounded-xs border border-paper-line px-2 text-xs font-medium dark:border-line">
            {t(`creator.needs.status.${form.status}`)}
          </span>
          <TlpBadge tlp={form.tlp} />
          <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {(dirty || missingCount > 0) && (
              <span id="needs-pdf-note" className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {dirty
                  ? t('creator.needs.pdf.waitForSave')
                  : t('creator.needs.pdf.draftNote', { count: missingCount })}
                {!dirty && firstMissing && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() =>
                        void leaveTo(() =>
                          goToIssue({
                            section: firstMissing.section,
                            field: firstMissing.field,
                            itemId: firstMissing.item_id,
                            code: firstMissing.code,
                          }),
                        )
                      }
                      className={`rounded-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
                    >
                      {t('creator.needs.pdf.showMissing')}
                    </button>
                  </>
                )}
              </span>
            )}
            {dirty ? (
              // Disabled until saved, with the reason as its description.
              <button
                type="button"
                disabled
                aria-describedby="needs-pdf-note"
                className={`${btnSecondary} inline-flex h-8 items-center gap-1.5 py-0 text-xs`}
              >
                <DownloadIcon />
                {t('creator.needs.pdf.downloadMarkdown')}
              </button>
            ) : (
              <a
                href={`${API_BASE}${markdownUrl}`}
                download
                onClick={download(markdownUrl)}
                aria-label={t('creator.needs.pdf.downloadMarkdownLabel')}
                aria-describedby={missingCount > 0 ? 'needs-pdf-note' : undefined}
                className={`${btnSecondary} inline-flex h-8 items-center gap-1.5 py-0 text-xs`}
              >
                <DownloadIcon />
                {t('creator.needs.pdf.downloadMarkdown')}
              </a>
            )}
            {dirty ? (
              <button
                type="button"
                disabled
                aria-describedby="needs-pdf-note"
                className={`${btnSecondary} inline-flex h-8 items-center gap-1.5 py-0 text-xs`}
              >
                <DownloadIcon />
                {t('creator.needs.pdf.download')}
              </button>
            ) : (
              <a
                href={`${API_BASE}${pdfUrl}`}
                download
                onClick={download(pdfUrl)}
                aria-describedby={missingCount > 0 ? 'needs-pdf-note' : undefined}
                className={`${btnSecondary} inline-flex h-8 items-center gap-1.5 py-0 text-xs`}
              >
                <DownloadIcon />
                {missingCount > 0
                  ? t('creator.needs.pdf.downloadDraft')
                  : t('creator.needs.pdf.download')}
              </a>
            )}
          </span>
        </div>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText id="creator.needs.intro" text={t('creator.needs.intro')} />
        </p>
      </div>

      {!archived && (
        <ProposalsPanel<NeedsFormDraft>
          ttxId={ttxId}
          targets={['needs_tlp', 'needs_scope', 'need', 'objective']}
          draftRows={{
            needs_tlp: [tlpRow(form.id, draft)],
            needs_scope: [scopeRow(form.id, draft)],
            need: draft.needs,
            objective: draft.objectives,
          }}
          savedRows={{
            needs_tlp: [tlpRow(form.id, baseline)],
            needs_scope: [scopeRow(form.id, baseline)],
            need: baseline.needs,
            objective: baseline.objectives,
          }}
          codeOf={(id) =>
            [...draft.needs, ...draft.objectives].find((row) => row.id === id || row.key === id)
              ?.code || undefined
          }
          merge={(group, accepted) => mergeNeedsProposals(draft, group, accepted)}
          issueMessage={needsIssueMessage}
          apply={update}
          disabledReason={pendingPatch ? t('assistant.confirming') : null}
        />
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-60">
          <nav aria-label={t('creator.needs.stepsNavLabel')}>
            <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {NEEDS_STEPS.map((item) => {
                const count = sectionIssues(report, item.index).length
                const active = item.key === stepKey
                return (
                  <li key={item.key} className="shrink-0">
                    <Link
                      to={{ search: `${withStep(searchParams, item.key)}` }}
                      replace
                      onClick={() => setFocusRow(null)}
                      aria-current={active ? 'step' : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg lg:-ml-px lg:border-l-2 ${
                        active
                          ? 'bg-accent/10 font-medium text-accent-fg lg:border-accent'
                          : 'text-paper-ink/80 hover:bg-hover dark:text-fg-nav lg:border-transparent'
                      }`}
                    >
                      <span>{t(`creator.needs.steps.${item.key}`)}</span>
                      {count > 0 ? (
                        <span
                          // The number counts what's left to fix here, not rows:
                          // say so on hover (screen readers get the sr-only text).
                          title={t('creator.needs.stepStatus.issues', { count })}
                          className="rounded-xs bg-danger/10 px-1.5 text-xs tabular-nums text-danger-fg"
                        >
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">
                            {t('creator.needs.stepStatus.issues', { count })}
                          </span>
                        </span>
                      ) : item.key === 'approval' && form.status !== 'approved' ? (
                        // Nothing to fix, but not approved yet: a tick here
                        // would read as "done" (the MSEL stays locked). Amber
                        // (--color-inactive-1): to do, not wrong.
                        <span className="rounded-xs bg-inactive-1/12 px-1.5 text-xs text-inactive-1">
                          {t('creator.needs.stepStatus.pending')}
                        </span>
                      ) : (
                        <span className="text-success-fg">
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">{t('creator.needs.stepStatus.complete')}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 hidden px-3 text-xs font-medium text-paper-ink/60 lg:block dark:text-fg-faint">
              {t('creator.needs.outputs.groupLabel')}
            </p>
            <ul className="mt-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {OUTPUT_STEPS.map((key) => {
                const active = key === stepKey
                return (
                  <li key={key} className="shrink-0">
                    <Link
                      to={{ search: `${withStep(searchParams, key)}` }}
                      replace
                      onClick={() => setFocusRow(null)}
                      aria-current={active ? 'step' : undefined}
                      className={`block w-full rounded-sm px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg lg:-ml-px lg:border-l-2 ${
                        active
                          ? 'bg-accent/10 font-medium text-accent-fg lg:border-accent'
                          : 'text-paper-ink/80 hover:bg-hover dark:text-fg-nav lg:border-transparent'
                      }`}
                    >
                      {t(`creator.needs.steps.${key}`)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <StatusTrack
            id="needs-status-title"
            states={(['draft', 'ready_for_approval', 'approved'] as const).map((key) => ({
              key,
              label: t(`creator.needs.status.${key}`),
            }))}
            current={form.status}
          />
          <ValidationSummary
            report={report}
            rows={issueRows}
            status={form.status}
            onSelect={(target) => void leaveTo(() => goToIssue(target))}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <Panel
            title={t(`creator.needs.steps.${stepKey}`)}
            description={
              <HelpText
                id={`creator.needs.stepDescriptions.${stepKey}`}
                text={t(`creator.needs.stepDescriptions.${stepKey}`)}
                extra={
                  stepKey === 'objectives' ? (
                    <span className="block border-l-2 border-panel-line pl-3">
                      <span className="block text-xs font-medium text-paper-ink/70 dark:text-fg-muted">
                        {t('creator.needs.example.title')}
                      </span>
                      <span className="mt-1 block text-pretty text-paper-ink dark:text-fg">
                        {t('creator.needs.example.statement')}
                      </span>
                      <span className="mt-1 block whitespace-pre-line text-xs">
                        {t('creator.needs.example.detail')}
                      </span>
                    </span>
                  ) : undefined
                }
              />
            }
            aside={
              isOutput ? undefined : (
                <SaveStatus
                  state={saveState}
                  dirty={dirty}
                  blocked={blocked && editingAllowed}
                  labels={{
                    saving: t('creator.needs.saveState.saving'),
                    saved: t('creator.needs.saveState.saved'),
                    pending: t('creator.needs.saveState.pending'),
                    blocked: t('creator.needs.saveState.blocked'),
                    error: t('creator.needs.saveState.error'),
                  }}
                />
              )
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {previousStep && (
                    <button
                      type="button"
                      onClick={() => moveTo(previousStep)}
                      className={btnSecondary}
                    >
                      <span aria-hidden="true">← </span>
                      {t('creator.needs.actions.previous')}
                    </button>
                  )}
                  {nextStep && (
                    <button type="button" onClick={() => moveTo(nextStep)} className={btnSecondary}>
                      {t('creator.needs.actions.next')}
                      <span aria-hidden="true"> →</span>
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {sectionIndex !== null && (
              <SectionIssues
                report={report}
                rows={issueRows}
                section={sectionIndex}
                fixes={issueFixes}
                onSelect={(target) => goToIssue(target)}
              />
            )}
            {stepKey === 'traceability' ? (
              <TraceabilityStep form={form} catalog={catalog} dirty={dirty} />
            ) : stepKey === 'eeg' ? (
              <EegStep ttxId={ttxId} dirty={dirty} />
            ) : StepComponent ? (
              <StepComponent
                form={form}
                draft={draft}
                update={update}
                removeRow={removeRow}
                isInvalid={isInvalid}
                catalog={catalog}
                focusRow={focusRow}
                newObjective={newObjective}
                renumberButton={renumberButton}
              />
            ) : (
              <ApprovalStep
                form={shownForm}
                dirty={dirty}
                busy={busy}
                onTransition={transition}
                onRecordApproval={recordApproval}
                onRemoveApproval={removeApproval}
                onAddEvidence={addEvidence}
                onRemoveEvidence={removeEvidence}
              />
            )}
          </Panel>
          {/* Objectives are where earlier exercises' improvement actions
              get re-tested: those that point here, with their objective. */}
          {stepKey === 'objectives' && (
            <div className="mt-6">
              <RetestsPanel ttxId={ttxId} />
            </div>
          )}
        </div>
      </div>

      {pendingPatch && (
        <Modal titleId="needs-withdraw-title" onClose={() => setPendingPatch(null)}>
          <h2
            id="needs-withdraw-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('creator.needs.dialogs.withdrawTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {form.status === 'approved'
              ? t('creator.needs.dialogs.withdrawApproved', { version: form.version + 1 })
              : t('creator.needs.dialogs.withdrawReady')}
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
              {t('creator.needs.dialogs.withdrawConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  )
}

/** The report with each row's id swapped for the key the page uses for
 * that row (they differ for rows created since the page loaded). */
function withRowKeys(report: ValidationReport, draft: NeedsFormDraft): ValidationReport {
  const keyById = new Map<string, string>()
  for (const row of [...draft.needs, ...draft.objectives, ...draft.risks]) {
    if (row.id && row.id !== row.key) keyById.set(row.id, row.key)
  }
  if (keyById.size === 0) return report
  const rekey = (issues: ValidationIssue[]) =>
    issues.map((issue) =>
      issue.item_id && keyById.has(issue.item_id)
        ? { ...issue, item_id: keyById.get(issue.item_id)! }
        : issue,
    )
  return {
    ready: rekey(report.ready),
    approved: rekey(report.approved),
    warnings: rekey(report.warnings),
  }
}
