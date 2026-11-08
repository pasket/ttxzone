import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlaceName } from '../../hooks/usePlaceName'
import { useStageRoom } from '../../hooks/useViewedRoom'
import { ApiError, apiFetch } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import { pollLetter } from '../../lib/msel'
import type { RunPoll, RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import { METER_LEVEL_KEYS } from '../creator/msel/meterLevels'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 6

/** The options with their tally: a bar per option, monochrome (a vote is
 * not a state). `mine` marks the viewer's own vote. A planned poll's result
 * reads ranked, the leader in a stronger weight, with its share. */
function Tally({ poll }: { poll: RunPoll }) {
  const { t } = useTranslation()
  const rows = poll.options.map((option, index) => ({ ...option, index }))
  if (poll.planned) rows.sort((a, b) => b.votes - a.votes)
  const most = Math.max(...poll.options.map((option) => option.votes))
  return (
    <ul className="space-y-1.5">
      {rows.map((option) => {
        const share = poll.voters ? Math.round((option.votes / poll.voters) * 100) : 0
        const mine = poll.my_vote === option.index
        const leads = Boolean(poll.planned) && most > 0 && option.votes === most
        return (
          <li key={option.index} className="space-y-0.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className={mine || leads ? 'font-semibold' : ''}>
                {poll.planned && <OptionLetter index={option.index} />}
                {option.text}
                {mine && (
                  <span className="ml-2 text-xs text-paper-ink/60 dark:text-fg-muted">
                    ✓ {t('playground.polls.yourVote')}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-paper-ink/70 dark:text-fg-muted">
                {poll.planned && `${share}% · `}
                {t('playground.polls.votes', { count: option.votes })}
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 rounded-xs bg-paper-line dark:bg-line">
              <div
                className={`h-full rounded-xs ${
                  leads ? 'bg-paper-ink dark:bg-fg' : 'bg-paper-ink/60 dark:bg-fg-muted'
                }`}
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function OptionLetter({ index }: { index: number }) {
  return (
    <span aria-hidden="true" className="mr-2 font-mono opacity-70">
      {pollLetter(index)}
    </span>
  )
}

/** The options alone, while the screen can't show the tally. */
function OptionList({ poll }: { poll: RunPoll }) {
  return (
    <ol className="space-y-1.5 text-sm">
      {poll.options.map((option, index) => (
        <li key={index}>
          <OptionLetter index={index} />
          {option.text}
        </li>
      ))}
    </ol>
  )
}

/** A vote's heading line: the inject it's on and (in rooms) where. Never an
 * MSEL code for the Players or on the room's screen. */
function PollMeta({
  run,
  poll,
  showCode = true,
}: {
  run: RunRead
  poll: RunPoll
  showCode?: boolean
}) {
  const { t } = useTranslation()
  const place = usePlaceName(run)(poll.room_code)
  const title = run.injects.find((inject) => inject.code === poll.inject_code)?.title ?? ''
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper-ink/60 dark:text-fg-muted">
      {showCode ? <CodeRef code={poll.inject_code} title={title} /> : title && <span>{title}</span>}
      {place && <span>· {place}</span>}
      <span>· {t('playground.polls.voters', { count: poll.voters })}</span>
    </p>
  )
}

/** A planned poll's result, closed: the Controller's choice to show it to
 * the Players or not, and where it stands. */
function PollResultsControl({
  poll,
  role,
  pending,
  onToggle,
}: {
  poll: RunPoll
  role: ContextRole | null
  pending: boolean
  onToggle: (shown: boolean) => void
}) {
  const { t } = useTranslation()
  if (!poll.planned || poll.open || role === 'player') return null
  const visible = poll.results_visible !== false
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
        {visible ? t('playground.polls.resultShown') : t('playground.polls.resultTeamOnly')}
      </p>
      {role === 'controller' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onToggle(!visible)}
          className={visible ? btnSecondary : btnPrimary}
        >
          {visible ? t('playground.polls.hideResult') : t('playground.polls.showResult')}
        </button>
      )}
    </div>
  )
}

/** The Controller shows or hides a planned poll's result. */
function usePollResults(ttxId: string, onChange: (next: RunRead) => void) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function toggle(poll: RunPoll, shown: boolean) {
    setPending(true)
    setError(null)
    try {
      onChange(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run/polls/${poll.id}/results?as=controller`, {
          method: 'POST',
          body: JSON.stringify({ shown }),
        }),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setPending(false)
    }
  }
  return { pending, error, toggle }
}

/** What follows the option the vote settled on. */
function PollOutcome({ poll }: { poll: RunPoll }) {
  const { t } = useTranslation()
  if (!poll.outcome) return null
  const option = poll.options[poll.outcome_option ?? -1]
  return (
    <div className="space-y-1 rounded-sm border border-panel-line p-3">
      <p className="text-xs font-semibold tracking-wide text-paper-ink/60 uppercase dark:text-fg-muted">
        {t('playground.polls.outcome')}
      </p>
      {option && <p className="text-sm font-semibold">{option.text}</p>}
      <p className="text-sm whitespace-pre-line">{poll.outcome}</p>
    </div>
  )
}

/** What a viewer may read of a vote's result. A Player's copy of a hidden
 * one has no tally to show; on the room's screen the team's has, and it
 * must stay off it until the Controller shows it. */
function showsTally(poll: RunPoll, role: ContextRole | null, presenting: boolean): boolean {
  return poll.results_visible !== false || (role !== 'player' && !presenting)
}

/** A closed vote and how it went. */
export function PollResult({
  ttxId,
  run,
  poll,
  role,
  onChange,
}: {
  ttxId: string
  run: RunRead
  poll: RunPoll
  role: ContextRole
  onChange: (next: RunRead) => void
}) {
  const { t } = useTranslation()
  const results = usePollResults(ttxId, onChange)
  return (
    <div className="space-y-2 rounded-sm border border-panel-line p-3">
      <p className="text-sm font-semibold">{poll.question}</p>
      <PollMeta run={run} poll={poll} showCode={role !== 'player'} />
      {showsTally(poll, role, false) ? (
        <>
          <Tally poll={poll} />
          <PollOutcome poll={poll} />
        </>
      ) : (
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {t('playground.polls.resultPending')}
        </p>
      )}
      {poll.decision_id && (
        <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
          {t('playground.polls.recorded')}
        </p>
      )}
      <PollResultsControl
        poll={poll}
        role={role}
        pending={results.pending}
        onToggle={(shown) => void results.toggle(poll, shown)}
      />
      {results.error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {results.error}
        </p>
      )}
    </div>
  )
}

/** The votes on the stage, under the inject: a Player picks an option (and
 * may change it while it's open), never seeing who voted. The Facilitator
 * and the Controller close it, recording an option as the table's decision
 * if they want. Several can be open at once, each with its own card. In
 * rooms, each place sees its own.
 *
 * A planned poll (one of the MSEL) stays on the stage once closed, while
 * its inject is in play: its result reaches the Players, and the room's
 * screen, only when the Controller shows it. Everyone sees the tally of a
 * vote put on the spot. */
export function PollCard({
  ttxId,
  run,
  role,
  inPlayCode,
  presenting,
  showCodes,
  onChange,
}: {
  ttxId: string
  run: RunRead
  role: ContextRole | null
  /** The inject in play where the viewer looks. */
  inPlayCode: string | null
  presenting: boolean
  showCodes: boolean
  onChange: (next: RunRead) => void
}) {
  const { t } = useTranslation()
  const where = useStageRoom(run.rooms)
  const results = usePollResults(ttxId, onChange)
  const [pending, setPending] = useState<string | null>(null)
  // The failure of the last action, on the vote it was about.
  const [error, setError] = useState<{ poll: string; message: string } | null>(null)
  // The vote being closed, by id: its dialog keeps up with the votes.
  const [closingId, setClosingId] = useState<string | null>(null)
  const closing = run.polls?.find((poll) => poll.id === closingId)
  const player = role === 'player'
  const moderates = role === 'facilitator' || role === 'controller'
  const shown = (run.polls ?? []).filter(
    (poll) =>
      (!run.rooms || poll.room_code === where) &&
      (poll.open || (poll.planned && poll.inject_code === inPlayCode)),
  )
  if (!role || shown.length === 0) return null

  async function send(key: string, path: string, body: unknown): Promise<boolean> {
    setPending(key)
    setError(null)
    try {
      onChange(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run/polls/${path}?as=${role}`, {
          method: path.endsWith('/vote') ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      )
      return true
    } catch (err) {
      setError({
        poll: key,
        message: err instanceof ApiError ? err.message : t('auth.common.genericError'),
      })
      return false
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      {shown.map((poll) => (
        <Panel key={poll.id} label={poll.question}>
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-paper-ink/60 uppercase dark:text-fg-muted">
              {t(poll.planned ? 'playground.polls.pollEyebrow' : 'playground.polls.eyebrow')}
            </p>
            <p className="text-lg font-semibold text-balance">{poll.question}</p>
            <PollMeta run={run} poll={poll} showCode={showCodes} />
            {player && poll.open && (
              <div
                role="group"
                aria-label={poll.question}
                className={poll.planned ? 'grid gap-2' : 'flex flex-wrap gap-2'}
              >
                {poll.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={poll.my_vote === index}
                    disabled={pending !== null || run.state !== 'live'}
                    onClick={() => void send(poll.id, `${poll.id}/vote`, { option: index })}
                    className={`${poll.my_vote === index ? btnPrimary : btnSecondary} ${
                      poll.planned ? 'min-h-11 w-full justify-start text-left' : ''
                    }`}
                  >
                    {poll.planned && <OptionLetter index={index} />}
                    {option.text}
                  </button>
                ))}
              </div>
            )}
            {showsTally(poll, role, presenting) ? (
              <>
                <Tally poll={poll} />
                <PollOutcome poll={poll} />
              </>
            ) : (
              !player && poll.open && <OptionList poll={poll} />
            )}
            {!poll.open && !showsTally(poll, role, presenting) && (
              <>
                {presenting && <OptionList poll={poll} />}
                <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
                  {t('playground.polls.resultPending')}
                </p>
              </>
            )}
            {error?.poll === poll.id && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error.message}
              </p>
            )}
            {moderates && poll.open && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => setClosingId(poll.id)}
                  className={btnSecondary}
                >
                  {t('playground.polls.close')}
                </button>
              </div>
            )}
            <PollResultsControl
              poll={poll}
              role={role}
              pending={results.pending}
              onToggle={(next) => void results.toggle(poll, next)}
            />
            {results.error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {results.error}
              </p>
            )}
          </div>
        </Panel>
      ))}
      {closing && (
        <ClosePollDialog
          poll={closing}
          pending={pending === closing.id}
          error={error?.poll === closing.id ? error.message : null}
          onClose={() => setClosingId(null)}
          onConfirm={async (record, outcome) => {
            const ok = await send(closing.id, `${closing.id}/close`, {
              record_option: record,
              outcome_option: outcome,
            })
            if (ok) setClosingId(null)
          }}
        />
      )}
    </>
  )
}

/** Closing a vote: record an option (the leading one by default, none on a
 * planned poll) as the table's decision, or none. A poll that says what
 * follows its options also asks which one the table settled on: the leading
 * one by default, for a tie or a vote that doesn't reflect the table. Until
 * the person picks, the defaults follow the votes still arriving. */
function ClosePollDialog({
  poll,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  poll: RunPoll
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: (record: number | null, outcome: number | null) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const most = Math.max(...poll.options.map((o) => o.votes))
  const leading = most > 0 ? poll.options.findIndex((o) => o.votes === most) : null
  const hasOutcomes = poll.options.some((option) => option.outcome || option.impacts?.length)
  const [pickedRecord, setRecord] = useState<number | null>()
  const [pickedOutcome, setOutcome] = useState<number | null>()
  // A decision reaches the Players: on a planned poll, only if asked for.
  const record = pickedRecord === undefined ? (poll.planned ? null : leading) : pickedRecord
  const outcome = pickedOutcome === undefined ? (hasOutcomes ? leading : null) : pickedOutcome
  const choices: { value: number | null; label: string }[] = [
    ...poll.options.map((option, index) => ({
      value: index,
      label: `${option.text} (${t('playground.polls.votes', { count: option.votes })})`,
    })),
    { value: null, label: t('playground.polls.recordNone') },
  ]
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm(record, outcome)
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.polls.closeTitle')}
        </h2>
        <p className="text-sm font-semibold">{poll.question}</p>
        {hasOutcomes && (
          <fieldset className="space-y-2">
            <legend className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('playground.polls.outcomeChoice')}
            </legend>
            {poll.options.map((option, index) => (
              <label key={index} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={`${titleId}-outcome`}
                  checked={outcome === index}
                  onChange={() => setOutcome(index)}
                  className="mt-0.5 h-4 w-4 accent-accent-fg"
                />
                <span>
                  {option.text} ({t('playground.polls.votes', { count: option.votes })})
                  {option.outcome && (
                    <span className="block text-xs text-paper-ink/60 dark:text-fg-muted">
                      {option.outcome}
                    </span>
                  )}
                  {Boolean(option.impacts?.length) && (
                    <span className="block text-xs text-paper-ink/60 dark:text-fg-muted">
                      {option.impacts
                        ?.map(({ name, level }) => `${name}: ${t(METER_LEVEL_KEYS[level])}`)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${titleId}-outcome`}
                checked={outcome === null}
                onChange={() => setOutcome(null)}
                className="h-4 w-4 accent-accent-fg"
              />
              {t('playground.polls.outcomeNone')}
            </label>
          </fieldset>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('playground.polls.recordAs')}
          </legend>
          {choices.map((choice) => (
            <label key={choice.value ?? 'none'} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${titleId}-record`}
                checked={record === choice.value}
                onChange={() => setRecord(choice.value)}
                className="h-4 w-4 accent-accent-fg"
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
        {poll.planned && (
          <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-muted">
            {t('playground.polls.recordReveals')}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? <ButtonSpinner /> : t('playground.polls.close')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** A question for the Players' vote, with two to six options. */
export function PollDialog({
  pending,
  error,
  onClose,
  onOpen,
}: {
  pending: boolean
  error?: string | null
  onClose: () => void
  onOpen: (question: string, options: string[]) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const filled = options.map((o) => o.trim()).filter(Boolean)
  const ready = question.trim() && filled.length >= MIN_OPTIONS
  return (
    <Modal titleId={titleId} onClose={onClose} size="lg">
      <form
        className="space-y-3 p-6"
        onSubmit={(event) => {
          event.preventDefault()
          onOpen(question.trim(), filled)
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.polls.openTitle')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.polls.openDescription')}
        </p>
        <label htmlFor={`${titleId}-question`} className="block text-sm">
          {t('playground.polls.question')}
        </label>
        <input
          name={`${titleId}-question`}
          autoComplete="off"
          id={`${titleId}-question`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          required
          className={inputBase}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm">{t('playground.polls.options')}</legend>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                name={`${titleId}-option-${index}`}
                autoComplete="off"
                aria-label={t('playground.polls.option', { number: index + 1 })}
                value={option}
                onChange={(e) =>
                  setOptions(options.map((o, i) => (i === index ? e.target.value : o)))
                }
                maxLength={200}
                className={inputBase}
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, i) => i !== index))}
                  className={btnSecondary}
                  aria-label={t('playground.polls.removeOption', { number: index + 1 })}
                >
                  −
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => setOptions([...options, ''])}
              className={btnSecondary}
            >
              {t('playground.polls.addOption')}
            </button>
          )}
        </fieldset>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button type="submit" disabled={pending || !ready} className={btnPrimary}>
            {pending ? <ButtonSpinner /> : t('playground.polls.openConfirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
