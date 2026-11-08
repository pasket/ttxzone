import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeRef } from './CodeRef'
import { HelpText } from './HelpText'
import type { ExpectedNotification } from '../../lib/types'

const mutedClass = 'text-xs text-paper-ink/60 dark:text-fg-faint'

/** The notifications the team should recognise during the session, one
 * group per regime (a cited notification requirement) and a row per
 * report: what, to whom, by when and from what moment. Nothing to manage:
 * it's derived from the requirements the objectives cite.
 *
 * `design` (the needs analysis) says where it comes from and how to drop a
 * regime; `observe` (the EEG for Evaluators and Control) says what to note
 * -- the clock is simulated, so whether the team recognises each report,
 * not whether it meets it. */
export function NotificationReference({
  notifications,
  variant,
}: {
  notifications: ExpectedNotification[]
  variant: 'design' | 'observe'
}) {
  const { t, i18n } = useTranslation()
  const headingId = useId()
  const spanish = i18n.language.startsWith('es')
  if (notifications.length === 0) return null
  const pick = <K extends string>(record: Record<`${K}_en` | `${K}_es`, string>, key: K) =>
    spanish ? record[`${key}_es`] : record[`${key}_en`]

  return (
    // Its own framed panel: a header band (title, count, description and,
    // for observers, what to check) over the table, flush inside the frame.
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-sm border border-panel-line bg-panel"
    >
      <header className="space-y-2 border-b border-panel-line bg-paper-ink/[0.03] px-4 py-3 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id={headingId} className="text-base font-semibold">
            {t('common.notifications.title')}
          </h3>
          <span className={mutedClass}>
            {t('common.notifications.count', { count: notifications.length })}
          </span>
        </div>
        {/* The page descriptions' fold: full width, one line once seen. */}
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText
            id={`common.notifications.intro.${variant}`}
            text={t(`common.notifications.intro.${variant}`)}
          />
        </p>
        {variant === 'observe' && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {(['identified', 'deadline', 'clock', 'owner'] as const).map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
                />
                {t(`common.notifications.observe.${item}`)}
              </li>
            ))}
          </ul>
        )}
      </header>
      <div>
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col />
            <col className="w-24 sm:w-32" />
            <col className="w-[34%]" />
          </colgroup>
          <thead>
            <tr className={`border-b border-panel-line ${mutedClass}`}>
              <th scope="col" className="px-4 py-2 font-medium">
                {t('common.notifications.columns.report')}
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                {t('common.notifications.columns.deadline')}
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                {t('common.notifications.columns.clock')}
              </th>
            </tr>
          </thead>
          {notifications.map((item) => (
            <tbody key={item.requirement_id} className="divide-y divide-panel-line">
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="bg-paper-ink/[0.05] px-4 py-2 text-left font-normal dark:bg-white/[0.07]"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0">
                      <span className="font-semibold">
                        {pick(item, 'framework_label')} {item.reference}
                      </span>
                      <span className={`block ${mutedClass}`}>{pick(item, 'description')}</span>
                    </span>
                    <span className={`flex flex-wrap items-baseline gap-x-2 ${mutedClass}`}>
                      {t('common.notifications.citedBy')}
                      {item.objective_codes.map((code) => (
                        <CodeRef key={code} code={code} title="" />
                      ))}
                    </span>
                  </span>
                </th>
              </tr>
              {item.milestones.map((milestone) => (
                <tr key={milestone.stage_en} className="align-top">
                  <td className="px-4 py-2">
                    <span className="block break-words">{pick(milestone, 'stage')}</span>
                    <span className={`block break-words ${mutedClass}`}>
                      {pick(milestone, 'recipient')}
                    </span>
                  </td>
                  {/* Same size as its row; a figure ("24 h") just lines up. */}
                  <td className="px-4 py-2 font-medium tabular-nums break-words">
                    {pick(milestone, 'deadline')}
                  </td>
                  <td className="px-4 py-2 break-words text-paper-ink/80 dark:text-fg-nav">
                    {pick(milestone, 'clock')}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}
