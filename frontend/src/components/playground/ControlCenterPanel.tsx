import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../lib/api'
import {
  btnDangerIconGhost,
  btnNeutralIconGhost,
  btnPrimary,
  btnPrimaryIcon,
  btnSecondary,
} from '../../lib/buttonStyles'
import { jumpedOver } from '../../lib/run'
import type { RunControlInject, RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { DecisionLog } from './DecisionLog'
import { FlagIcon, PauseIcon, PlayIcon, StopIcon } from './ControlIcons'
import { EndDialog } from './EndDialog'
import { EndexDialog } from './EndexDialog'
import { InjectQueue } from './InjectQueue'
import { InjectSequence } from './InjectSequence'
import { InPlayPanel } from './InPlayPanel'
import { MetersPanel } from './MetersPanel'
import { ReasonDialog } from './ReasonDialog'
import { RestartDialog } from './RestartDialog'
import { RoomsControlPanel } from './RoomsControlPanel'

/** What runs a control action: its key (for the spinner), method, path
 * under /ttx/{id}/run and body; true once applied. */
export type ControlAct = (
  key: string,
  path: string,
  body?: unknown,
  method?: 'POST' | 'PUT',
) => Promise<boolean>

type Asking =
  | { kind: 'end' | 'restart' | 'endex' }
  | { kind: 'resend'; code: string }
  | { kind: 'skip'; inject: RunControlInject }
  /** `over`: the pending mandatory injects a release goes ahead of. */
  | { kind: 'fire' | 'jump'; inject: RunControlInject; over: RunControlInject[] }

/** The Controller's control center: run the session (start, pause and end
 * -- as an emergency stop too -- as icons in the header, restart once
 * over), the sequence window (the inject in play, what's due now, the two
 * next slots: `InjectSequence`), the inject in play's expected actions and
 * the phase's key questions, and every inject of the MSEL to release, fire
 * or skip. The storyline spans the page above it (`ControlStoryline`).
 * Every action answers with the new view, applied at once. */
export function ControlCenterPanel({
  ttxId,
  run,
  onChange,
  contentLanguage,
  archived = false,
}: {
  ttxId: string
  run: RunRead
  onChange: (next: RunRead) => void
  /** The exercise's content language: what's written for the table by
   * default (ENDEX) is worded in it. Unknown: the Controller's language. */
  contentLanguage?: string | null
  /** Archived: read-only -- no session starts or restarts. */
  archived?: boolean
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState<Asking | null>(null)

  const aheadOf = (over: RunControlInject[]) =>
    t('playground.control.jumpDescription', { count: over.length })

  const act: ControlAct = async (key, path, body, method = 'POST') => {
    setPending(key)
    setError(null)
    try {
      onChange(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run${path}`, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      )
      return true
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      return false
    } finally {
      setPending(null)
    }
  }

  const control = run.control
  const running = run.state === 'live' || run.state === 'paused'
  // Once ENDEX is out nothing else goes to the table.
  const playing = run.state === 'live' && !run.endex_released_at

  /** Release (or fire) an inject: a contingent one asks why, one ahead of
   * those due first asks to confirm (`ahead` unknown, from the queue: any
   * but a suggested contingent). */
  const release = (inject: RunControlInject, ahead = !inject.suggested) => {
    const over = ahead ? jumpedOver(control?.injects ?? [], inject) : []
    if (inject.kind === 'contingent') setAsking({ kind: 'fire', inject, over })
    else if (over.length) setAsking({ kind: 'jump', inject, over })
    else void act(inject.code, `/injects/${inject.code}/release`)
  }
  // After ENDEX there's no play to pause or stop: only ending the session,
  // once the hot wash is done.
  const sessionActions =
    running && run.endex_released_at ? (
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => setAsking({ kind: 'end' })}
        className={`${btnPrimary} inline-flex items-center gap-2`}
      >
        <FlagIcon />
        {t('playground.control.end')}
      </button>
    ) : (
      running && (
        <div className="flex gap-2">
          {run.state === 'live' ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void act('pause', '/pause')}
              className={btnNeutralIconGhost}
              aria-label={t('playground.control.pause')}
              title={t('playground.control.pause')}
            >
              {pending === 'pause' ? <ButtonSpinner /> : <PauseIcon />}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void act('resume', '/resume')}
              className={btnPrimaryIcon}
              aria-label={t('playground.control.resume')}
              title={t('playground.control.resume')}
            >
              {pending === 'resume' ? <ButtonSpinner /> : <PlayIcon />}
            </button>
          )}
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => setAsking({ kind: 'end' })}
            className={btnDangerIconGhost}
            aria-label={t('playground.control.end')}
            title={t('playground.control.end')}
          >
            <StopIcon />
          </button>
        </div>
      )
    )

  return (
    <div className="space-y-4">
      <Panel
        title={t('playground.control.session')}
        meta={
          run.run_number && run.run_number > 1
            ? t('playground.control.runNumber', { number: run.run_number })
            : undefined
        }
        aside={sessionActions || undefined}
      >
        {run.state === 'not_started' && !archived && (
          <div className="space-y-3">
            {(!run.msel_ready || !run.plan_ready) && (
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('playground.control.notReady')}
              </p>
            )}
            <button
              type="button"
              disabled={!run.msel_ready || !run.plan_ready || pending !== null}
              onClick={() => void act('start', '/start')}
              className={btnPrimary}
            >
              {pending === 'start' ? <ButtonSpinner /> : t('playground.control.start')}
            </button>
          </div>
        )}
        {run.state === 'paused' && run.real_world_at && (
          <p role="status" className="text-sm font-semibold text-danger-fg">
            {t('playground.realWorld.paused')}
          </p>
        )}
        {(run.state === 'ended' || run.state === 'stopped') && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t(run.state === 'ended' ? 'playground.state.ended' : 'playground.state.stopped')}
            </p>
            {!archived && (
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setAsking({ kind: 'restart' })}
                className={btnSecondary}
              >
                {t('playground.control.restart')}
              </button>
            )}
          </div>
        )}
        {running && control && (
          <InjectSequence
            run={run}
            control={control}
            live={playing}
            pending={pending}
            onRelease={release}
            onResend={(code) => setAsking({ kind: 'resend', code })}
            onResetTimer={() => void act('timer', '/inject-timer/reset')}
            onEndex={() => setAsking({ kind: 'endex' })}
          />
        )}
        {error && (
          <p className="mt-3 text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </Panel>

      {running && run.rooms && (
        <RoomsControlPanel run={run} rooms={run.rooms} pending={pending} act={act} />
      )}
      {running && control && (
        <InPlayPanel run={run} control={control} pending={pending} act={act} />
      )}
      {/* Above the long MSEL queue: what the table decides is followed live. */}
      {run.state !== 'not_started' && (
        <DecisionLog ttxId={ttxId} run={run} role="controller" onChange={onChange} />
      )}
      {run.state !== 'not_started' && (
        <MetersPanel ttxId={ttxId} run={run} role="controller" onChange={onChange} />
      )}
      {running && control && (
        <InjectQueue
          control={control}
          live={playing}
          pending={pending}
          rooms={run.rooms ?? null}
          onProject={(inject) => void act(inject.code, '/main/project', { code: inject.code })}
          onRelease={(inject) => release(inject)}
          onSkip={(inject) => setAsking({ kind: 'skip', inject })}
        />
      )}

      {asking?.kind === 'end' && (
        <EndDialog
          pending={pending === 'end'}
          onClose={() => setAsking(null)}
          onEnd={async () => {
            if (await act('end', '/end')) setAsking(null)
          }}
          onStop={async (reason) => {
            if (await act('end', '/stop', { reason })) setAsking(null)
          }}
          allowEmergency={!run.endex_released_at}
        />
      )}
      {asking?.kind === 'endex' && (
        <EndexDialog
          language={contentLanguage}
          pending={pending === 'endex'}
          onClose={() => setAsking(null)}
          onSend={async (title, content) => {
            if (await act('endex', '/endex', { title, content })) setAsking(null)
          }}
        />
      )}
      {asking?.kind === 'restart' && (
        <RestartDialog
          runNumber={run.run_number ?? null}
          canDelete={run.can_delete ?? false}
          pending={pending === 'restart'}
          onClose={() => setAsking(null)}
          onRestart={async (mode, confirmation) => {
            if (await act('restart', '/restart', { mode, confirmation })) setAsking(null)
          }}
        />
      )}
      {asking && (asking.kind === 'skip' || asking.kind === 'fire') && (
        <ReasonDialog
          title={t(
            asking.kind === 'fire'
              ? 'playground.control.fireTitle'
              : 'playground.control.skipTitle',
            { code: asking.inject.code },
          )}
          description={
            asking.kind === 'fire'
              ? [
                  asking.over.length > 0 && aheadOf(asking.over),
                  asking.inject.trigger_condition || t('playground.control.fireDescription'),
                ]
                  .filter(Boolean)
                  .join(' ')
              : t('playground.control.skipDescription')
          }
          confirmLabel={t(
            asking.kind === 'fire' ? 'playground.control.fire' : 'playground.control.skip',
          )}
          pending={pending === asking.inject.code}
          onClose={() => setAsking(null)}
          onConfirm={async (reason) => {
            const verb = asking.kind === 'fire' ? 'release' : 'skip'
            if (await act(asking.inject.code, `/injects/${asking.inject.code}/${verb}`, { reason }))
              setAsking(null)
          }}
        />
      )}
      {asking?.kind === 'jump' && (
        <ConfirmActionDialog
          title={t('playground.control.jumpTitle', { code: asking.inject.code })}
          description={aheadOf(asking.over)}
          items={asking.over}
          confirmLabel={t('playground.control.release')}
          pending={pending === asking.inject.code}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            if (await act(asking.inject.code, `/injects/${asking.inject.code}/release`))
              setAsking(null)
          }}
        />
      )}
      {asking?.kind === 'resend' && (
        <ConfirmActionDialog
          title={t('playground.control.resendTitle', { code: asking.code })}
          description={t('playground.control.resendDescription')}
          confirmLabel={t('playground.control.resend')}
          pending={pending === `resend:${asking.code}`}
          onClose={() => setAsking(null)}
          onConfirm={async () => {
            if (await act(`resend:${asking.code}`, `/injects/${asking.code}/resend`))
              setAsking(null)
          }}
        />
      )}
    </div>
  )
}
