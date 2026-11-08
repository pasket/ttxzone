import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../../hooks/useAuth'
import { btnPrimary, btnSecondary } from '../../../lib/buttonStyles'
import { contentLanguage } from '../../../lib/injectLibrary'
import { CAPABILITIES } from '../../../lib/needsForm'
import { objectiveTemplateText, riskTemplateText } from '../../../lib/needsLibrary'
import type {
  Capability,
  ObjectiveCatalog,
  ObjectiveTemplate,
  RiskCatalog,
  RiskCategory,
} from '../../../lib/types'
import { Modal } from '../../common/Modal'

const RISK_CATEGORIES: RiskCategory[] = [
  'confidentiality',
  'people',
  'operations',
  'logistics',
  'conduct',
]

const RISK_CATEGORY_KEYS = {
  confidentiality: 'creator.needs.library.riskCategories.confidentiality',
  people: 'creator.needs.library.riskCategories.people',
  operations: 'creator.needs.library.riskCategories.operations',
  logistics: 'creator.needs.library.riskCategories.logistics',
  conduct: 'creator.needs.library.riskCategories.conduct',
} as const

/** The language library text is copied in: the exercise's content
 * language, else the UI's -- like a TTX-Zone inject copied into the MSEL. */
function useCopyLanguage(): 'en' | 'es' {
  const { i18n } = useTranslation()
  const { activeTtx } = useAuth()
  return contentLanguage(activeTtx?.content_language, i18n.language)
}

/** "Add from the library" in the Objectives step: TTX-Zone's SMART
 * objective templates for the capabilities ticked in "Capabilities to
 * evaluate", one picked at a time. The pick opens the objective dialog
 * prefilled (still to be linked to a need), so nothing reaches the form
 * without the Planner seeing it. */
export function ObjectiveLibraryDialog({
  capabilities,
  onPick,
  onClose,
}: {
  capabilities: Capability[]
  onPick: (template: ObjectiveTemplate, lang: 'en' | 'es') => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const lang = useCopyLanguage()
  const catalog = useApiResource<ObjectiveCatalog>('/objective-catalog')
  const [picked, setPicked] = useState<string | null>(null)
  const groups = CAPABILITIES.filter((value) => capabilities.includes(value)).map((value) => ({
    capability: value,
    items: (catalog.data?.items ?? []).filter((item) => item.capability === value),
  }))
  const template = catalog.data?.items.find((item) => item.id === picked) ?? null

  return (
    <Modal titleId="objective-library-title" onClose={onClose} size="lg" align="top">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (template) onPick(template, lang)
        }}
      >
        <div className="space-y-1">
          <h2 id="objective-library-title" className="text-lg font-semibold tracking-tight">
            {t('creator.needs.library.objectivesTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.needs.library.objectivesDescription')}
          </p>
        </div>
        {catalog.error ? (
          <p role="alert" className="text-sm text-danger-fg">
            {catalog.error.message}
          </p>
        ) : !catalog.data ? (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('common.loading')}</p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <fieldset key={group.capability} className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-faint">
                  {t(`creator.needs.capabilities.${group.capability}`)}
                </legend>
                {group.items.map((item) => {
                  const text = objectiveTemplateText(item, lang)
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer gap-3 rounded-sm border px-3 py-2 ${picked === item.id ? 'border-accent' : 'border-paper-line dark:border-line'}`}
                    >
                      <input
                        type="radio"
                        name="objective-template"
                        value={item.id}
                        checked={picked === item.id}
                        onChange={() => setPicked(item.id)}
                        className="mt-1 accent-accent-fg"
                      />
                      <span className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-medium">{text.title}</span>
                        <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                          {text.statement}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            ))}
          </div>
        )}
        <div className="sticky -bottom-4 -mx-4 -mb-4 flex justify-end gap-2 border-t border-paper-line bg-paper-surface-raised px-4 py-3 dark:border-line dark:bg-surface-raised">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={!template} className={btnPrimary}>
            {t('creator.needs.library.useObjective')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** "Add from the library" in the Risks step: tick any number of TTX-Zone's
 * exercise risks; each becomes a row of the form, editable as usual. A
 * risk whose text is already in the form is shown ticked and disabled. */
export function RiskLibraryDialog({
  existing,
  onAdd,
  onClose,
}: {
  existing: string[]
  onAdd: (rows: { risk: string; mitigation: string }[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const lang = useCopyLanguage()
  const catalog = useApiResource<RiskCatalog>('/risk-catalog')
  const [picked, setPicked] = useState<string[]>([])
  const present = new Set(existing.map((text) => text.trim().toLowerCase()))
  const items = catalog.data?.items ?? []

  return (
    <Modal titleId="risk-library-title" onClose={onClose} size="lg" align="top">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onAdd(
            items
              .filter((item) => picked.includes(item.id))
              .map((item) => riskTemplateText(item, lang)),
          )
        }}
      >
        <div className="space-y-1">
          <h2 id="risk-library-title" className="text-lg font-semibold tracking-tight">
            {t('creator.needs.library.risksTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.needs.library.risksDescription')}
          </p>
        </div>
        {catalog.error ? (
          <p role="alert" className="text-sm text-danger-fg">
            {catalog.error.message}
          </p>
        ) : !catalog.data ? (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('common.loading')}</p>
        ) : (
          <div className="space-y-5">
            {RISK_CATEGORIES.map((category) => (
              <fieldset key={category} className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-faint">
                  {t(RISK_CATEGORY_KEYS[category])}
                </legend>
                {items
                  .filter((item) => item.category === category)
                  .map((item) => {
                    const text = riskTemplateText(item, lang)
                    const already = present.has(text.risk.trim().toLowerCase())
                    return (
                      <label
                        key={item.id}
                        className={`flex gap-3 rounded-sm border border-paper-line px-3 py-2 dark:border-line ${already ? 'opacity-60' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={already || picked.includes(item.id)}
                          disabled={already}
                          onChange={(event) =>
                            setPicked((prev) =>
                              event.target.checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id),
                            )
                          }
                          className="mt-1 accent-accent-fg"
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block text-sm font-medium">
                            {text.risk}
                            {already && (
                              <span className="ml-2 text-xs font-normal text-paper-ink/60 dark:text-fg-faint">
                                {t('creator.needs.library.alreadyAdded')}
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                            {text.mitigation}
                          </span>
                        </span>
                      </label>
                    )
                  })}
              </fieldset>
            ))}
          </div>
        )}
        <div className="sticky -bottom-4 -mx-4 -mb-4 flex justify-end gap-2 border-t border-paper-line bg-paper-surface-raised px-4 py-3 dark:border-line dark:bg-surface-raised">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={picked.length === 0} className={btnPrimary}>
            {t('creator.needs.library.addRisks', { count: picked.length })}
          </button>
        </div>
      </form>
    </Modal>
  )
}
