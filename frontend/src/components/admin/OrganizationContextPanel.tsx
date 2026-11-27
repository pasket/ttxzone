import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, optionalSuffix } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import type { OrganizationContext } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'

const EMPTY: OrganizationContext = {
  sector: '',
  size: '',
  regulators: '',
  technologies: '',
  critical_assets: '',
}

const FIELDS = [
  {
    name: 'sector',
    label: 'admin.organization.context.sector',
    hint: 'admin.organization.context.sectorPlaceholder',
    long: false,
    max: 255,
  },
  {
    name: 'size',
    label: 'admin.organization.context.size',
    hint: 'admin.organization.context.sizePlaceholder',
    long: false,
    max: 255,
  },
  {
    name: 'regulators',
    label: 'admin.organization.context.regulators',
    hint: 'admin.organization.context.regulatorsPlaceholder',
    long: true,
    max: 1000,
  },
  {
    name: 'technologies',
    label: 'admin.organization.context.technologies',
    hint: 'admin.organization.context.technologiesPlaceholder',
    long: true,
    max: 2000,
  },
  {
    name: 'critical_assets',
    label: 'admin.organization.context.criticalAssets',
    hint: 'admin.organization.context.criticalAssetsPlaceholder',
    long: true,
    max: 2000,
  },
] as const

/** What the organization's exercises are designed around, in its own
 * words (GET/PUT /organizations/{id}/context): a decision of its own,
 * saved apart from the profile. Its Exercise Planners' AI client reads it,
 * where the assistant is on, so the description says where it goes. */
export function OrganizationContextPanel({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [saved, setSaved] = useState<OrganizationContext | null>(null)
  const [draft, setDraft] = useState<OrganizationContext>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await apiFetch<OrganizationContext>(`/organizations/${organizationId}/context`)
        if (cancelled) return
        setSaved(data)
        setDraft(data)
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

  const dirty = saved !== null && FIELDS.some(({ name }) => draft[name] !== saved[name])
  useUnsavedChangesWarning(dirty)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const data = await apiFetch<OrganizationContext>(`/organizations/${organizationId}/context`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      })
      setSaved(data)
      setDraft(data)
      showToast(t('admin.organization.context.saved'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={save}>
      <Panel
        title={t('admin.organization.context.title')}
        description={t('admin.organization.context.description')}
        footer={
          <div className={panelFormActions}>
            <button type="submit" disabled={submitting || !dirty} className={btnPrimary}>
              {submitting ? <ButtonSpinner /> : t('admin.organization.context.save')}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {FIELDS.map(({ name, label, hint, long, max }) => (
            <div key={name} className={`space-y-1.5 ${long ? '' : 'max-w-2xl'}`}>
              <label
                className="block text-sm text-paper-ink dark:text-fg"
                htmlFor={`org-context-${name}`}
              >
                {t(label)} <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
              </label>
              {long ? (
                <textarea
                  id={`org-context-${name}`}
                  name={name}
                  autoComplete="off"
                  rows={3}
                  maxLength={max}
                  disabled={saved === null}
                  value={draft[name]}
                  placeholder={t(hint)}
                  onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                  className={inputBase}
                />
              ) : (
                <input
                  id={`org-context-${name}`}
                  name={name}
                  autoComplete="off"
                  maxLength={max}
                  disabled={saved === null}
                  value={draft[name]}
                  placeholder={t(hint)}
                  onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                  className={inputBase}
                />
              )}
            </div>
          ))}
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
