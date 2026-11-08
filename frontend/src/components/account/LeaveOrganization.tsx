import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnDanger, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { OrganizationLeavePreview } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { HelpText } from '../common/HelpText'
import { Panel } from '../common/Panel'

type Exercise = OrganizationLeavePreview['exercises'][number]

const BLOCKED_KEYS = {
  planner: 'account.settings.leaveOrganization.blockedPlanner',
  controller: 'account.settings.leaveOrganization.blockedController',
} as const

function seatLabelKey(seat: string) {
  return seat in CONTEXT_ROLE_LABEL_KEYS
    ? CONTEXT_ROLE_LABEL_KEYS[seat as keyof typeof CONTEXT_ROLE_LABEL_KEYS]
    : null
}

/** What leaving takes, once asked for: the Program Manager hand-over,
 * every exercise seat (a lead's successor chosen; an exercise where this
 * person is the only Planner or Controller blocks it) and the typed name. */
function LeaveForm({
  organizationId,
  preview,
  onCancel,
  onLeft,
}: {
  organizationId: string
  preview: OrganizationLeavePreview
  onCancel: () => void
  onLeft?: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const [manager, setManager] = useState(
    preview.is_last_program_manager ? (preview.program_manager_candidates[0]?.user_id ?? '') : '',
  )
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const leads = preview.exercises.filter((e) => e.lead_candidates.length > 0)
  const blocked = preview.exercises.some((e) => e.blocked !== null)
  const stranded =
    preview.is_last_program_manager && preview.program_manager_candidates.length === 0
  const successorFor = (exercise: Exercise) =>
    chosen[exercise.ttx_id] ?? exercise.lead_candidates[0]?.user_id ?? ''
  const canSubmit =
    !submitting &&
    !blocked &&
    !stranded &&
    (!preview.is_last_program_manager || manager !== '') &&
    confirmation.trim() === preview.organization_name.trim()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/organizations/${organizationId}/leave`, {
        method: 'POST',
        body: JSON.stringify({
          confirmation,
          program_manager_successor_id: manager || null,
          lead_successors: Object.fromEntries(
            leads.map((exercise) => [exercise.ttx_id, successorFor(exercise)]),
          ),
        }),
      })
      showToast(
        t('account.settings.leaveOrganization.left', { organization: preview.organization_name }),
      )
      await refresh()
      onLeft?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {preview.is_program_manager && (
        <div className="max-w-md space-y-1.5">
          <label
            htmlFor="leave-program-manager"
            className="block text-sm text-paper-ink dark:text-fg"
          >
            {t('account.settings.leaveOrganization.managerLabel')}
          </label>
          {stranded ? (
            <p className="text-sm text-danger-fg" role="note">
              {t('account.settings.leaveOrganization.stranded')}{' '}
              <Link to="/admin/organization" className={linkAccent}>
                {t('account.settings.leaveOrganization.deleteInstead')}
              </Link>
            </p>
          ) : (
            <>
              <select
                id="leave-program-manager"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className={inputBase}
              >
                {!preview.is_last_program_manager && (
                  <option value="">{t('account.settings.leaveOrganization.managerNobody')}</option>
                )}
                {preview.program_manager_candidates.map((candidate) => (
                  <option key={candidate.user_id} value={candidate.user_id}>
                    {candidate.full_name} ({candidate.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {t(
                  preview.is_last_program_manager
                    ? 'account.settings.leaveOrganization.managerRequired'
                    : 'account.settings.leaveOrganization.managerOptional',
                )}
              </p>
            </>
          )}
        </div>
      )}

      {preview.exercises.length > 0 && (
        <fieldset className="max-w-md space-y-3">
          <legend className="text-sm font-medium text-paper-ink dark:text-fg">
            {t('account.settings.leaveOrganization.exercisesTitle')}
          </legend>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('account.settings.leaveOrganization.exercisesDescription')}
          </p>
          {preview.exercises.map((exercise) => (
            <div key={exercise.ttx_id} className="space-y-1">
              <p className="text-sm text-paper-ink dark:text-fg">
                <CodeRef code={exercise.ttx_code} title={exercise.ttx_name} />{' '}
                <span className="text-paper-ink/60 dark:text-fg-faint">
                  (
                  {exercise.seats
                    .map((seat) => {
                      const key = seatLabelKey(seat)
                      return key ? t(key) : seat
                    })
                    .join(', ')}
                  )
                </span>
              </p>
              {exercise.blocked && (
                <p className="text-sm text-danger-fg">{t(BLOCKED_KEYS[exercise.blocked])}</p>
              )}
              {exercise.lead_candidates.length > 0 && (
                <>
                  <label
                    htmlFor={`leave-lead-${exercise.ttx_id}`}
                    className="block text-xs text-paper-ink/70 dark:text-fg-muted"
                  >
                    {t('account.settings.leaveOrganization.leadLabel')}
                  </label>
                  <select
                    id={`leave-lead-${exercise.ttx_id}`}
                    value={successorFor(exercise)}
                    onChange={(e) =>
                      setChosen((previous) => ({ ...previous, [exercise.ttx_id]: e.target.value }))
                    }
                    className={inputBase}
                  >
                    {exercise.lead_candidates.map((candidate) => (
                      <option key={candidate.user_id} value={candidate.user_id}>
                        {candidate.full_name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          ))}
        </fieldset>
      )}

      <div className="max-w-sm space-y-2">
        <label htmlFor="leave-confirmation" className="block text-sm text-paper-ink dark:text-fg">
          {t('account.settings.leaveOrganization.confirmLabel', {
            organization: preview.organization_name,
          })}
        </label>
        <input
          id="leave-confirmation"
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={preview.organization_name}
          className={inputBase}
          autoComplete="off"
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </div>
      <div className={panelFormActions}>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          {t('common.confirmButton.cancel')}
        </button>
        <button type="submit" disabled={!canSubmit} className={btnDanger}>
          {submitting ? <ButtonSpinner /> : t('account.settings.leaveOrganization.submit')}
        </button>
      </div>
    </form>
  )
}

/** Preferences -> Privacy: leave the organization selected in the
 * ContextBar (the active one), with every role held there. Players leave
 * an exercise through its Planners instead, so an organization where the
 * person holds no organization role isn't offered. */
export function LeaveOrganization({ onLeft }: { onLeft?: () => void }) {
  const { t } = useTranslation()
  const { activeOrganization } = useAuth()
  const [open, setOpen] = useState(false)
  const holdsRole =
    activeOrganization !== null &&
    (activeOrganization.is_program_manager ||
      activeOrganization.is_planner ||
      activeOrganization.is_observer ||
      activeOrganization.is_evaluator)
  const organizationId = activeOrganization?.organization_id ?? null
  const preview = useApiResource<OrganizationLeavePreview>(
    open && holdsRole ? `/organizations/${organizationId}/leave-preview` : null,
  )
  if (!holdsRole || organizationId === null) return null

  return (
    <Panel
      title={t('account.settings.leaveOrganization.title', {
        organization: activeOrganization.organization_name,
      })}
      description={
        <HelpText
          id="account.settings.leaveOrganization.description"
          text={t('account.settings.leaveOrganization.description')}
        />
      }
      footer={
        open ? undefined : (
          <div className={panelFormActions}>
            <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>
              {t('account.settings.leaveOrganization.start')}
            </button>
          </div>
        )
      }
    >
      {open && preview.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {preview.error.message}
        </p>
      )}
      {open && preview.data && (
        <LeaveForm
          key={organizationId}
          organizationId={organizationId}
          preview={preview.data}
          onCancel={() => setOpen(false)}
          onLeft={onLeft}
        />
      )}
    </Panel>
  )
}
