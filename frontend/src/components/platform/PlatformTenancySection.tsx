import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { apiFetch } from '../../lib/api'
import { actionsCellClass, btnPrimary, inputBase, optionalSuffix } from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  FreeEmailDomain,
  FreeEmailDomainListResponse,
  InstanceSettings,
  TenancyMode,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { Switch } from '../common/Switch'
import {
  labelClass,
  MODE_HINT_KEYS,
  MODE_LABEL_KEYS,
  MODES,
  useErrorMessage,
} from './platformCommon'

/** The deployment's rules: who may found organizations, and how many. */
function TenancyPanel({
  current,
  onSaved,
}: {
  current: InstanceSettings
  onSaved: (next: InstanceSettings) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [mode, setMode] = useState<TenancyMode>(current.tenancy_mode)
  const [max, setMax] = useState(current.max_organizations?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pinned = current.pinned_by_env
  const maxValue = max.trim() === '' ? null : Number(max)
  const maxValid = maxValue === null || (Number.isInteger(maxValue) && maxValue >= 1)
  const dirty = mode !== current.tenancy_mode || maxValue !== current.max_organizations

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const next = await apiFetch<InstanceSettings>('/instance/settings', {
        method: 'PUT',
        body: JSON.stringify({
          tenancy_mode: mode,
          max_organizations: mode === 'single' ? null : maxValue,
        }),
      })
      onSaved(next)
      showToast(t('platform.tenancy.saved'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title={t('platform.tenancy.title')}
        description={
          <HelpText
            id="platform.tenancy.description"
            text={t(pinned ? 'platform.tenancy.pinned' : 'platform.tenancy.description')}
          />
        }
        footer={
          pinned ? undefined : (
            <div className={panelFormActions}>
              <button
                type="submit"
                disabled={submitting || !dirty || !maxValid}
                className={btnPrimary}
              >
                {submitting ? <ButtonSpinner /> : t('platform.tenancy.save')}
              </button>
            </div>
          )
        }
      >
        <fieldset className="max-w-2xl space-y-3" disabled={pinned}>
          <legend className="sr-only">{t('platform.tenancy.modeLabel')}</legend>
          {MODES.map((value) => (
            <label key={value} className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="tenancy-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{t(MODE_LABEL_KEYS[value])}</span>
                <span className="block text-paper-ink/60 dark:text-fg-muted">
                  {t(MODE_HINT_KEYS[value])}
                </span>
              </span>
            </label>
          ))}
          {mode !== 'single' && (
            <div className="max-w-sm space-y-1.5 pt-2">
              <label className={labelClass} htmlFor="platform-max-organizations">
                {t('platform.tenancy.maxLabel')}{' '}
                <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
              </label>
              <input
                id="platform-max-organizations"
                name="max-organizations"
                type="number"
                min={1}
                inputMode="numeric"
                autoComplete="off"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className={inputBase}
              />
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {t('platform.tenancy.maxHint', { count: current.organization_count })}
              </p>
            </div>
          )}
        </fieldset>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </Panel>
    </form>
  )
}

/** The free email domains whose accounts can't found an organization of
 * their own. Shown only while the rule is "open", the one rule it applies
 * to: under the others the instance administrator picks every founder. */
function FreeEmailDomainsPanel() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const runUndoable = useUndoableAction()
  const list = useApiResource<FreeEmailDomainListResponse>('/instance/free-email-domains')
  const [items, setItems] = useState<FreeEmailDomain[] | null>(null)
  const [domain, setDomain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const shown = items ?? list.data?.items ?? null

  function replace(next: FreeEmailDomain) {
    setItems((prev) =>
      [...(prev ?? shown ?? []).filter((item) => item.domain !== next.domain), next].sort((a, b) =>
        a.domain.localeCompare(b.domain),
      ),
    )
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const added = await apiFetch<FreeEmailDomain>('/instance/free-email-domains', {
        method: 'POST',
        body: JSON.stringify({ domain: domain.trim() }),
      })
      replace(added)
      setDomain('')
      showToast(t('platform.freeEmailDomains.added'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(item: FreeEmailDomain, active: boolean) {
    replace({ ...item, active })
    try {
      await apiFetch<FreeEmailDomain>(
        `/instance/free-email-domains/${encodeURIComponent(item.domain)}`,
        { method: 'PUT', body: JSON.stringify({ active }) },
      )
    } catch (err) {
      replace(item)
      showToast(errorMessage(err), { variant: 'error' })
    }
  }

  function handleRemove(item: FreeEmailDomain) {
    runUndoable({
      message: t('platform.freeEmailDomains.removed'),
      undoLabel: t('common.toast.undo'),
      onRemove: () =>
        setItems((prev) => (prev ?? shown ?? []).filter((i) => i.domain !== item.domain)),
      onRestore: () => replace(item),
      onCommit: async () => {
        try {
          await apiFetch(`/instance/free-email-domains/${encodeURIComponent(item.domain)}`, {
            method: 'DELETE',
          })
        } catch (err) {
          replace(item)
          showToast(errorMessage(err), { variant: 'error' })
        }
      },
    })
  }

  return (
    <Panel
      title={t('platform.freeEmailDomains.title')}
      meta={shown ? t('platform.freeEmailDomains.count', { count: shown.length }) : undefined}
      description={
        <HelpText
          id="platform.freeEmailDomains.description"
          text={t('platform.freeEmailDomains.description')}
        />
      }
      flush
    >
      <form onSubmit={handleAdd} className="space-y-1.5 px-5 py-4">
        <label className={labelClass} htmlFor="platform-free-email-domain">
          {t('platform.freeEmailDomains.domainLabel')}
        </label>
        <div className="flex max-w-md gap-2">
          <input
            id="platform-free-email-domain"
            name="domain"
            spellCheck={false}
            autoComplete="off"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t('platform.freeEmailDomains.domainPlaceholder')}
            disabled={submitting}
            className={inputBase}
            required
          />
          <button
            type="submit"
            disabled={submitting || !shown || domain.trim() === ''}
            className={`shrink-0 ${btnPrimary}`}
          >
            {submitting ? <ButtonSpinner /> : t('platform.freeEmailDomains.addButton')}
          </button>
        </div>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </form>
      {list.error && (
        <p className="px-5 pb-4 text-sm text-danger-fg" role="alert">
          {list.error.message}
        </p>
      )}
      {shown && shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={panelTh}>{t('platform.freeEmailDomains.domainLabel')}</th>
                <th className={panelTh}>{t('platform.freeEmailDomains.originLabel')}</th>
                <th className={panelTh}>{t('platform.freeEmailDomains.blocksLabel')}</th>
                <th className={panelActionsTh}>{t('common.table.actions')}</th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {shown.map((item) => (
                <tr key={item.domain} className={panelTr}>
                  <td className={`${panelTd} font-mono text-sm text-paper-ink dark:text-fg`}>
                    {item.domain}
                  </td>
                  <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                    {t(
                      item.builtin
                        ? 'platform.freeEmailDomains.builtin'
                        : 'platform.freeEmailDomains.custom',
                    )}
                  </td>
                  <td className={panelTd}>
                    {item.builtin ? (
                      <Switch
                        checked={item.active}
                        onChange={(active) => void handleToggle(item, active)}
                      >
                        <span className="sr-only">{item.domain}</span>
                      </Switch>
                    ) : (
                      <span className="text-sm text-paper-ink/70 dark:text-fg-muted">
                        {t('platform.freeEmailDomains.active')}
                      </span>
                    )}
                  </td>
                  <td className={panelTd}>
                    <div className={actionsCellClass}>
                      {!item.builtin && (
                        <IconButton
                          onClick={() => handleRemove(item)}
                          label={t('platform.freeEmailDomains.removeButton', {
                            domain: item.domain,
                          })}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/** Platform -> Tenancy rule: who may found organizations here, and how
 * many -- read-only while the deployment's configuration pins it -- and,
 * under the "open" rule, the free email domains that can't. */
export function PlatformTenancySection() {
  const { t } = useTranslation()
  const settings = useApiResource<InstanceSettings>('/instance/settings')
  const [saved, setSaved] = useState<InstanceSettings | null>(null)
  const current = saved ?? settings.data

  return (
    <div className="space-y-6">
      <SectionHeader title={t('platform.sections.tenancy')} />
      {settings.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {settings.error.message}
        </p>
      )}
      {current && (
        <TenancyPanel
          key={`${current.tenancy_mode}-${current.max_organizations}`}
          current={current}
          onSaved={setSaved}
        />
      )}
      {current?.tenancy_mode === 'open' && <FreeEmailDomainsPanel />}
    </div>
  )
}
