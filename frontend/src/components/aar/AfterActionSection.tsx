import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { emptyAction, IMPROVEMENT_STATUSES, runLabel } from '../../lib/aar'
import { ApiError, API_BASE, apiFetch } from '../../lib/api'
import { aarRows, mergeAarProposals } from '../../lib/proposals'
import {
  btnPrimary,
  btnSecondary,
  inputCompact,
  linkAccent,
  segmentedControl,
} from '../../lib/buttonStyles'
import type {
  AarObjective,
  AarPreview as AarPreviewData,
  AarRead,
  AarRunOption,
  ImprovementAction,
  RatingLevel,
} from '../../lib/types'
import { ProposalsPanel } from '../assistant/ProposalsPanel'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { EditButton } from '../common/EditButton'
import { FormattedText } from '../common/FormattedText'
import { FormattedTextArea } from '../common/FormattedTextArea'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { ConfirmActionDialog } from '../playground/ConfirmActionDialog'
import { FeedbackResults } from '../playground/FeedbackResults'
import { MeterResults } from '../playground/MetersPanel'
import { TeamNotesPanel } from '../playground/TeamNotesPanel'
import { ActionDialog } from './ActionDialog'
import { AarPreview } from './AarPreview'
import { RetestDialog } from './RetestDialog'
import { RetestRefCell } from './RetestRefCell'
import { RetestsPanel } from './RetestsPanel'

/** How long typing pauses before the report saves itself. */
const SAVE_AFTER_MS = 1000
const LEVELS: RatingLevel[] = ['P', 'S', 'M', 'U']
const muted = 'text-paper-ink/60 dark:text-fg-muted'

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'stale'

/** The editable after-action report (AAR) and improvement plan of the
 * exercise in context: started from the session, written by its Planners
 * and Lead Evaluator (autosaved), marked final (a frozen version) or
 * reopened, exported as PDF. The plan's follow-up (status, due date)
 * works in a final report too. Controllers and Program Managers read it.
 * Shared by Creator, the Playground (Lead Evaluator) and Control. */
export function AfterActionSection({ ttxId }: { ttxId: string }) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const runUndoable = useUndoableAction()
  const [report, setReport] = useState<AarRead | null>(null)
  // The report as last saved: what tells an AI proposal it reached the server.
  const [saved, setSaved] = useState<AarRead | null>(null)
  // An AI proposal accepted on a final report, waiting to reopen it.
  const [reopening, setReopening] = useState<Partial<AarRead> | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'ready' | 'denied' | 'failed'>(
    'loading',
  )
  // Before the report exists: what it will hold, and whether it can start.
  const [preview, setPreview] = useState<AarPreviewData | null>(null)
  const [save, setSave] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<ImprovementAction | 'new' | null>(null)
  const [retesting, setRetesting] = useState<ImprovementAction | null>(null)
  const [prefill, setPrefill] = useState<Partial<ImprovementAction>>({})
  // Removals waiting for their Undo window: autosave holds until it closes.
  const [holding, setHolding] = useState(0)
  const revision = useRef(0)
  const dirty = useRef(false)
  // Bumped on every edit: a save only clears `dirty` if nothing changed
  // while it was in flight.
  const edits = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<AarRead>(`/ttx/${ttxId}/aar`)
        if (cancelled) return
        revision.current = result.revision
        setReport(result)
        setSaved(result)
        setState('ready')
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) return setState('denied')
        if (!(err instanceof ApiError && err.code === 'AAR_NOT_STARTED')) return setState('failed')
        try {
          const next = await apiFetch<AarPreviewData>(`/ttx/${ttxId}/aar/preview`)
          if (cancelled) return
          setPreview(next)
          setState('missing')
        } catch {
          if (!cancelled) setState('failed')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId])

  // Autosave: a moment after the last edit, the whole report.
  useEffect(() => {
    if (!report || !dirty.current || holding > 0 || save === 'stale' || save === 'saving') return
    const timer = window.setTimeout(async () => {
      const sent = edits.current
      const sentActions = report.actions
      setSave('saving')
      try {
        const answer = await apiFetch<AarRead>(`/ttx/${ttxId}/aar`, {
          method: 'PUT',
          body: JSON.stringify(payload(report, revision.current)),
        })
        // The server keeps the order sent: a proposal's row keeps its key.
        const stored = {
          ...answer,
          actions: answer.actions.map((action, at) => ({ ...action, key: sentActions[at]?.key })),
        }
        setSaved(stored)
        revision.current = stored.revision
        const settled = edits.current === sent
        if (settled) dirty.current = false
        // Keep what was typed meanwhile; take the server's codes and flags.
        setReport((current) =>
          current
            ? {
                ...current,
                status: stored.status,
                version: stored.version,
                revision: stored.revision,
                finalized_by: stored.finalized_by,
                finalized_at: stored.finalized_at,
                // New actions got their ids and codes (the server keeps the
                // order sent); actions edited meanwhile keep those edits.
                actions: settled
                  ? stored.actions
                  : current.actions.map((action) => {
                      const at = sentActions.indexOf(action)
                      const row = at >= 0 ? stored.actions[at] : undefined
                      return row && action.id === null
                        ? { ...action, id: row.id, code: row.code }
                        : action
                    }),
              }
            : stored,
        )
        setSave(settled ? 'saved' : 'pending')
      } catch (err) {
        setSave(err instanceof ApiError && err.code === 'AAR_STALE' ? 'stale' : 'error')
      }
    }, SAVE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [report, ttxId, holding, save])

  const edit = useCallback((change: (current: AarRead) => AarRead) => {
    dirty.current = true
    edits.current += 1
    setSave('pending')
    setReport((current) => (current ? change(current) : current))
  }, [])

  async function create(runId: string | null) {
    setBusy(true)
    setError(null)
    try {
      const created = await apiFetch<AarRead>(`/ttx/${ttxId}/aar`, {
        method: 'POST',
        body: JSON.stringify({ run_id: runId }),
      })
      revision.current = created.revision
      setReport(created)
      setSaved(created)
      setState('ready')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusy(false)
    }
  }

  async function replace(path: string, init: RequestInit) {
    setBusy(true)
    setError(null)
    try {
      const next = await apiFetch<AarRead>(`/ttx/${ttxId}/aar${path}`, init)
      revision.current = next.revision
      dirty.current = false
      setReport(next)
      setSaved(next)
      setSave('saved')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <p className={`text-sm ${muted}`}>{t('common.loading')}</p>
  if (state === 'denied') return <p className={`text-sm ${muted}`}>{t('aar.denied')}</p>
  if (state === 'missing' && preview) {
    return (
      <div className="space-y-6">
        <AarPreview
          preview={preview}
          busy={busy}
          error={error}
          onStart={(runId) => void create(runId)}
        />
        <RetestsPanel ttxId={ttxId} />
      </div>
    )
  }
  if (!report) {
    return <p className="text-sm text-danger-fg">{t('auth.common.genericError')}</p>
  }

  const editable = report.can_edit
  const lang = i18n.language.slice(0, 2)
  const pdf = `/ttx/${ttxId}/aar/export.pdf?lang=${lang}`

  function upsertAction(action: ImprovementAction) {
    edit((current) => {
      const at = current.actions.findIndex((a) => a === dialogTarget)
      const actions = [...current.actions]
      if (at >= 0) actions[at] = action
      else actions.push(action)
      return { ...current, actions }
    })
  }
  const dialogTarget = dialog !== 'new' ? dialog : null
  const applyProposal = (patch: Partial<AarRead>) => edit((current) => ({ ...current, ...patch }))

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('aar.title')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs ${save === 'error' || save === 'stale' ? 'text-danger-fg' : muted}`}
              role="status"
            >
              {editable ? t(`aar.save.${save}`) : t('aar.readOnly')}
            </span>
            <a href={`${API_BASE}${pdf}`} download onClick={download(pdf)} className={btnSecondary}>
              {t('aar.pdf')}
            </a>
            {editable && (
              <button
                type="button"
                disabled={busy || save === 'pending' || save === 'saving'}
                onClick={() =>
                  void replace('/transitions', {
                    method: 'POST',
                    body: JSON.stringify({ to: report.status === 'final' ? 'draft' : 'final' }),
                  })
                }
                className={report.status === 'final' ? btnSecondary : btnPrimary}
              >
                {busy ? (
                  <ButtonSpinner />
                ) : report.status === 'final' ? (
                  t('aar.reopen')
                ) : (
                  t('aar.markFinal')
                )}
              </button>
            )}
          </div>
        }
      />
      <p className={`text-sm ${muted}`}>
        {report.status === 'final'
          ? t('aar.finalLine', { version: report.version, who: report.finalized_by })
          : t('aar.draftLine', { version: report.version })}
      </p>
      <RunLine
        key={report.run_id}
        runId={report.run_id}
        runs={report.runs}
        editable={editable}
        disabled={busy || save === 'pending' || save === 'saving'}
        onChange={(run_id) =>
          void replace('/run', {
            method: 'POST',
            body: JSON.stringify({ run_id, revision: revision.current }),
          })
        }
      />
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}

      {editable && (
        <ProposalsPanel<AarRead>
          ttxId={ttxId}
          targets={['aar_text', 'aar_objective', 'aar_action']}
          draftRows={aarRows(report)}
          savedRows={saved ? aarRows(saved) : {}}
          codeOf={(id) =>
            report.objectives.find((o) => o.id === id)?.objective_code ??
            (report.actions.find((a) => a.id === id)?.code || undefined)
          }
          merge={(group) => mergeAarProposals(report, group)}
          apply={(patch) =>
            report.status === 'final' ? setReopening(patch) : applyProposal(patch)
          }
          disabledReason={reopening ? t('assistant.confirming') : null}
          description={t('aar.proposalsDescription')}
        />
      )}

      <Panel title={t('aar.summary')}>
        <TextBlock
          id="aar-executive-summary"
          label={t('aar.executiveSummary')}
          value={report.executive_summary}
          editable={editable}
          onChange={(executive_summary) => edit((c) => ({ ...c, executive_summary }))}
        />
        <TextBlock
          id="aar-scenario-summary"
          label={t('aar.scenarioSummary')}
          value={report.scenario_summary}
          editable={editable}
          onChange={(scenario_summary) => edit((c) => ({ ...c, scenario_summary }))}
        />
      </Panel>

      <Panel title={t('aar.objectives')}>
        <div className="space-y-6">
          {report.objectives.map((objective) => (
            <ObjectiveBlock
              key={objective.id}
              objective={objective}
              editable={editable}
              onChange={(next) =>
                edit((c) => ({
                  ...c,
                  objectives: c.objectives.map((o) => (o.id === next.id ? next : o)),
                }))
              }
              onAddAction={() => {
                setPrefill({
                  objective_code: objective.objective_code,
                  finding:
                    objective.improvements
                      .split('\n')
                      .map((line) => line.replace(/^-\s*/, '').trim())
                      .find(Boolean) ?? '',
                })
                setDialog('new')
              }}
            />
          ))}
        </div>
      </Panel>

      {/* What earlier exercises asked this one to re-test: the results are
          written against them here. */}
      <RetestsPanel ttxId={ttxId} />

      <Panel
        title={t('aar.plan')}
        aside={
          editable && (
            <button
              type="button"
              onClick={() => {
                setPrefill({})
                setDialog('new')
              }}
              className={btnSecondary}
            >
              {t('aar.addAction')}
            </button>
          )
        }
        flush
      >
        {report.actions.length === 0 ? (
          <p className={`p-4 text-sm ${muted}`}>{t('aar.noActions')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-panel-line text-left text-xs">
                <th className="px-3 py-2">{t('aar.columns.action')}</th>
                <th className="px-3 py-2">{t('aar.columns.owner')}</th>
                <th className="px-3 py-2">{t('aar.columns.due')}</th>
                <th className="px-3 py-2">{t('aar.columns.status')}</th>
                <th className="px-3 py-2">{t('aar.columns.retest')}</th>
                {editable && (
                  <th className="w-24 px-3 py-2 text-right">{t('aar.columns.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {report.actions.map((action, index) => (
                <tr
                  key={action.id ?? `new-${index}`}
                  className="border-b border-panel-line align-top"
                >
                  <td className="px-3 py-2">
                    <CodeRef
                      code={action.code || '…'}
                      title={action.action || action.finding}
                      wrap
                    />
                    {action.finding && <p className={`text-xs ${muted}`}>{action.finding}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {[action.owner, action.owner_area].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {action.due_date ?? '—'}
                    {action.overdue && (
                      <span className="ml-1 rounded-xs bg-danger/10 px-1 text-xs text-danger-fg">
                        {t('aar.overdue')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {(report.can_follow_up ?? editable) && action.code ? (
                      <select
                        aria-label={t('aar.statusOf', { code: action.code })}
                        value={action.status}
                        disabled={busy}
                        onChange={(e) =>
                          void replace(`/actions/${action.code}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: e.target.value,
                              status_note: action.status_note,
                              due_date: action.due_date,
                            }),
                          })
                        }
                        className="rounded-sm border border-panel-line bg-field px-1 py-0.5 text-sm"
                      >
                        {IMPROVEMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(`aar.status.${s}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t(`aar.status.${action.status}`)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <RetestRefCell retest={action.retest} />
                    {report.can_follow_up && action.code && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRetesting(action)}
                        className={`block text-xs ${linkAccent}`}
                        aria-label={t('aar.retest.changeLabel', { code: action.code })}
                      >
                        {action.retest ? t('aar.retest.change') : t('aar.retest.link')}
                      </button>
                    )}
                  </td>
                  {editable && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <EditButton
                          label={t('aar.editAction', { code: action.code || '…' })}
                          onClick={() => setDialog(action)}
                        />
                        <IconButton
                          label={t('aar.removeAction', { code: action.code || '…' })}
                          onClick={() => {
                            const removed = action
                            setHolding((n) => n + 1)
                            runUndoable({
                              message: t('aar.removed', { code: action.code || '…' }),
                              undoLabel: t('common.toast.undo'),
                              onRemove: () =>
                                edit((c) => ({
                                  ...c,
                                  actions: c.actions.filter((a) => a !== removed),
                                })),
                              onRestore: () => {
                                setReport((c) =>
                                  c
                                    ? {
                                        ...c,
                                        actions: [
                                          ...c.actions.slice(0, index),
                                          removed,
                                          ...c.actions.slice(index),
                                        ],
                                      }
                                    : c,
                                )
                                setHolding((n) => n - 1)
                              },
                              onCommit: async () => setHolding((n) => n - 1),
                            })
                          }}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={t('aar.conclusions')}>
        <TextBlock
          id="aar-conclusions"
          label={t('aar.conclusions')}
          value={report.conclusions}
          editable={editable}
          onChange={(conclusions) => edit((c) => ({ ...c, conclusions }))}
        />
      </Panel>

      {report.can_see_session && report.run_id && (
        <>
          <Panel title={t('aar.fromSession.title')} description={t('aar.fromSession.description')}>
            <div className="text-sm">
              <FeedbackResults key={report.run_id} ttxId={ttxId} seq={0} runId={report.run_id} />
              <MeterResults key={`meters-${report.run_id}`} ttxId={ttxId} runId={report.run_id} />
            </div>
          </Panel>
          <TeamNotesPanel key={report.run_id} ttxId={ttxId} runId={report.run_id} />
        </>
      )}

      {reopening && (
        <ConfirmActionDialog
          title={t('aar.proposalReopenTitle')}
          description={t('aar.proposalReopenBody', { version: report.version + 1 })}
          confirmLabel={t('aar.proposalReopenConfirm')}
          pending={false}
          onClose={() => setReopening(null)}
          onConfirm={() => {
            applyProposal(reopening)
            setReopening(null)
          }}
        />
      )}

      {retesting && (
        <RetestDialog
          code={retesting.code}
          current={retesting.retest}
          candidatesPath={`/ttx/${ttxId}/aar/retest-candidates`}
          onClose={() => setRetesting(null)}
          onSave={(retestTtxId, retestObjectiveId) =>
            replace(`/actions/${retesting.code}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: retesting.status,
                status_note: retesting.status_note,
                due_date: retesting.due_date,
                retest_ttx_id: retestTtxId,
                retest_objective_id: retestObjectiveId,
              }),
            })
          }
        />
      )}
      {dialog && (
        <ActionDialog
          initial={dialog === 'new' ? { ...emptyAction(), ...prefill } : dialog}
          objectives={report.objectives}
          onClose={() => setDialog(null)}
          onSave={(action) => {
            upsertAction(action)
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

function payload(report: AarRead, revision: number) {
  return {
    revision,
    executive_summary: report.executive_summary,
    scenario_summary: report.scenario_summary,
    conclusions: report.conclusions,
    objectives: report.objectives.map(({ id, overall, strengths, improvements, analysis }) => ({
      id,
      overall,
      strengths,
      improvements,
      analysis,
    })),
    actions: report.actions.map((a) => ({
      id: a.id,
      objective_code: a.objective_code,
      finding: a.finding,
      action: a.action,
      owner: a.owner,
      owner_area: a.owner_area,
      due_date: a.due_date,
      status: a.status,
      status_note: a.status_note,
    })),
  }
}

function TextBlock({
  id,
  label,
  value,
  editable,
  onChange,
}: {
  id: string
  label: string
  value: string
  editable: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {editable ? (
        <FormattedTextArea id={id} value={value} onChange={onChange} rows={5} maxLength={20000} />
      ) : (
        <FormattedText text={value || '—'} className="text-sm" />
      )}
    </div>
  )
}

function ObjectiveBlock({
  objective,
  editable,
  onChange,
  onAddAction,
}: {
  objective: AarObjective
  editable: boolean
  onChange: (next: AarObjective) => void
  onAddAction: () => void
}) {
  const { t } = useTranslation()
  const field = (key: 'strengths' | 'improvements' | 'analysis') => (
    <TextBlock
      id={`aar-${objective.id}-${key}`}
      label={t(`aar.fields.${key}`)}
      value={objective[key]}
      editable={editable}
      onChange={(value) => onChange({ ...objective, [key]: value })}
    />
  )
  return (
    <section
      aria-label={objective.objective_code}
      className="space-y-3 border-b border-panel-line pb-6 last:border-0 last:pb-0"
    >
      <h3 className="text-sm font-semibold">
        <CodeRef code={objective.objective_code} title={objective.title} wrap strong />
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">{t('aar.fields.overall')}</span>
        <div role="radiogroup" aria-label={t('aar.fields.overall')} className={segmentedControl}>
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={objective.overall === level}
              disabled={!editable}
              title={t(`creator.needs.outputs.ratings.${level}`)}
              onClick={() =>
                onChange({ ...objective, overall: objective.overall === level ? null : level })
              }
              className={`h-full rounded-full px-3 font-mono text-sm ${
                objective.overall === level
                  ? 'bg-accent font-semibold text-ink'
                  : 'text-paper-ink/70 hover:text-paper-ink dark:text-fg-muted'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      {field('strengths')}
      {field('improvements')}
      {editable && (
        <button type="button" onClick={onAddAction} className={`${btnSecondary} h-7 px-2 text-xs`}>
          {t('aar.addActionFrom')}
        </button>
      )}
      {field('analysis')}
      {objective.session_ratings.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-paper-ink/70 dark:text-fg-muted">
            {t('aar.sessionRatings', { count: objective.session_ratings.length })}
          </summary>
          <ul className="mt-2 space-y-1">
            {objective.session_ratings.map((rating, index) => (
              <li key={index}>
                <span className="font-mono font-semibold">{rating.level}</span>{' '}
                {rating.room_code && (
                  <span translate="no" className="font-mono text-paper-ink/60 dark:text-fg-muted">
                    {rating.room_code === 'main'
                      ? t('playground.rooms.mainRoom')
                      : rating.room_code}{' '}
                  </span>
                )}
                {rating.point}
                {rating.rationale && (
                  <span className="text-paper-ink/60 dark:text-fg-muted">
                    {' '}
                    — {rating.rationale}
                  </span>
                )}
                <span className="text-paper-ink/60 dark:text-fg-muted"> ({rating.evaluator})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/** The session the report is written from; its authors can move it to
 * another one (what's written stays). */
function RunLine({
  runId,
  runs,
  editable,
  disabled,
  onChange,
}: {
  runId: string | null
  runs: AarRunOption[]
  editable: boolean
  disabled: boolean
  onChange: (runId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [next, setNext] = useState(runId ?? '')
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const run = runs.find((r) => r.id === runId)
  if (!run) return null
  if (!editable || runs.length < 2) {
    return (
      <p className={`text-sm ${muted}`}>
        {t('aar.run.writtenFrom', { run: runLabel(t, dateFmt, run) })}
      </p>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-label={t('aar.run.label')}
          aria-describedby="aar-run-hint"
          className={inputCompact}
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {runLabel(t, dateFmt, r)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || next === runId}
          onClick={() => onChange(next)}
          className={btnSecondary}
        >
          {t('aar.run.change')}
        </button>
      </div>
      <p id="aar-run-hint" className={`text-sm ${muted}`}>
        {t('aar.run.hint')}
      </p>
    </div>
  )
}
