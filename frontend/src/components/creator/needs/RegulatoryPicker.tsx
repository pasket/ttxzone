import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  inputBase,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../../lib/buttonStyles'
import { frameworkLabel } from '../../../lib/needsForm'
import type { RegulatoryCatalog } from '../../../lib/types'
import { ScrollArea } from '../../common/ScrollArea'

type Scope = 'named' | 'all' | 'selected'

/** Case- and accent-insensitive, so "notificacion" finds "Notificación". */
function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** The regulatory requirements an objective evidences, as a filterable
 * table: a search over framework, reference and description, and a scope
 * -- the frameworks named in Triggers (the default when there are any),
 * all of them, or only the ones ticked. Named frameworks come first. */
export function RegulatoryPicker({
  id,
  catalog,
  frameworks,
  selected,
  onChange,
}: {
  id: string
  catalog: RegulatoryCatalog | null
  frameworks: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const named = new Set(frameworks)
  const [scope, setScope] = useState<Scope>(named.size > 0 ? 'named' : 'all')
  const [query, setQuery] = useState('')

  const rows = (catalog?.items ?? [])
    .map((item, index) => ({
      ...item,
      label: frameworkLabel(catalog, item.framework, spanish),
      description: spanish ? item.description_es : item.description_en,
      index,
    }))
    .sort(
      (a, b) =>
        Number(named.has(b.framework)) - Number(named.has(a.framework)) || a.index - b.index,
    )

  const needle = fold(query.trim())
  const shown = rows.filter((row) => {
    if (scope === 'named' && !named.has(row.framework) && !selected.includes(row.id)) return false
    if (scope === 'selected' && !selected.includes(row.id)) return false
    return !needle || fold(`${row.label} ${row.reference} ${row.description}`).includes(needle)
  })

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : // Keep the catalog's order, not the click order.
          rows
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((row) => row.id)
            .filter((v) => v === value || selected.includes(v)),
    )
  }

  const scopes: Scope[] = named.size > 0 ? ['named', 'all', 'selected'] : ['all', 'selected']
  const legend = t('creator.needs.fields.regulatory_requirement_ids')

  return (
    <fieldset id={id} tabIndex={-1} className="space-y-3">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name={`${id}-search`}
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('creator.needs.objectiveDialog.regulatory.search')}
          aria-label={t('creator.needs.objectiveDialog.regulatory.search')}
          autoComplete="off"
          spellCheck={false}
          // Enter would submit the dialog's form.
          onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
          className={`${inputBase} min-w-0 flex-1 basis-56`}
        />
        <div
          role="group"
          aria-label={t('creator.needs.objectiveDialog.regulatory.scopeLabel')}
          className={segmentedControl}
        >
          {scopes.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={scope === value ? segmentedOptionActive : segmentedOptionIdle}
            >
              {t(`creator.needs.objectiveDialog.regulatory.scope.${value}`, {
                count: value === 'selected' ? selected.length : undefined,
              })}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea
        label={legend}
        maxClass="max-h-72"
        className="rounded-sm border border-panel-line"
      >
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-28" />
            <col className="w-36" />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-paper-surface-raised text-xs text-paper-ink/60 dark:bg-surface-raised dark:text-fg-faint">
            <tr className="border-b border-panel-line">
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">
                  {t('creator.needs.objectiveDialog.regulatory.columns.selected')}
                </span>
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('creator.needs.objectiveDialog.regulatory.columns.framework')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('creator.needs.objectiveDialog.regulatory.columns.reference')}
              </th>
              <th scope="col" className="px-2 py-2 pr-3 font-medium">
                {t('creator.needs.objectiveDialog.regulatory.columns.description')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-line">
            {shown.map((row) => {
              const checked = selected.includes(row.id)
              return (
                <tr
                  key={row.id}
                  onClick={() => toggle(row.id)}
                  className="cursor-pointer align-top transition-colors hover:bg-hover motion-reduce:transition-none"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={`${row.label} ${row.reference}`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggle(row.id)}
                      className="mt-0.5 h-4 w-4 accent-accent-fg"
                    />
                  </td>
                  <td className="px-2 py-2 text-paper-ink/70 dark:text-fg-muted">{row.label}</td>
                  <td className={`px-2 py-2 ${checked ? 'font-medium' : ''}`}>{row.reference}</td>
                  <td className="px-2 py-2 pr-3 text-paper-ink/80 dark:text-fg-nav">
                    {row.description}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-paper-ink/60 dark:text-fg-faint">
                  {needle
                    ? t('creator.needs.objectiveDialog.regulatory.noMatch', { query: query.trim() })
                    : scope === 'selected'
                      ? t('creator.needs.objectiveDialog.regulatory.noneSelected')
                      : t('creator.needs.objectiveDialog.regulatory.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </fieldset>
  )
}
