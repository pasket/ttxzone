import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { contentLanguage } from '../../lib/injectLibrary'
import { btnDanger, btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import {
  SCENARIO_COUNT_KEYS,
  SCENARIO_FILE_ACCEPT,
  type ScenarioCheck,
  type ScenarioRead,
  type ScenarioSource,
} from '../../lib/scenarios'
import type { ContentLanguage } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'
import { Field, Select } from '../creator/needs/fields'
import { VariableFields } from './VariableFields'

const mutedClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'
const headingClass =
  'text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-faint'

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

/** The outcome of a check (a dry run): the errors that stop it, or what
 * the scenario holds -- next to what the exercise holds today when it
 * would be overwritten. */
export function ScenarioReport({ check }: { check: ScenarioCheck }) {
  const { t } = useTranslation()
  if (!check.ok) {
    return (
      <div className="space-y-2" role="alert">
        <p className="text-sm font-medium text-danger-fg">
          {t('templates.scenarios.report.failed')}
        </p>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
          {check.errors.map((issue, index) => (
            <li key={index}>
              <span className="text-danger-fg">{issue.message}</span>
              <span
                translate="no"
                className="block font-mono text-xs text-paper-ink/60 dark:text-fg-faint"
              >
                {issue.path}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {check.name && (
        <p className="text-sm font-medium">
          {t('templates.scenarios.report.scenario', { name: check.name })}
          {(check.language === 'en' || check.language === 'es') &&
            ` · ${t(`templates.scenarios.languages.${check.language}`)}`}
        </p>
      )}
      <p className={mutedClass} role="status">
        {t('templates.scenarios.report.passed')}
      </p>
      {check.counts && (
        <table className="w-full text-left">
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('templates.scenarios.report.item')}</th>
              {check.replaces && (
                <th className={`${panelTh} text-right`}>{t('templates.scenarios.report.now')}</th>
              )}
              <th className={`${panelTh} text-right`}>
                {check.replaces
                  ? t('templates.scenarios.report.after')
                  : t('templates.scenarios.report.holds')}
              </th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {SCENARIO_COUNT_KEYS.map((key) => (
              <tr key={key} className={panelTr}>
                <td className={`${panelTd} text-sm`}>{t(`templates.scenarios.counts.${key}`)}</td>
                {check.replaces && (
                  <td className={`${panelTd} text-right text-sm tabular-nums`}>
                    {check.replaces[key]}
                  </td>
                )}
                <td className={`${panelTd} text-right text-sm tabular-nums`}>
                  {check.counts?.[key]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {check.warnings.length > 0 && (
        <div>
          <h3 className={headingClass}>{t('templates.scenarios.report.warnings')}</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {check.warnings.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FilePicker({ id, onPick }: { id: string; onPick: (file: File) => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {t('templates.scenarios.fileLabel')}
      </label>
      <input
        id={id}
        type="file"
        accept={SCENARIO_FILE_ACCEPT}
        className="block w-full text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
        }}
      />
    </div>
  )
}

function asForm(file: File, variables?: Record<string, string>) {
  const body = new FormData()
  body.append('file', file)
  if (variables) body.append('variables', JSON.stringify(variables))
  return body
}

/** Placeholders the copy can fill from the organization in context. */
const ORGANIZATION_PLACEHOLDERS: Record<string, 'organization_name' | 'alias'> = {
  group_name: 'organization_name',
  organization: 'organization_name',
  organization_short: 'alias',
}

/** A library scenario (`library`) or a shared file (no `library`) brought
 * into the organization's exercises: replacing the exercise in context
 * (`ttxId`), or as a new one (no `ttxId`), which touches nothing else.
 * Always a dry run first: errors stop it there. Replacing, the warning says
 * what's lost and the exercise's name must be typed to go ahead. */
export function ScenarioApplyDialog({
  organizationId,
  ttxId,
  contextTtxId,
  library,
  onClose,
}: {
  organizationId: string
  /** The exercise to replace; none: a new exercise. */
  ttxId: string | null
  /** The exercise in context, whose language a new one proposes. */
  contextTtxId?: string | null
  library?: ScenarioSource
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { activeTtx, activeOrganization, ttxList, refresh, setActiveTtxId } = useAuth()
  const navigate = useNavigate()
  const replacing = ttxId !== null
  const exerciseName = replacing && activeTtx?.id === ttxId ? activeTtx.name : ''
  // A scenario in several languages is copied in the one chosen here,
  // proposed from the exercise's content: the profile only decides when
  // the exercise has no language yet.
  const languages = library && library.languages.length > 1 ? library.languages : null
  const [language, setLanguage] = useState<ContentLanguage>(
    contentLanguage(
      ttxList.find((ttx) => ttx.id === (ttxId ?? contextTtxId))?.content_language,
      i18n.language,
    ),
  )
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<ScenarioCheck | null>(null)
  const [checking, setChecking] = useState(library !== undefined)
  const [confirmation, setConfirmation] = useState('')
  // The {placeholders}' values: proposed from the organization until edited.
  const [edited, setEdited] = useState<Record<string, string> | null>(null)
  // Most used first: those are the exercise's core. Ties alphabetically,
  // numbers in order ({company_2} before {company_10}).
  const placeholders = [...(check?.variables ?? [])]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((v) => v.name)
  const values =
    edited ??
    Object.fromEntries(
      placeholders.map((name) => {
        const field = ORGANIZATION_PLACEHOLDERS[name]
        return [name, (field && activeOrganization?.[field]) || '']
      }),
    )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const libraryRequest = library && {
    source: library.source,
    id: library.id,
    ...(languages ? { language } : {}),
  }
  const libraryBody = libraryRequest ? JSON.stringify(libraryRequest) : null
  const endpoint = replacing
    ? `/ttx/${ttxId}/scenario/${library ? 'apply' : 'import'}`
    : `/organizations/${organizationId}/exercises/${library ? 'from-scenario' : 'import'}`
  const url = (dryRun: boolean) => `${endpoint}?dry_run=${dryRun}`

  // A library scenario is checked as soon as the dialog opens (a dry run
  // changes nothing, so a repeated request is harmless).
  useEffect(() => {
    if (libraryBody === null) return
    let cancelled = false
    async function run(body: string) {
      try {
        const result = await apiFetch<ScenarioCheck>(`${endpoint}?dry_run=true`, {
          method: 'POST',
          body,
        })
        if (!cancelled) setCheck(result)
      } catch (err) {
        if (!cancelled) setError(errorText(err, t('auth.common.genericError')))
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    void run(libraryBody)
    return () => {
      cancelled = true
    }
  }, [libraryBody, endpoint, t])

  async function checkFile(picked: File) {
    setFile(picked)
    setCheck(null)
    setError(null)
    setChecking(true)
    try {
      setCheck(await apiFetch<ScenarioCheck>(url(true), { method: 'POST', body: asForm(picked) }))
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
    } finally {
      setChecking(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await apiFetch<ScenarioCheck>(url(false), {
        method: 'POST',
        body: libraryRequest
          ? JSON.stringify({ ...libraryRequest, variables: values })
          : file
            ? asForm(file, values)
            : undefined,
      })
      if (!result.ok) {
        // Most likely a value too long for a field: keep the fields to fix it.
        setError(result.errors.map((issue) => `${issue.message} (${issue.path})`).join(' · '))
        setBusy(false)
        return
      }
      const name = result.name ?? ''
      await refresh()
      if (result.ttx_id) setActiveTtxId(result.ttx_id)
      showToast(
        t(replacing ? 'templates.scenarios.applied' : 'templates.scenarios.exerciseCreated', {
          name,
        }),
      )
      onClose()
      navigate(`/creator/${result.ttx_id ?? ttxId}/exercise`)
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  const ready = check?.ok === true && !checking
  const confirmed = exerciseName !== '' && confirmation.trim() === exerciseName
  const title = replacing
    ? library
      ? t('templates.scenarios.applyTitle', { name: library.name })
      : t('templates.scenarios.importExerciseTitle', { exercise: exerciseName })
    : library
      ? t('templates.scenarios.newExerciseTitle', { name: library.name })
      : t('templates.scenarios.newExerciseFileTitle')

  return (
    <Modal titleId="scenario-apply-title" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="scenario-apply-title" className="text-balance text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {languages && (
          <Field
            id="scenario-apply-language"
            label={t('templates.scenarios.applyLanguage')}
            hint={replacing ? t('templates.scenarios.applyLanguageHint') : undefined}
          >
            <Select<ContentLanguage>
              id="scenario-apply-language"
              hint={replacing}
              value={language}
              onChange={(next) => {
                setLanguage(next)
                setCheck(null)
                setChecking(true)
              }}
              options={languages.map((value) => ({
                value,
                label: t(`templates.scenarios.languages.${value}`),
              }))}
            />
          </Field>
        )}
        {!library && (
          <>
            <p className={mutedClass}>
              {replacing
                ? t('templates.scenarios.importExerciseIntro', { exercise: exerciseName })
                : t('templates.scenarios.newExerciseIntro')}
            </p>
            <FilePicker id="scenario-apply-file" onPick={(picked) => void checkFile(picked)} />
          </>
        )}
        {checking && (
          <p className={mutedClass} role="status">
            {t('templates.scenarios.checking')}
          </p>
        )}
        {check && <ScenarioReport check={check} />}
        {ready && (
          <VariableFields
            legend={t('templates.scenarios.variables.legend')}
            hint={t('templates.scenarios.variables.hint')}
            variables={placeholders}
            values={values}
            onChange={setEdited}
            countLabel={(name) =>
              t('templates.scenarios.variables.used', {
                count: check?.variables.find((v) => v.name === name)?.count ?? 0,
              })
            }
          />
        )}
        {ready && !replacing && (
          <p className={mutedClass}>{t('templates.scenarios.newExerciseNote')}</p>
        )}
        {ready && replacing && (
          <div className="space-y-3 rounded-sm border border-danger/40 p-3">
            <p className="text-sm font-medium text-danger-fg">
              {t('templates.scenarios.overwriteWarning', { exercise: exerciseName })}
            </p>
            <p className={mutedClass}>{t('templates.scenarios.overwriteKeeps')}</p>
            <label className="block text-sm" htmlFor="scenario-apply-confirm">
              {t('templates.scenarios.confirmLabel', { name: exerciseName })}
            </label>
            <input
              name="scenario-apply-confirm"
              id="scenario-apply-confirm"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={exerciseName}
              className={inputBase}
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {ready ? t('common.confirmButton.cancel') : t('templates.scenarios.close')}
          </button>
          {ready && replacing && (
            <button type="submit" disabled={busy || !confirmed} className={btnDanger}>
              {busy ? <ButtonSpinner /> : t('templates.scenarios.overwrite')}
            </button>
          )}
          {ready && !replacing && (
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('templates.scenarios.createExercise')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

/** Admin: check a shared file, then add it to the organization's library. */
export function ScenarioImportDialog({
  organizationId,
  onClose,
  onImported,
}: {
  organizationId: string
  onClose: () => void
  onImported: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<ScenarioCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = (dryRun: boolean) =>
    `/organizations/${organizationId}/scenarios/import?dry_run=${dryRun}`

  async function checkFile(picked: File) {
    setFile(picked)
    setCheck(null)
    setError(null)
    setChecking(true)
    try {
      setCheck(await apiFetch<ScenarioCheck>(url(true), { method: 'POST', body: asForm(picked) }))
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
    } finally {
      setChecking(false)
    }
  }

  async function add() {
    if (!file) return
    setBusy(true)
    try {
      const result = await apiFetch<ScenarioCheck>(url(false), {
        method: 'POST',
        body: asForm(file),
      })
      if (!result.ok) {
        setCheck(result)
        return
      }
      showToast(t('templates.scenarios.imported', { name: result.name ?? '' }))
      onImported()
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="scenario-import-title" onClose={onClose} size="lg">
      <div className="space-y-4">
        <h2
          id="scenario-import-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t('templates.scenarios.importTitle')}
        </h2>
        <p className={mutedClass}>{t('templates.scenarios.importIntro')}</p>
        <FilePicker id="scenario-import-file" onPick={(picked) => void checkFile(picked)} />
        {checking && (
          <p className={mutedClass} role="status">
            {t('templates.scenarios.checking')}
          </p>
        )}
        {check && <ScenarioReport check={check} />}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          {check?.ok && (
            <button type="button" disabled={busy} onClick={() => void add()} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('templates.scenarios.addToLibrary')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Admin: package one of the organization's exercises as a scenario. */
export function ScenarioFromExerciseDialog({
  organizationId,
  onClose,
  onCreated,
}: {
  organizationId: string
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { ttxList } = useAuth()
  const [ttxId, setTtxId] = useState(ttxList[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const created = await apiFetch<{ name: string }>(
        `/organizations/${organizationId}/scenarios`,
        {
          method: 'POST',
          body: JSON.stringify({ ttx_id: ttxId }),
        },
      )
      showToast(t('templates.scenarios.copiedToOrganization', { name: created.name }))
      onCreated()
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="scenario-from-exercise-title" onClose={onClose}>
      <form onSubmit={create} className="space-y-4">
        <h2
          id="scenario-from-exercise-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t('templates.scenarios.fromExerciseTitle')}
        </h2>
        <p className={mutedClass}>{t('templates.scenarios.fromExerciseIntro')}</p>
        {ttxList.length === 0 ? (
          <p className={mutedClass}>{t('templates.scenarios.noExercises')}</p>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="scenario-from-exercise" className="block text-sm font-medium">
              {t('templates.scenarios.exerciseLabel')}
            </label>
            <select
              id="scenario-from-exercise"
              value={ttxId}
              onChange={(event) => setTtxId(event.target.value)}
              className={inputBase}
            >
              {ttxList.map((ttx) => (
                <option key={ttx.id} value={ttx.id}>
                  {ttx.code} · {ttx.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy || !ttxId} className={btnPrimary}>
            {busy ? <ButtonSpinner /> : t('templates.scenarios.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Admin: the library's own name and description of a scenario. */
export function ScenarioEditDialog({
  url,
  initial,
  onClose,
  onSaved,
}: {
  url: string
  initial: { name: string; description: string | null }
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? '')
  const [busy, setBusy] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await apiFetch(url, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), description: description || null }),
      })
      showToast(t('common.toast.savedSuccess'))
      onSaved()
    } catch (err) {
      showToast(errorText(err, t('auth.common.genericError')), { variant: 'error' })
      setBusy(false)
    }
  }

  return (
    <Modal titleId="scenario-edit-title" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <h2 id="scenario-edit-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('templates.scenarios.editTitle', { name: initial.name })}
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="scenario-edit-name" className="block text-sm font-medium">
            {t('templates.scenarios.fields.name')}
          </label>
          <input
            name="scenario-edit-name"
            autoComplete="off"
            id="scenario-edit-name"
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            className={inputBase}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="scenario-edit-description" className="block text-sm font-medium">
            {t('templates.scenarios.fields.description')}
          </label>
          <textarea
            name="scenario-edit-description"
            autoComplete="off"
            id="scenario-edit-description"
            value={description}
            rows={4}
            maxLength={5000}
            onChange={(event) => setDescription(event.target.value)}
            className={inputBase}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** A scenario read-only: what it's about, its objectives and its storyline. */
export function ScenarioViewDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, error } = useApiResource<ScenarioRead>(url)
  const doc = data?.document
  return (
    <Modal titleId="scenario-view-title" onClose={onClose} size="lg">
      <div className="space-y-4">
        <h2 id="scenario-view-title" className="text-balance text-lg font-semibold tracking-tight">
          {data?.name ?? t('templates.scenarios.loading')}
        </h2>
        {error && (
          <p className="text-sm text-danger-fg" role="alert">
            {errorText(error, t('auth.common.genericError'))}
          </p>
        )}
        {doc && (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            {doc.exercise.description && <p className={mutedClass}>{doc.exercise.description}</p>}
            {doc.msel?.summary && <p className="text-sm text-pretty">{doc.msel.summary}</p>}
            {doc.needs.objectives.length > 0 && (
              <section>
                <h3 className={headingClass}>{t('templates.scenarios.counts.objectives')}</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {doc.needs.objectives.map((objective) => (
                    <li key={objective.code}>
                      <CodeRef
                        code={objective.code}
                        title={objective.title || objective.statement}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {doc.msel?.phases.map((phase) => (
              <section key={phase.code}>
                <h3 className={headingClass}>
                  <CodeRef code={phase.code} title={phase.name} />
                </h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {doc.msel?.injects
                    .filter((inject) => inject.phase_code === phase.code)
                    .map((inject) => (
                      <li key={inject.code}>
                        <CodeRef code={inject.code} title={inject.title} />
                        {inject.kind === 'contingent' && (
                          <span className="text-paper-ink/60 dark:text-fg-faint">
                            {' · '}
                            {t('templates.scenarios.contingent')}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('templates.scenarios.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
