import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStageRoom } from '../../hooks/useViewedRoom'
import {
  btnSecondary,
  inputBase,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { ENDEX_CODE, inPlayAt, phaseQuestions } from '../../lib/run'
import type { ActionMark, RunAction, RunRead } from '../../lib/types'
import { Panel } from '../common/Panel'
import type { ControlAct } from './ControlCenterPanel'

const MARKS: { mark: ActionMark; key: 'observed' | 'partial' | 'notObserved' }[] = [
  { mark: 'observed', key: 'observed' },
  { mark: 'partial', key: 'partial' },
  { mark: 'not_observed', key: 'notObserved' },
]

/** The inject in play, for the Controller: what the table is expected to
 * do about it (marked as seen, partly, or not -- a miss suggests the
 * contingent inject hanging from it) and the phase's key questions to put
 * to the table on it. */
export function InPlayPanel({
  run,
  control,
  pending,
  act,
}: {
  run: RunRead
  control: NonNullable<RunRead['control']>
  pending: string | null
  act: ControlAct
}) {
  const { t } = useTranslation()
  const inPlay = run.injects[run.injects.length - 1]
  const row = inPlay && control.injects.find((i) => i.code === inPlay.code)
  const phase = control.phases.find((p) => p.code === run.current_phase_code)
  // In rooms the questions go to the place in view, on what's in play there.
  const where = useStageRoom(run.rooms)
  const askedOn = inPlayAt(run, where)

  return (
    <Panel
      title={
        inPlay?.code === ENDEX_CODE ? (
          // Its title already starts with the code.
          inPlay.title
        ) : inPlay ? (
          <span>
            <span translate="no" className="font-mono">
              {inPlay.code}
            </span>{' '}
            {inPlay.title}
          </span>
        ) : (
          t('playground.control.inPlay')
        )
      }
      meta={inPlay ? t('playground.control.inPlay') : undefined}
    >
      {!inPlay ? (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.noInjectYet')}
        </p>
      ) : (
        <div className="space-y-6">
          {row && row.expected_actions.length > 0 && (
            <section aria-label={t('playground.control.expectedActions')} className="space-y-3">
              <h3 className="text-sm font-semibold">{t('playground.control.expectedActions')}</h3>
              {row.expected_actions.map((action) => (
                <ActionRow key={action.code} action={action} pending={pending} act={act} />
              ))}
            </section>
          )}
          {phase && askedOn && phase.key_questions.length > 0 && (
            <KeyQuestions
              key={`${phase.code}-${askedOn.code}-${where}`}
              phase={phase}
              where={where}
              injectCode={askedOn.code}
              live={run.state === 'live'}
              pending={pending}
              act={act}
            />
          )}
        </div>
      )}
    </Panel>
  )
}

function ActionRow({
  action,
  pending,
  act,
}: {
  action: RunAction
  pending: string | null
  act: ControlAct
}) {
  const { t } = useTranslation()
  const [note, setNote] = useState(action.note)
  const busy = pending === action.code
  return (
    <div className="space-y-2 rounded-sm border border-panel-line p-3">
      <p className="text-sm">
        <span translate="no" className="font-mono text-xs text-paper-ink/60 dark:text-fg-muted">
          {action.code}
        </span>{' '}
        {action.description}
      </p>
      <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
        {action.responsible_role}
        {action.expected_within_minutes !== null &&
          ` · ${t('playground.control.within', { minutes: action.expected_within_minutes })}`}
      </p>
      <div
        role="radiogroup"
        aria-label={t('playground.control.markAction', { code: action.code })}
        className={segmentedControl}
      >
        {MARKS.map(({ mark, key }) => (
          <button
            key={mark}
            type="button"
            role="radio"
            aria-checked={action.mark === mark}
            disabled={busy}
            onClick={() => void act(action.code, `/actions/${action.code}`, { mark, note }, 'PUT')}
            className={action.mark === mark ? segmentedOptionActive : segmentedOptionIdle}
          >
            {t(`playground.control.marks.${key}`)}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`note-${action.code}`}>
        {t('playground.control.actionNote', { code: action.code })}
      </label>
      <input
        name={`note-${action.code}`}
        autoComplete="off"
        id={`note-${action.code}`}
        value={note}
        maxLength={1000}
        placeholder={t('playground.control.actionNotePlaceholder')}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (action.mark && note.trim() !== action.note)
            void act(action.code, `/actions/${action.code}`, { mark: action.mark, note }, 'PUT')
        }}
        className={inputBase}
      />
    </div>
  )
}

/** Marks a key question put to the table as discussed (or not). */
export function CoveredToggle({
  covered,
  disabled,
  onToggle,
}: {
  covered: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-pressed={covered}
      disabled={disabled}
      onClick={onToggle}
      className={`ml-6 mt-1 rounded-xs border px-1.5 text-xs ${
        covered
          ? 'border-success text-success-fg'
          : 'border-panel-line text-paper-ink/70 dark:text-fg-muted'
      }`}
    >
      {covered ? `✓ ${t('playground.covered')}` : t('playground.markCovered')}
    </button>
  )
}

function KeyQuestions({
  phase,
  where,
  injectCode,
  live,
  pending,
  act,
}: {
  phase: NonNullable<RunRead['control']>['phases'][number]
  where: string | null
  injectCode: string
  live: boolean
  pending: string | null
  act: ControlAct
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<number[]>([])
  const { asked, covered } = phaseQuestions(phase, where)
  return (
    <section aria-label={t('playground.control.keyQuestions')} className="space-y-2">
      <h3 className="text-sm font-semibold">
        {t('playground.control.keyQuestions')}{' '}
        <span className="font-normal text-paper-ink/60 dark:text-fg-muted">· {phase.name}</span>
      </h3>
      <ul className="space-y-1">
        {phase.key_questions.map((question, index) => (
          <li key={index}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                disabled={asked.has(index)}
                checked={asked.has(index) || picked.includes(index)}
                onChange={(e) =>
                  setPicked((current) =>
                    e.target.checked ? [...current, index] : current.filter((i) => i !== index),
                  )
                }
              />
              <span className={asked.has(index) ? 'text-paper-ink/60 dark:text-fg-muted' : ''}>
                {question}
                {asked.has(index) && (
                  <span className="ml-2 text-xs text-success-fg">
                    ✓ {t('playground.control.asked')}
                  </span>
                )}
              </span>
            </label>
            {asked.has(index) && (
              <CoveredToggle
                covered={covered.has(index)}
                disabled={pending !== null}
                onToggle={() =>
                  void act('covered', '/questions/covered', {
                    phase_code: phase.code,
                    position: index,
                    covered: !covered.has(index),
                    room_code: where ?? undefined,
                  })
                }
              />
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!live || picked.length === 0 || pending !== null}
        onClick={async () => {
          const body = { phase_code: phase.code, positions: picked, room_code: where ?? undefined }
          if (await act('questions', '/questions', body)) setPicked([])
        }}
        className={btnSecondary}
      >
        {t('playground.control.askOn', { code: injectCode })}
      </button>
    </section>
  )
}
