import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlaceName } from '../../hooks/usePlaceName'
import { ApiError, apiFetch } from '../../lib/api'
import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import type { RunMeterGroup, RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Panel } from '../common/Panel'

/** What the decisions added up to, a bar per meter, monochrome: a meter is
 * not a state. */
export function MeterGroups({
  groups,
  placeName,
}: {
  groups: RunMeterGroup[]
  /** A place's name; null: the table, nothing to say. */
  placeName: (code: string | null) => string | null
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.room_code ?? 'table'} className="space-y-2">
          <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
            {[
              placeName(group.room_code),
              t('playground.meters.decisions', { count: group.decisions }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ul className="space-y-1.5">
            {group.meters.map((meter) => {
              const share = meter.most ? Math.round((meter.total / meter.most) * 100) : 0
              return (
                <li key={meter.key} className="space-y-0.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{meter.name}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-paper-ink/70 dark:text-fg-muted">
                      {t('playground.meters.of', { total: meter.total, most: meter.most })}
                    </span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 rounded-xs bg-paper-line dark:bg-line">
                    <div
                      className="h-full rounded-xs bg-paper-ink/60 dark:bg-fg-muted"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The impact meters in the session: the team follows them, and the
 * Controller shows the summary to the Players, usually in the hot wash. A
 * Player's view has them only then. */
export function MetersPanel({
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
  const placeName = usePlaceName(run)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = run.meters ?? []
  if (groups.length === 0) return null
  const shown = Boolean(run.meters_shown)

  async function toggle() {
    setPending(true)
    setError(null)
    try {
      onChange(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run/meters`, {
          method: 'POST',
          body: JSON.stringify({ shown: !shown }),
        }),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel
      title={t('playground.meters.title')}
      description={t(
        role === 'player' ? 'playground.meters.playerHint' : 'playground.meters.teamHint',
      )}
    >
      <div className="space-y-3">
        <MeterGroups groups={groups} placeName={placeName} />
        {role !== 'player' && (
          <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
            {t(shown ? 'playground.meters.shown' : 'playground.meters.teamOnly')}
          </p>
        )}
        {role === 'controller' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void toggle()}
            className={shown ? btnSecondary : btnPrimary}
          >
            {pending ? (
              <ButtonSpinner />
            ) : (
              t(shown ? 'playground.meters.hide' : 'playground.meters.show')
            )}
          </button>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </Panel>
  )
}

/** The meters of a run, for the after-action report. Nothing without any. */
export function MeterResults({ ttxId, runId }: { ttxId: string; runId: string }) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<RunMeterGroup[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await apiFetch<RunMeterGroup[]>(`/ttx/${ttxId}/run/meters?run=${runId}`)
        if (!cancelled) setGroups(result)
      } catch {
        // The report reads fine without them.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ttxId, runId])
  if (groups.length === 0) return null
  return (
    <div className="mt-4 space-y-2 text-sm">
      <h3 className="font-semibold">{t('playground.meters.title')}</h3>
      <MeterGroups
        groups={groups}
        placeName={(code) => (code === 'main' ? t('playground.rooms.mainRoom') : code)}
      />
    </div>
  )
}
