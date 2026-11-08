import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { API_BASE, apiFetch } from '../../lib/api'
import { btnSecondary } from '../../lib/buttonStyles'
import type { RunPast } from '../../lib/types'
import { Panel } from '../common/Panel'

const LOGS = [
  ['log.pdf', 'logPdf'],
  ['log.csv', 'logCsv'],
] as const

/** The exercise's previous runs (archived by a restart), latest first:
 * when each ran, how it ended, and its execution log to download. For the
 * ones who read the session summary; renders nothing for anyone else, or
 * when there are none. `reload` changes when a restart may have added one. */
export function PastRuns({ ttxId, reload }: { ttxId: string; reload: string }) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const [runs, setRuns] = useState<RunPast[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<{ items: RunPast[] }>(`/ttx/${ttxId}/run/history`)
        if (!cancelled) setRuns(result.items)
      } catch {
        if (!cancelled) setRuns([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, reload])

  if (runs.length === 0) return null
  const lang = i18n.language.slice(0, 2)
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Panel title={t('playground.history.title')} flush>
      <ul className="divide-y divide-panel-line text-sm">
        {runs.map((run) => (
          <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{t('playground.history.run', { number: run.number })}</p>
              <p className="text-paper-ink/60 dark:text-fg-muted">
                {[
                  when.format(new Date(run.started_at)),
                  t(
                    run.state === 'stopped'
                      ? 'playground.history.stopped'
                      : 'playground.history.ended',
                  ),
                  run.has_report && t('playground.history.report'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {run.stop_reason && <p className="text-danger-fg">{run.stop_reason}</p>}
            </div>
            <div
              role="group"
              aria-label={t('playground.history.downloads', { number: run.number })}
              className="flex gap-2"
            >
              {LOGS.map(([name, key]) => {
                const path = `/ttx/${ttxId}/run/export/${name}?lang=${lang}&run=${run.id}`
                return (
                  <a
                    key={name}
                    href={`${API_BASE}${path}`}
                    download
                    onClick={download(path)}
                    className={`${btnSecondary} inline-flex h-8 items-center py-0 text-xs`}
                  >
                    {t(`playground.downloads.${key}`)}
                  </a>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
