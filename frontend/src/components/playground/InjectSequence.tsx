import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  actionsCellClass,
  btnBranchIconGhost,
  btnNeutralIconGhost,
  btnSecondary,
} from '../../lib/buttonStyles'
import { formatOffset } from '../../lib/msel'
import { controlSequence, ENDEX_CODE, type SequenceNext } from '../../lib/run'
import type { RunControlInject, RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { JumpIcon, ReleaseIcon, StepBackIcon, TimerResetIcon } from './ControlIcons'
import { InjectTimer } from './InjectTimer'
import { SequenceRail, type RailLine, type RailRow } from './SequenceRail'

const heading = 'text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted'
const badge = 'rounded-xs border border-panel-line px-1.5 text-xs'

/** The Controller's window on the MSEL, one row grammar for all three
 * bands (due T+, inject, badges, icon actions at the right like a
 * table's): the inject before the one in play (release it again: it's
 * back in play), the one in play with the time since it went out (reset
 * it), and what goes out next, in T+ order -- the branches open from the
 * one in play or suggested (fire), the next mandatory one to release, and
 * the ones after it to jump to (confirmed: the ones jumped over stay
 * pending). A rail at the left draws it as the storyline map does: the
 * storyline in the accent, each branch forking off in the branch colour
 * and coming back where the storyline resumes. Skipping lives in the MSEL
 * list (`InjectQueue`). Once every mandatory inject is out, it offers the
 * closing message (ENDEX), which closes every phase. */
export function InjectSequence({
  run,
  control,
  live,
  pending,
  onRelease,
  onResend,
  onResetTimer,
  onEndex,
}: {
  run: RunRead
  control: NonNullable<RunRead['control']>
  live: boolean
  pending: string | null
  /** `ahead`: released before one due earlier (asks to confirm). */
  onRelease: (inject: RunControlInject, ahead: boolean) => void
  onResend: (code: string) => void
  onResetTimer: () => void
  onEndex: () => void
}) {
  const { t, i18n } = useTranslation()
  const { previous, inPlay, next } = controlSequence(run, control)
  const find = (code: string | null) => control.injects.find((i) => i.code === code)
  const due = (code: string) => find(code)?.due_minute ?? null
  const deliveredAt = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  const action = (
    key: string,
    label: string,
    icon: ReactNode,
    onClick: () => void,
    disabled: boolean,
    branch = false,
  ) => (
    <button
      key={key}
      type="button"
      disabled={disabled || pending !== null}
      onClick={onClick}
      className={branch ? btnBranchIconGhost : btnNeutralIconGhost}
      aria-label={label}
      title={label}
    >
      {pending === key ? <ButtonSpinner /> : icon}
    </button>
  )

  const branchLanes = Math.max(0, ...next.map(({ lane }) => lane))
  const lanes = 1 + branchLanes
  const kindOf = (code: string) => find(code)?.kind ?? 'mandatory'

  const row = (
    code: string,
    title: string,
    rail: RailRow,
    {
      badges,
      aside,
      actions,
      detail,
    }: { badges?: ReactNode; aside?: ReactNode; actions?: ReactNode; detail?: ReactNode },
  ) => (
    <li key={code} className="flex gap-2 text-sm">
      <SequenceRail lanes={lanes} row={rail} />
      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 font-mono text-xs text-paper-ink/60 dark:text-fg-muted">
            {formatOffset(due(code))}
          </span>
          <span className="min-w-0 flex-1 truncate" title={title}>
            {/* ENDEX's title already starts with its code. */}
            {code === ENDEX_CODE ? title : <CodeRef code={code} title={title} />}
          </span>
          {badges}
          {aside}
          <span className={`${actionsCellClass} w-9 shrink-0`}>{actions}</span>
        </div>
        {detail}
      </div>
    </li>
  )

  // The rail through the Next band: the storyline runs from the heading
  // to its last row; each branch from the heading (forking off the one in
  // play) to its row, then back into the storyline where it resumes, if
  // that row is shown, or a short stub.
  const lastStoryline = next.findLastIndex(({ lane }) => lane === 0)
  const branchRows = next.flatMap((entry, index) =>
    entry.lane > 0
      ? [
          {
            ...entry,
            index,
            back: next.findIndex(
              (other, at) => at > index && other.lane === 0 && other.inject.code === entry.rejoin,
            ),
          },
        ]
      : [],
  )
  const forking = branchRows.filter(({ from }) => inPlay !== null && from === inPlay.code)
  const headingRail: RailRow = {
    lines: [
      ...(lastStoryline >= 0 ? [{ lane: 0, from: 'node', to: 'bottom' } as RailLine] : []),
      ...branchRows
        .filter((branch) => !forking.includes(branch))
        .map((branch): RailLine => ({ lane: branch.lane, from: 'node', to: 'bottom' })),
    ],
    forks: forking.map(({ lane }) => lane),
  }
  const nextRail = ({ lane, inject }: SequenceNext, index: number): RailRow => {
    const lines: RailLine[] = []
    const joins: number[] = []
    if (lane === 0) {
      lines.push({ lane: 0, from: 'top', to: index < lastStoryline ? 'bottom' : 'node' })
    } else if (index < lastStoryline) {
      lines.push({ lane: 0, from: 'top', to: 'bottom' })
    }
    for (const branch of branchRows) {
      if (branch.index === index) {
        lines.push({ lane: branch.lane, from: 'top', to: 'node' })
        lines.push(
          branch.back > index
            ? { lane: branch.lane, from: 'node', to: 'bottom' }
            : { lane: branch.lane, from: 'node', to: 'stub', dashed: branch.rejoin === null },
        )
      } else if (index < branch.index || index < branch.back) {
        lines.push({ lane: branch.lane, from: 'top', to: 'bottom' })
      } else if (index === branch.back) {
        joins.push(branch.lane)
      }
    }
    return { node: { lane, kind: inject.kind }, lines, joins }
  }

  // What a branch hangs on and where the storyline picks up after it.
  const branchDetail = ({ inject, rejoin }: SequenceNext) => {
    const action = control.injects
      .flatMap((other) => other.expected_actions)
      .find((a) => a.code === inject.branch_action_code)
    const back = find(rejoin)
    const line = 'flex min-w-0 items-center gap-1'
    const label = 'shrink-0 whitespace-nowrap'
    return (
      <div className="-mt-1 space-y-0.5 pl-16 text-xs text-paper-ink/70 dark:text-fg-muted">
        {inject.branch_action_code && (
          <p className={line}>
            <span className={label}>{t('playground.control.branchIf')}</span>
            <span className="min-w-0 truncate">
              <CodeRef code={inject.branch_action_code} title={action?.description ?? ''} />
            </span>
          </p>
        )}
        {back ? (
          <p className={line}>
            <span className={label}>{t('playground.control.branchBack')}</span>
            <span className="min-w-0 truncate">
              <CodeRef code={back.code} title={back.title} />
            </span>
          </p>
        ) : (
          <p>{t('playground.control.branchNoWayBack')}</p>
        )}
      </div>
    )
  }

  const mandatory = next.filter(({ lane }) => lane === 0)
  const storylineOut = !control.injects.some(
    (inject) => inject.kind === 'mandatory' && inject.state === 'pending',
  )

  return (
    <div className="space-y-3">
      <section aria-label={t('playground.control.previous')} className="px-3">
        <h3 className={heading}>
          {previous
            ? t('playground.control.previousAt', { time: deliveredAt(previous.released_at) })
            : t('playground.control.previous')}
        </h3>
        {previous ? (
          <ul className="text-paper-ink/70 dark:text-fg-muted">
            {row(
              previous.code,
              previous.title,
              { node: { lane: 0, kind: kindOf(previous.code), muted: true } },
              {
                actions: action(
                  `resend:${previous.code}`,
                  t('playground.control.releaseAgain', { code: previous.code }),
                  <StepBackIcon />,
                  () => onResend(previous.code),
                  !live,
                  kindOf(previous.code) === 'contingent',
                ),
              },
            )}
          </ul>
        ) : (
          <p className="py-1.5 text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('playground.control.noPrevious')}
          </p>
        )}
      </section>

      <section
        aria-label={t('playground.control.inPlay')}
        className="rounded-sm border border-panel-line px-3 pt-2 pb-1"
      >
        <h3 className={heading}>
          {inPlay
            ? t('playground.control.inPlayAt', { time: deliveredAt(inPlay.released_at) })
            : t('playground.control.inPlay')}
        </h3>
        {inPlay ? (
          <ul>
            {row(
              inPlay.code,
              inPlay.title,
              {
                node: { lane: 0, kind: kindOf(inPlay.code) },
                // Down towards what goes out next.
                lines: next.length ? [{ lane: 0, from: 'node', to: 'bottom' }] : [],
              },
              // After ENDEX nothing is in play to time.
              run.endex_released_at
                ? {}
                : {
                    aside: <InjectTimer run={run} />,
                    actions: action(
                      'timer',
                      t('playground.control.resetTimer'),
                      <TimerResetIcon />,
                      onResetTimer,
                      false,
                      kindOf(inPlay.code) === 'contingent',
                    ),
                  },
            )}
          </ul>
        ) : (
          <p className="py-1.5 text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('playground.noInjectYet')}
          </p>
        )}
      </section>

      <section aria-label={t('playground.control.nextUp')} className="px-3">
        <div className="flex gap-2">
          <SequenceRail lanes={lanes} row={headingRail} nodeY={8} />
          <div className="min-w-0 flex-1">
            <h3 className={heading}>{t('playground.control.nextUp')}</h3>
            {inPlay && forking.length > 0 && (
              <p className="text-xs text-paper-ink/70 dark:text-fg-muted">
                {t('playground.control.forkCaption', {
                  count: forking.length,
                  code: inPlay.code,
                })}
              </p>
            )}
          </div>
        </div>
        {next.length ? (
          <ul>
            {next.map((entry, index) => {
              const { inject, parallel, lane } = entry
              const contingent = inject.kind === 'contingent'
              const jump = !contingent && mandatory[0] !== entry
              return row(inject.code, inject.title, nextRail(entry, index), {
                badges: (
                  <>
                    {contingent && (
                      <span className="sr-only">{t('playground.control.contingent')}</span>
                    )}
                    {inject.suggested && (
                      <span className="rounded-xs bg-chart-2/15 px-1.5 text-xs font-semibold text-chart-2">
                        {t('playground.control.suggested')}
                      </span>
                    )}
                    {parallel && (
                      <span className={`${badge} text-paper-ink/70 dark:text-fg-muted`}>
                        {t('playground.control.parallel')}
                      </span>
                    )}
                  </>
                ),
                detail: lane > 0 ? branchDetail(entry) : undefined,
                actions: action(
                  inject.code,
                  t(
                    contingent
                      ? 'playground.control.fireInject'
                      : jump
                        ? 'playground.control.jumpRelease'
                        : 'playground.control.releaseInject',
                    { code: inject.code },
                  ),
                  jump ? <JumpIcon /> : <ReleaseIcon />,
                  () => onRelease(inject, jump),
                  !live,
                  lane > 0,
                ),
              })
            })}
          </ul>
        ) : run.endex_released_at ? (
          <p className="py-1.5 text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('playground.control.endex.sent', { time: deliveredAt(run.endex_released_at) })}
          </p>
        ) : (
          <div className="space-y-2 py-1.5 text-sm text-paper-ink/70 dark:text-fg-muted">
            <p>{t('playground.control.allReleased')}</p>
            {storylineOut && (
              <>
                <p>{t('playground.control.endex.offer')}</p>
                <button
                  type="button"
                  disabled={!live || pending !== null}
                  onClick={onEndex}
                  className={btnSecondary}
                >
                  {pending === 'endex' ? <ButtonSpinner /> : t('playground.control.endex.send')}
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
