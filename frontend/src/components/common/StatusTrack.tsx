import { useTranslation } from 'react-i18next'

/** A document's lifecycle, top to bottom: the states it has passed (green
 * tick), the one it's in (accent dot) and the ones ahead (hollow), the last
 * being what the whole page works towards. Sits above the validation
 * summary, which lists what blocks the next state. Shared by the needs
 * analysis, the MSEL and the conduct preparation. */
export function StatusTrack({
  id,
  states,
  current,
}: {
  id: string
  /** In order; the last one is the goal. */
  states: { key: string; label: string }[]
  current: string
}) {
  const { t } = useTranslation()
  const position = states.findIndex((state) => state.key === current)
  return (
    <section aria-labelledby={id} className="rounded-sm border border-panel-line bg-panel p-4">
      <h2 id={id} className="text-balance text-sm font-semibold">
        {t('common.statusTrack.title')}
      </h2>
      <ol className="mt-2 space-y-1.5">
        {states.map((state, index) => {
          const done = index < position
          const isCurrent = index === position
          const reached = isCurrent && index === states.length - 1
          return (
            <li
              key={state.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-2 text-xs ${
                isCurrent
                  ? 'font-medium text-paper-ink dark:text-fg'
                  : done
                    ? 'text-paper-ink/70 dark:text-fg-muted'
                    : 'text-paper-ink/60 dark:text-fg-faint'
              }`}
            >
              {done || reached ? (
                <span aria-hidden="true" className="w-3 shrink-0 text-center text-success-fg">
                  ✓
                </span>
              ) : (
                <span aria-hidden="true" className="flex w-3 shrink-0 justify-center">
                  <span
                    className={`size-2 rounded-full ${
                      isCurrent ? 'bg-accent' : 'border border-paper-ink/40 dark:border-fg-faint'
                    }`}
                  />
                </span>
              )}
              <span className={reached ? 'text-success-fg' : undefined}>{state.label}</span>
              {done && <span className="sr-only">{t('common.statusTrack.done')}</span>}
              {isCurrent && <span className="sr-only">{t('common.statusTrack.current')}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
