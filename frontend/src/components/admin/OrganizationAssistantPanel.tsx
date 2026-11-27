import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import type { AssistantRole, OrganizationAssistant } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'

const ROLES = [
  {
    role: 'program_manager',
    label: 'admin.organization.assistant.roles.program_manager',
    hint: 'admin.organization.assistant.hints.program_manager',
  },
  {
    role: 'planner',
    label: 'admin.organization.assistant.roles.planner',
    hint: 'admin.organization.assistant.hints.planner',
  },
  {
    role: 'controller',
    label: 'admin.organization.assistant.roles.controller',
    hint: 'admin.organization.assistant.hints.controller',
  },
  {
    role: 'evaluator',
    label: 'admin.organization.assistant.roles.evaluator',
    hint: 'admin.organization.assistant.hints.evaluator',
  },
] as const

/** The roles this organization leaves the AI assistant on for
 * (GET/PUT /organizations/{id}/assistant), inside the instance's own
 * switch: with that one off, the choice is kept and nobody uses it. */
export function OrganizationAssistantPanel({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [saved, setSaved] = useState<OrganizationAssistant | null>(null)
  const [draft, setDraft] = useState<AssistantRole[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await apiFetch<OrganizationAssistant>(
          `/organizations/${organizationId}/assistant`,
        )
        if (cancelled) return
        setSaved(data)
        setDraft(data.roles)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, t])

  const dirty =
    saved !== null && ROLES.some(({ role }) => draft.includes(role) !== saved.roles.includes(role))
  useUnsavedChangesWarning(dirty)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<OrganizationAssistant>(
        `/organizations/${organizationId}/assistant`,
        { method: 'PUT', body: JSON.stringify({ roles: draft }) },
      )
      setSaved(data)
      setDraft(data.roles)
      showToast(t('admin.organization.assistant.saved'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={save}>
      <Panel
        title={t('admin.organization.assistant.title')}
        description={t('admin.organization.assistant.description')}
        footer={
          <div className={panelFormActions}>
            <button type="submit" disabled={submitting || !dirty} className={btnPrimary}>
              {submitting ? <ButtonSpinner /> : t('admin.organization.assistant.save')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {saved?.instance_enabled === false && (
            <p className="text-sm text-paper-muted dark:text-fg-muted">
              {t('admin.organization.assistant.instanceOff')}
            </p>
          )}
          <fieldset className="space-y-3" disabled={saved === null}>
            <legend className="sr-only">{t('admin.organization.assistant.title')}</legend>
            {ROLES.map(({ role, label, hint }) => (
              <label key={role} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={role}
                  checked={draft.includes(role)}
                  aria-describedby={`org-assistant-${role}-hint`}
                  onChange={(e) =>
                    setDraft((d) =>
                      e.target.checked ? [...d, role] : d.filter((held) => held !== role),
                    )
                  }
                  className="mt-0.5 h-4 w-4 accent-cta"
                />
                <span>
                  <span className="block font-medium text-paper-ink dark:text-fg">{t(label)}</span>
                  <span
                    id={`org-assistant-${role}-hint`}
                    className="block text-paper-muted dark:text-fg-muted"
                  >
                    {t(hint)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </Panel>
    </form>
  )
}
