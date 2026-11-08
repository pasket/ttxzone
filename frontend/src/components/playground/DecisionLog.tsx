import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlaceName } from '../../hooks/usePlaceName'
import { useStageRoom } from '../../hooks/useViewedRoom'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { ApiError, apiFetch } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { RunDecision, RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { PollDialog, PollResult } from './PollCard'

/** Who records the table's decisions, and who also changes anyone's and
 * runs the votes. */
const RECORDERS: ContextRole[] = ['player', 'facilitator', 'controller']
const MODERATORS: ContextRole[] = ['facilitator', 'controller']

/** One decision: what was decided, on which inject, where, by whom. */
export function DecisionItem({ run, decision }: { run: RunRead; decision: RunDecision }) {
  const { t, i18n } = useTranslation()
  const place = usePlaceName(run)(decision.room_code)
  const title = run.injects.find((inject) => inject.code === decision.inject_code)?.title ?? ''
  const at = new Date(decision.at).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-semibold whitespace-pre-line">{decision.text}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-paper-ink/60 dark:text-fg-muted">
        <CodeRef code={decision.inject_code} title={title} />
        {place && <span>· {place}</span>}
        <span>
          · {decision.author} ({t(CONTEXT_ROLE_LABEL_KEYS[decision.role])}) · {at}
        </span>
        {decision.poll_id && <span>· {t('playground.decisions.fromVote')}</span>}
        {decision.edited && <span>· {t('playground.decisions.edited')}</span>}
      </p>
    </div>
  )
}

/** The table's decision log: what the table decided, newest first, on
 * which inject and (in rooms) where. Players, the Facilitator and the
 * Controller record them until the session ends, hot wash included; the author, a
 * Facilitator or a Controller rewords or removes one. The Facilitator and
 * the Controller also put questions to the Players' vote; closed votes
 * are listed with their tallies. Observers and Evaluators read it. */
export function DecisionLog({
  ttxId,
  run,
  role,
  onChange,
}: {
  ttxId: string
  run: RunRead
  role: ContextRole
  onChange: (next: RunRead) => void
}) {
  const { t } = useTranslation()
  const formId = useId()
  const where = useStageRoom(run.rooms)
  const runUndoable = useUndoableAction()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  // Decisions are taken until the session ends -- the hot wash's too, after
  // ENDEX (on ENDEX).
  const playing = run.state === 'live' || run.state === 'paused'
  const records = playing && RECORDERS.includes(role)
  const moderates = MODERATORS.includes(role)
  // A team member records into the room they look at (a Player's is
  // where they are).
  const room = role === 'player' ? null : where

  async function send(key: string, path: string, init: RequestInit): Promise<boolean> {
    setPending(key)
    setError(null)
    try {
      onChange(await apiFetch<RunRead>(`/ttx/${ttxId}/run${path}?as=${role}`, init))
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      return false
    } finally {
      setPending(null)
    }
  }

  function remove(decision: RunDecision) {
    runUndoable({
      message: t('playground.decisions.removed'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setHidden((current) => new Set(current).add(decision.id)),
      onRestore: () =>
        setHidden((current) => {
          const next = new Set(current)
          next.delete(decision.id)
          return next
        }),
      onCommit: async () => {
        await send(decision.id, `/decisions/${decision.id}`, { method: 'DELETE' })
      },
    })
  }

  const decisions = (run.decisions ?? []).filter((d) => !hidden.has(d.id)).reverse()
  const closedPolls = (run.polls ?? []).filter((poll) => !poll.open).reverse()

  return (
    <Panel
      title={t('playground.decisions.title')}
      meta={t('playground.decisions.count', { count: decisions.length })}
      description={t(records ? 'playground.decisions.hint' : 'playground.decisions.readHint')}
      aside={
        moderates && playing && run.state === 'live' ? (
          <button type="button" onClick={() => setAsking(true)} className={btnSecondary}>
            {t('playground.polls.open')}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {records && (
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault()
              const ok = await send('record', '/decisions', {
                method: 'POST',
                body: JSON.stringify({ text: text.trim(), room_code: room }),
              })
              if (ok) setText('')
            }}
          >
            <label htmlFor={`${formId}-text`} className="block text-sm font-semibold">
              {t('playground.decisions.new')}
            </label>
            <textarea
              name={`${formId}-text`}
              autoComplete="off"
              id={`${formId}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t('playground.decisions.placeholder')}
              className={inputBase}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!text.trim() || pending !== null}
                className={btnPrimary}
              >
                {pending === 'record' ? <ButtonSpinner /> : t('playground.decisions.record')}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        {decisions.length === 0 ? (
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('playground.decisions.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-panel-line">
            {decisions.map((decision) => {
              const changes = records && (decision.mine || moderates)
              return (
                <li key={decision.id} className="flex items-start gap-2 py-2.5">
                  {editing?.id === decision.id ? (
                    <form
                      className="flex-1 space-y-2"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        const ok = await send(decision.id, `/decisions/${decision.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ text: editing.text.trim() }),
                        })
                        if (ok) setEditing(null)
                      }}
                    >
                      <label htmlFor={`${formId}-${decision.id}`} className="sr-only">
                        {t('playground.decisions.editLabel')}
                      </label>
                      <textarea
                        name={`${formId}-${decision.id}`}
                        autoComplete="off"
                        id={`${formId}-${decision.id}`}
                        value={editing.text}
                        onChange={(e) => setEditing({ id: decision.id, text: e.target.value })}
                        rows={2}
                        maxLength={1000}
                        className={inputBase}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className={btnSecondary}
                        >
                          {t('playground.control.cancel')}
                        </button>
                        <button
                          type="submit"
                          disabled={!editing.text.trim() || pending !== null}
                          className={btnPrimary}
                        >
                          {pending === decision.id ? (
                            <ButtonSpinner />
                          ) : (
                            t('common.confirmButton.save')
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <DecisionItem run={run} decision={decision} />
                      </div>
                      {changes && (
                        <div className="flex shrink-0 gap-1">
                          <EditButton
                            label={t('playground.decisions.editLabel')}
                            disabled={pending !== null}
                            onClick={() => setEditing({ id: decision.id, text: decision.text })}
                          />
                          <IconButton
                            label={t('playground.decisions.removeLabel')}
                            onClick={() => remove(decision)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {closedPolls.length > 0 && (
          <section aria-label={t('playground.polls.closedTitle')} className="space-y-3">
            <h3 className="text-sm font-semibold">{t('playground.polls.closedTitle')}</h3>
            {closedPolls.map((poll) => (
              <PollResult
                key={poll.id}
                ttxId={ttxId}
                run={run}
                poll={poll}
                role={role}
                onChange={onChange}
              />
            ))}
          </section>
        )}
      </div>
      {asking && (
        <PollDialog
          pending={pending === 'poll'}
          error={error}
          onClose={() => {
            setAsking(false)
            setError(null)
          }}
          onOpen={async (question, options) => {
            const ok = await send('poll', '/polls', {
              method: 'POST',
              body: JSON.stringify({ question, options, room_code: room }),
            })
            if (ok) setAsking(false)
          }}
        />
      )}
    </Panel>
  )
}
