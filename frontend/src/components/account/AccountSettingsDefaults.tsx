import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, inputDisabled } from '../../lib/buttonStyles'
import {
  hasContextChoices,
  heldRoles,
  resolveDefaultContext,
  ttxOptionsForRole,
} from '../../lib/moduleAccess'
import type { ContextRole } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'
import { HelpText } from '../common/HelpText'

const labelClass = 'block text-sm text-paper-ink dark:text-fg'

/** Preferences -> Workspace: the organization, role and exercise to open
 * at sign-in. Every select always holds a concrete value: the form starts
 * from what sign-in would open today (the saved default, resolved with the
 * same resolveDefaultContext AuthContext/Home use, so a stale saved value
 * already shows its fallback), and picking an organization or role reseeds
 * the levels below it to their first available option. Only offered when
 * there's something to choose (see hasContextChoices). */
export function AccountSettingsDefaults() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { status, user, organizations, allTtxList, refresh } = useAuth()

  const [selection, setSelection] = useState(() =>
    resolveDefaultContext(organizations, allTtxList, {
      organizationId: user?.default_organization_id ?? null,
      role: user?.default_role ?? null,
      ttxId: user?.default_ttx_id ?? null,
    }),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const org = organizations.find((o) => o.organization_id === selection.organizationId) ?? null
  const scoped = allTtxList.filter((ttx) => ttx.organization_id === selection.organizationId)
  const roles = org ? heldRoles(org, scoped) : []
  const exercises =
    selection.role && selection.role !== 'program_manager'
      ? ttxOptionsForRole(selection.role, scoped)
      : []
  // Program Manager lands on Admin, which has no exercise; resolveDefaultContext
  // still picks one for later module switches, but it isn't the user's
  // choice here, so it's neither shown nor saved.
  const ttxId = exercises.some((ttx) => ttx.id === selection.ttxId) ? selection.ttxId : null

  function selectOrganization(organizationId: string) {
    setSelection(
      resolveDefaultContext(organizations, allTtxList, {
        organizationId,
        role: null,
        ttxId: null,
      }),
    )
  }

  function selectRole(role: ContextRole) {
    setSelection(
      resolveDefaultContext(organizations, allTtxList, {
        organizationId: selection.organizationId,
        role,
        ttxId: null,
      }),
    )
  }

  const previewParts = [
    org?.organization_name,
    selection.role ? t(CONTEXT_ROLE_LABEL_KEYS[selection.role]) : undefined,
    exercises.find((ttx) => ttx.id === ttxId)?.name,
  ].filter(Boolean)

  // Nothing to choose (one org, one role, at most one exercise): the nav
  // hides this section, so a direct link lands on General instead. Only
  // once auth has loaded -- an empty list while loading isn't "no choice".
  if (status !== 'loading' && !hasContextChoices(organizations, allTtxList)) {
    return <Navigate to="/account/settings/general" replace />
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await apiFetch('/auth/default-context', {
        method: 'PUT',
        body: JSON.stringify({
          organization_id: selection.organizationId,
          role: selection.role,
          ttx_id: ttxId,
        }),
      })
      await refresh()
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-xl">
      <Panel
        title={t('account.settings.defaultsTitle')}
        description={
          <HelpText
            id="account.settings.defaultsDescription"
            text={t('account.settings.defaultsDescription')}
          />
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-48 flex-1 text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('account.settings.defaultsNextLogin')}
            </p>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <ButtonSpinner /> : t('account.settings.defaultsSave')}
            </button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="default-organization">
            {t('account.settings.defaultsOrganization')}
          </label>
          <select
            name="organization"
            id="default-organization"
            value={selection.organizationId ?? ''}
            onChange={(e) => selectOrganization(e.target.value)}
            className={inputBase}
          >
            {organizations.map((o) => (
              <option key={o.organization_id} value={o.organization_id}>
                {o.organization_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="default-role">
            {t('account.settings.defaultsRole')}
          </label>
          <select
            name="role"
            id="default-role"
            value={selection.role ?? ''}
            disabled={roles.length < 2}
            onChange={(e) => selectRole(e.target.value as ContextRole)}
            className={roles.length > 1 ? inputBase : inputDisabled}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(CONTEXT_ROLE_LABEL_KEYS[r])}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="default-exercise">
            {t('account.settings.defaultsExercise')}
          </label>
          <select
            name="exercise"
            id="default-exercise"
            value={ttxId ?? ''}
            disabled={exercises.length < 2}
            onChange={(e) => setSelection({ ...selection, ttxId: e.target.value })}
            className={exercises.length > 1 ? inputBase : inputDisabled}
          >
            {exercises.length === 0 && (
              <option value="">
                {selection.role === 'program_manager'
                  ? t('account.settings.defaultsNotNeeded')
                  : t('account.settings.defaultsNoExercises')}
              </option>
            )}
            {exercises.map((ttx) => (
              <option key={ttx.id} value={ttx.id}>
                {ttx.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-sm border border-paper-line bg-field p-4 dark:border-line">
          <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('account.settings.defaultsPreview')}
          </p>
          <p className="mt-1 text-sm font-medium text-paper-ink dark:text-fg" aria-live="polite">
            {previewParts.length > 0
              ? previewParts.join(' / ')
              : t('account.settings.defaultsNothing')}
          </p>
        </div>

        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </Panel>
    </form>
  )
}
