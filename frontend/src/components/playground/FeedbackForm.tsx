import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../lib/api'
import { btnPrimary, inputBase } from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import type { RunFeedbackForm } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'

const SCORES = [1, 2, 3, 4, 5]

/** The participant feedback form, once the session is over: each
 * statement rated 1-5 (all optional) and four open questions. Answered
 * once, anonymously -- the team sees only the answers together. */
export function FeedbackForm({ ttxId, role }: { ttxId: string; role: ContextRole }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<RunFeedbackForm | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<RunFeedbackForm>(`/ttx/${ttxId}/run/feedback`)
        if (!cancelled) setForm(result)
      } catch {
        if (!cancelled) setForm(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId])

  if (!form || !form.available) return null
  if (form.submitted || sent) {
    return (
      <Panel title={t('playground.feedback.title')}>
        <p role="status" className="text-sm">
          {t('playground.feedback.thanks')}
        </p>
      </Panel>
    )
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${ttxId}/run/feedback?as=${role}`, {
        method: 'POST',
        body: JSON.stringify({ scores, answers }),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={send}>
      <Panel
        title={t('playground.feedback.title')}
        description={`${form.intro} ${t('playground.feedback.anonymous')}`}
        footer={
          <div className="flex justify-end">
            <button type="submit" disabled={sending} className={btnPrimary}>
              {sending ? <ButtonSpinner /> : t('playground.feedback.send')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {form.statements.map((statement) => (
            <fieldset key={statement.key} className="space-y-1">
              <legend className="text-sm">{statement.text}</legend>
              <div className="flex gap-1.5">
                {SCORES.map((score) => (
                  <label
                    key={score}
                    className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-sm border text-sm ${
                      scores[statement.key] === score
                        ? 'border-accent bg-accent font-semibold text-ink'
                        : 'border-panel-line hover:border-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`score-${statement.key}`}
                      value={score}
                      checked={scores[statement.key] === score}
                      onChange={() => setScores({ ...scores, [statement.key]: score })}
                      className="sr-only"
                    />
                    {score}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {form.open_questions.map((question) => (
            <div key={question.key} className="space-y-1">
              <label htmlFor={`feedback-${question.key}`} className="block text-sm">
                {question.text}
              </label>
              <textarea
                name={`feedback-${question.key}`}
                autoComplete="off"
                id={`feedback-${question.key}`}
                rows={3}
                maxLength={2000}
                value={answers[question.key] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [question.key]: e.target.value })}
                className={inputBase}
              />
            </div>
          ))}
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </Panel>
    </form>
  )
}
