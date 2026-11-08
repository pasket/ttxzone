import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { fromOrganization, fromSystem, type ActorFields } from '../../lib/actorLibrary'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { LibraryLevel } from '../../lib/libraryLevels'
import type { OrganizationActor, SystemActor } from '../../lib/types'
import { enabledOnly } from '../../lib/libraryItems'
import { Modal } from '../common/Modal'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'

type Level = Exclude<LibraryLevel, 'exercise'>

/** The MSEL's "Add from the library": TTX-Zone's actors and the
 * organization's, searchable; each Add copies one into the exercise's
 * cast (the draft -- it autosaves with the rest of the MSEL). The
 * organization level is simply absent for someone who can't read it. */
export function ActorLibraryPicker({
  organizationId,
  alreadyCopied,
  onAdd,
  onClose,
}: {
  organizationId: string | null
  /** origin ids already in the cast: shown as added. */
  alreadyCopied: Set<string>
  onAdd: (fields: ActorFields) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const [level, setLevel] = useState<Level>('system')
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const system = useApiResource<{ items: SystemActor[] }>('/actor-catalog')
  const organization = useApiResource<{ items: OrganizationActor[] }>(
    organizationId ? `/organizations/${organizationId}/actors` : null,
  )
  const levels: Level[] = organization.data ? ['system', 'organization'] : ['system']

  const rows: { key: string; fields: ActorFields }[] =
    level === 'system'
      ? (system.data?.items ?? []).map((a) => ({ key: a.id, fields: fromSystem(a, spanish) }))
      : enabledOnly(organization.data?.items ?? []).map((a) => ({
          key: a.id,
          fields: fromOrganization(a),
        }))
  const normalized = query.trim().toLowerCase()
  const visible = rows.filter(
    ({ fields }) =>
      !normalized ||
      fields.name.toLowerCase().includes(normalized) ||
      fields.description.toLowerCase().includes(normalized),
  )

  return (
    <Modal titleId="actor-picker-title" onClose={onClose} size="lg">
      <h2 id="actor-picker-title" className="text-balance text-lg font-semibold tracking-tight">
        {t('templates.actors.picker.title')}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {levels.length > 1 && (
          <LibraryLevelSwitch
            levels={levels}
            value={level}
            onChange={(next) => setLevel(next as Level)}
          />
        )}
        <label htmlFor="actor-picker-search" className="sr-only">
          {t('templates.actors.picker.search')}
        </label>
        <input
          id="actor-picker-search"
          name="actor-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('templates.actors.picker.searchPlaceholder')}
          autoComplete="off"
          className={`${inputBase} max-w-xs flex-1`}
        />
      </div>
      <ul className="max-h-[50vh] divide-y divide-panel-line overflow-y-auto rounded-sm border border-panel-line">
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {normalized
              ? t('templates.actors.picker.noResults', { query: query.trim() })
              : t('templates.actors.organizationEmpty')}
          </li>
        )}
        {visible.map(({ key, fields }) => {
          const done = added.has(key) || alreadyCopied.has(key)
          return (
            <li key={key} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium">{fields.name}</span>
                <span className="block text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
                  {t(`creator.msel.actorTypes.${fields.type}`)}
                  {fields.description ? ` · ${fields.description}` : ''}
                </span>
              </span>
              <button
                type="button"
                aria-label={t('templates.actors.picker.addLabel', { name: fields.name })}
                onClick={() => {
                  onAdd(fields)
                  setAdded((previous) => new Set(previous).add(key))
                }}
                className={`${btnSecondary} h-8 shrink-0 py-0 text-xs`}
              >
                {done
                  ? `✓ ${t('templates.actors.picker.added')}`
                  : t('templates.actors.picker.add')}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnPrimary}>
          {t('templates.actors.picker.close')}
        </button>
      </div>
    </Modal>
  )
}
