import type { MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { AAR_ANCHORS } from '../../lib/aar'
import type { AarRead } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'

const itemClass =
  'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm text-paper-ink/80 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-fg dark:text-fg-nav'

/** The report's index: one link per part -- the summary, each objective,
 * the improvement plan, the conclusions, what came from the session --
 * with where each stands (written or empty, the level given, how many
 * actions). The page stays one document: a link scrolls to its part and
 * hands it the focus. A column beside the report from `lg`, a row that
 * scrolls sideways above it below that. */
export function AarIndex({ report, withSession }: { report: AarRead; withSession: boolean }) {
  const { t } = useTranslation()

  const written = (text: string) =>
    text.trim() ? (
      <Mark tone="done" glyph="✓" label={t('aar.index.written')} />
    ) : (
      <Mark tone="todo" label={t('aar.index.empty')} />
    )

  function go(event: MouseEvent, id: string) {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView?.({ block: 'start' })
    target.focus({ preventScroll: true })
  }

  const link = (id: string, label: ReactNode, mark: ReactNode, nested = false) => (
    <li key={id} className="shrink-0">
      <a
        href={`#${id}`}
        onClick={(event) => go(event, id)}
        className={`${itemClass} ${nested ? 'max-w-[16rem] lg:max-w-none lg:pl-6' : ''}`}
      >
        <span className="min-w-0">{label}</span>
        {mark}
      </a>
    </li>
  )

  return (
    <nav aria-label={t('aar.index.label')}>
      <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {link(
          AAR_ANCHORS.summary,
          t('aar.summary'),
          written(report.executive_summary + report.scenario_summary),
        )}
        {link(AAR_ANCHORS.objectives, t('aar.objectives'), null)}
        {report.objectives.map((objective) =>
          link(
            AAR_ANCHORS.objective(objective.id),
            <CodeRef
              code={objective.objective_code}
              title={objective.title}
              variant="stacked"
              wrap
            />,
            objective.overall ? (
              <Mark
                tone="done"
                glyph={objective.overall}
                label={t('aar.index.level', { level: objective.overall })}
              />
            ) : (
              <Mark tone="todo" label={t('aar.index.noLevel')} />
            ),
            true,
          ),
        )}
        {link(
          AAR_ANCHORS.plan,
          t('aar.plan'),
          <span className="shrink-0 text-xs tabular-nums text-paper-ink/70 dark:text-fg-muted">
            <span aria-hidden="true">{report.actions.length}</span>
            <span className="sr-only">
              {t('aar.index.actions', { count: report.actions.length })}
            </span>
          </span>,
        )}
        {link(AAR_ANCHORS.conclusions, t('aar.conclusions'), written(report.conclusions))}
        {withSession && link(AAR_ANCHORS.session, t('aar.fromSession.title'), null)}
      </ol>
    </nav>
  )
}

/** Where a part stands: a green tick or level once it has what it needs,
 * a hollow dot while it waits. The words are for whoever doesn't see it. */
function Mark({ tone, glyph, label }: { tone: 'done' | 'todo'; glyph?: string; label: string }) {
  return (
    <span title={label} className="flex w-4 shrink-0 justify-center">
      {tone === 'done' ? (
        <span aria-hidden="true" className="font-mono text-sm font-semibold text-success-fg">
          {glyph}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-2 rounded-full border border-paper-ink/40 dark:border-fg-faint"
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
