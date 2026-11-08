import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnDanger, inputBase } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import type { LeadExercise } from '../../lib/types'
import { Panel } from '../common/Panel'
import { AccountLegalPanel } from './AccountLegalPanel'
import { LeaveOrganization } from './LeaveOrganization'
import { HelpText } from '../common/HelpText'

// Deliberately not translated -- the exact phrase is the friction
// mechanism (same "type the resource name to confirm" pattern GitHub uses
// for repo deletion), not UI copy.
const CONFIRMATION_PHRASE = 'delete my account'

export function AccountSettingsPrivacy() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Exercises this account leads with someone to take over: the Lead
  // Planner role is never handed over silently, so each needs a successor
  // (the longest-standing member preselected).
  const led = useApiResource<{ items: LeadExercise[] }>('/auth/me/lead-exercises')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const leadExercises = led.data?.items ?? []
  const successorFor = (exercise: LeadExercise) =>
    chosen[exercise.ttx_id] ?? exercise.candidates[0]?.user_id ?? ''

  const canSubmit = confirmation === CONFIRMATION_PHRASE && !submitting && !led.loading

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/me', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmation,
          lead_successors: Object.fromEntries(
            leadExercises.map((exercise) => [exercise.ttx_id, successorFor(exercise)]),
          ),
        }),
      })
      navigate('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-xl space-y-6">
      <AccountLegalPanel />
      {/* Leaving hands over the leads there: what's left to hand over changes. */}
      <LeaveOrganization onLeft={led.refetch} />
      <form onSubmit={handleSubmit}>
        <Panel
          title={t('account.settings.deleteAccount.title')}
          description={
            <HelpText
              id="account.settings.deleteAccount.description"
              text={t('account.settings.deleteAccount.description')}
            />
          }
          footer={
            <div className={panelFormActions}>
              <button type="submit" disabled={!canSubmit} className={btnDanger}>
                {t('account.settings.deleteAccount.submit')}
              </button>
            </div>
          }
        >
          {user?.is_last_instance_admin && (
            <p className="mb-5 max-w-md text-sm text-danger-fg" role="note">
              {t('account.settings.deleteAccount.lastInstanceAdmin')}
            </p>
          )}
          {leadExercises.length > 0 && (
            <fieldset className="mb-5 max-w-md space-y-3">
              <legend className="text-sm font-medium text-paper-ink dark:text-fg">
                {t('account.settings.deleteAccount.leadTitle')}
              </legend>
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('account.settings.deleteAccount.leadDescription')}
              </p>
              {leadExercises.map((exercise) => (
                <div key={exercise.ttx_id} className="space-y-1">
                  <label
                    htmlFor={`lead-successor-${exercise.ttx_id}`}
                    className="block text-sm text-paper-ink dark:text-fg"
                  >
                    <span translate="no" className="font-mono text-xs">
                      {exercise.ttx_code}
                    </span>{' '}
                    {exercise.ttx_name}{' '}
                    <span className="text-paper-ink/60 dark:text-fg-faint">
                      ({exercise.organization_name})
                    </span>
                  </label>
                  <select
                    id={`lead-successor-${exercise.ttx_id}`}
                    name={`lead-successor-${exercise.ttx_id}`}
                    value={successorFor(exercise)}
                    onChange={(e) =>
                      setChosen((previous) => ({ ...previous, [exercise.ttx_id]: e.target.value }))
                    }
                    className={inputBase}
                  >
                    {exercise.candidates.map((candidate) => (
                      <option key={candidate.user_id} value={candidate.user_id}>
                        {candidate.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>
          )}
          <div className="max-w-sm space-y-2">
            <label
              className="block text-sm text-paper-ink dark:text-fg"
              htmlFor="delete-confirmation"
            >
              {t('account.settings.deleteAccount.confirmLabel', { phrase: CONFIRMATION_PHRASE })}
            </label>
            <input
              name="confirmation"
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              className={inputBase}
              autoComplete="off"
            />
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
          </div>
        </Panel>
      </form>
    </div>
  )
}
