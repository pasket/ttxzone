import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { ScenarioSource, ScenarioSummary } from '../../lib/scenarios'
import { Modal } from '../common/Modal'
import { AvailableLanguages } from './AvailableLanguages'
import { LibraryItemText } from './LibraryItemText'

const mutedClass = 'text-sm text-paper-ink/70 dark:text-fg-muted'

/** New exercise -> "Choose from the library": TTX-Zone's exercise templates
 * and the organization's (enabled ones), searchable, to start a new
 * exercise from instead of from scratch. Picking one hands it to
 * `ScenarioApplyDialog`, which checks it and creates the exercise. */
export function TemplatePickerDialog({
  organizationId,
  onPick,
  onClose,
}: {
  organizationId: string
  onPick: (template: ScenarioSource) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const system = useApiResource<{ items: ScenarioSummary[] }>('/scenario-catalog')
  const organization = useApiResource<{ items: ScenarioSummary[] }>(
    `/organizations/${organizationId}/scenarios`,
  )

  const needle = query.trim().toLowerCase()
  const keep = (item: ScenarioSummary) =>
    !needle ||
    [item.name, item.description ?? ''].some((text) => text.toLowerCase().includes(needle))
  const groups = [
    {
      key: 'system' as const,
      title: t('templates.picker.groupSystem'),
      loading: system.loading,
      items: (system.data?.items ?? []).filter(keep),
    },
    {
      key: 'organization' as const,
      title: t('templates.picker.groupOrganization'),
      loading: organization.loading,
      // A disabled template can't be copied again.
      items: (organization.data?.items ?? []).filter((item) => !item.disabled_at).filter(keep),
    },
  ]
  const loading = groups.some((group) => group.loading)
  const nothing = !loading && groups.every((group) => group.items.length === 0)

  return (
    <Modal titleId="template-picker-title" onClose={onClose} size="lg" align="top">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2
            id="template-picker-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('templates.picker.title')}
          </h2>
          <p className={mutedClass}>{t('templates.picker.intro')}</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="template-picker-search" className="block text-sm font-medium">
            {t('templates.picker.search')}
          </label>
          <input
            id="template-picker-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('templates.scenarios.filters.searchPlaceholder')}
            className={inputBase}
            autoComplete="off"
          />
        </div>
        {loading && (
          <p className={mutedClass} role="status">
            {t('templates.scenarios.loading')}
          </p>
        )}
        {nothing && <p className={mutedClass}>{t('templates.picker.empty')}</p>}
        <div className="max-h-[60vh] space-y-5 overflow-y-auto">
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.key} aria-labelledby={`template-picker-${group.key}`}>
                  <h3
                    id={`template-picker-${group.key}`}
                    className="mb-2 text-xs font-semibold tracking-wide text-paper-ink/70 uppercase dark:text-fg-muted"
                  >
                    {group.title}
                  </h3>
                  <ul className="divide-y divide-panel-line rounded-sm border border-panel-line">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <LibraryItemText title={item.name} description={item.description} />
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paper-ink/60 dark:text-fg-muted">
                            <AvailableLanguages languages={item.languages} />
                            <span>
                              {t('templates.picker.summary', {
                                objectives: item.counts.objectives,
                                phases: item.counts.phases,
                                injects: item.counts.injects,
                              })}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onPick({
                              source: group.key,
                              id: item.id,
                              name: item.name,
                              languages: item.languages,
                            })
                          }
                          aria-label={t('templates.picker.useLabel', { name: item.name })}
                          className={`${btnSecondary} shrink-0`}
                        >
                          {t('templates.picker.use')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('templates.scenarios.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
