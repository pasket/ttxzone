import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { actionsCellClass, btnBranchIconGhost, btnNeutralIconGhost } from '../../lib/buttonStyles'
import { formatOffset } from '../../lib/msel'
import type { RunControlInject, RunRead, RunRooms } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'
import { ProjectIcon, ReleaseIcon, SkipIcon } from './ControlIcons'

/** Every inject of the MSEL by phase, in session order: release a
 * mandatory one, fire a contingent one (with why -- flagged when its
 * expected action was missed), or skip one. Released and skipped ones say
 * so. Its actions are the sequence window's icon buttons (`InjectSequence`),
 * a contingent inject's in the branch colour. */
export function InjectQueue({
  control,
  live,
  pending,
  rooms = null,
  onProject,
  onRelease,
  onSkip,
}: {
  control: NonNullable<RunRead['control']>
  live: boolean
  pending: string | null
  /** In rooms: each inject says where it's played, and a delivered one can
   * be put on the main room's screen. */
  rooms?: RunRooms | null
  onProject?: (inject: RunControlInject) => void
  onRelease: (inject: RunControlInject) => void
  onSkip: (inject: RunControlInject) => void
}) {
  const { t } = useTranslation()
  const order = (i: RunControlInject) => i.due_minute ?? Number.MAX_SAFE_INTEGER
  const action = (
    inject: RunControlInject,
    label: string,
    icon: ReactNode,
    onClick: () => void,
    disabled: boolean,
    spins = true,
  ) => (
    <button
      type="button"
      disabled={disabled || pending !== null}
      onClick={onClick}
      className={inject.kind === 'contingent' ? btnBranchIconGhost : btnNeutralIconGhost}
      aria-label={label}
      title={label}
    >
      {spins && pending === inject.code ? <ButtonSpinner /> : icon}
    </button>
  )
  return (
    <Panel title={t('playground.control.queue')}>
      <div className="space-y-5">
        {control.phases.map((phase) => {
          const rows = control.injects
            .filter((i) => i.phase_code === phase.code)
            .sort((a, b) => order(a) - order(b))
          if (rows.length === 0) return null
          return (
            <section key={phase.code} aria-label={phase.name} className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted">
                <span translate="no" className="font-mono">
                  {phase.code}
                </span>{' '}
                · {phase.name}
              </h3>
              <ul className="divide-y divide-panel-line">
                {rows.map((inject) => (
                  <li key={inject.code} className="space-y-1 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 font-mono text-xs text-paper-ink/60 dark:text-fg-muted">
                        {formatOffset(inject.due_minute)}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={inject.title}>
                        <span translate="no" className="font-mono">
                          {inject.code}
                        </span>{' '}
                        {inject.title}
                      </span>
                      {inject.kind === 'contingent' && (
                        <span className="rounded-xs border border-panel-line px-1.5 text-xs">
                          {t('playground.control.contingent')}
                        </span>
                      )}
                      {inject.format === 'poll' && (
                        <span className="rounded-xs border border-panel-line px-1.5 text-xs">
                          {t('playground.polls.pollEyebrow')}
                        </span>
                      )}
                      {inject.suggested && (
                        <span className="rounded-xs bg-accent/15 px-1.5 text-xs font-semibold text-accent-fg">
                          {t('playground.control.suggested')}
                        </span>
                      )}
                      {inject.state === 'pending' ? (
                        <span className={actionsCellClass}>
                          {action(
                            inject,
                            t(
                              inject.kind === 'contingent'
                                ? 'playground.control.fireInject'
                                : 'playground.control.releaseInject',
                              { code: inject.code },
                            ),
                            <ReleaseIcon />,
                            () => onRelease(inject),
                            !live,
                          )}
                          {action(
                            inject,
                            t('playground.control.skipInject', { code: inject.code }),
                            <SkipIcon />,
                            () => onSkip(inject),
                            false,
                            false,
                          )}
                        </span>
                      ) : (
                        <>
                          {rooms &&
                            inject.state === 'released' &&
                            onProject &&
                            (rooms.main_projected === inject.code ? (
                              <span className="shrink-0 rounded-xs bg-accent/15 px-1.5 text-xs font-semibold text-accent-fg">
                                {t('playground.control.rooms.onScreenMark')}
                              </span>
                            ) : (
                              action(
                                inject,
                                t('playground.control.rooms.projectLabel', { code: inject.code }),
                                <ProjectIcon />,
                                () => onProject(inject),
                                false,
                              )
                            ))}
                          <span
                            className={`shrink-0 text-xs ${
                              inject.state === 'released'
                                ? 'text-success-fg'
                                : 'text-paper-ink/60 dark:text-fg-muted'
                            }`}
                            title={inject.reason || undefined}
                          >
                            {inject.state === 'released'
                              ? `✓ ${t('playground.control.released')}`
                              : t('playground.control.skipped')}
                          </span>
                        </>
                      )}
                    </div>
                    {rooms && (
                      <p className="pl-16 text-xs text-paper-ink/60 dark:text-fg-muted">
                        <span aria-hidden="true">→ </span>
                        {inject.room_codes?.length
                          ? inject.room_codes.map((code, index) => (
                              <Fragment key={code}>
                                {index > 0 && ' · '}
                                <CodeRef
                                  code={code}
                                  title={rooms.rooms.find((r) => r.code === code)?.name ?? ''}
                                />
                              </Fragment>
                            ))
                          : t('creator.msel.rooms.all')}
                      </p>
                    )}
                    {inject.kind === 'contingent' && inject.trigger_condition && (
                      <p className="pl-16 text-xs text-paper-ink/60 dark:text-fg-muted">
                        {t('playground.control.firesIf', { condition: inject.trigger_condition })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Panel>
  )
}
