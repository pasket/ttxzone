import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch } from '../../lib/api'
import type { RunFeedbackResults } from '../../lib/types'

const muted = 'text-paper-ink/60 dark:text-fg-muted'

/** What the participants answered, together and unsigned: per statement
 * the average and how many gave each score, the open answers shuffled.
 * Under the minimum number of answers, only how many there are. */
export function FeedbackResults({
  ttxId,
  seq,
  runId,
}: {
  ttxId: string
  seq: number
  /** One of the exercise's runs (a report's); else the current one. */
  runId?: string
}) {
  const { t } = useTranslation()
  const [results, setResults] = useState<RunFeedbackResults | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<RunFeedbackResults>(
          `/ttx/${ttxId}/run/feedback/results${runId ? `?run=${runId}` : ''}`,
        )
        if (!cancelled) setResults(result)
      } catch {
        if (!cancelled) setResults(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, seq, runId])

  if (!results) return null
  return (
    <section aria-label={t('playground.feedback.results')} className="space-y-2">
      <h3 className="font-semibold">{t('playground.feedback.results')}</h3>
      <p className={muted}>
        {t('playground.feedback.count', {
          count: results.responses,
          players: results.players,
          team: results.team,
        })}
      </p>
      {!results.shown ? (
        results.responses > 0 && (
          <p className={muted}>{t('playground.feedback.tooFew', { minimum: results.minimum })}</p>
        )
      ) : (
        <>
          <ul className="space-y-1">
            {results.statements.map((statement) => (
              <li key={statement.key} className="flex justify-between gap-3">
                <span>{statement.text}</span>
                <span className={`shrink-0 font-mono ${muted}`}>
                  {statement.average !== null
                    ? `${statement.average.toFixed(1)} · n=${statement.n}`
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
          {results.open_questions.map((question) =>
            (results.answers[question.key] ?? []).length > 0 ? (
              <div key={question.key} className="space-y-1">
                <h4 className="text-sm font-medium">{question.text}</h4>
                <ul className="list-disc space-y-0.5 pl-5">
                  {results.answers[question.key].map((answer, index) => (
                    <li key={index} className="whitespace-pre-wrap">
                      {answer}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </>
      )}
    </section>
  )
}
