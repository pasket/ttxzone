import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useMaximize } from '../../../hooks/useMaximize'
import type { StorylineFrameState } from '../../../hooks/useStorylineFrame'
import { MaximizeIcon } from '../../common/MaximizeIcon'
import { InjectKindMark } from './InjectKindMark'

export const mutedClass = 'text-xs text-paper-ink/70 dark:text-fg-muted'
export const iconButtonClass =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-paper-ink/70 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted'
/** A header toggle that's on (legend, session time, pinned): the accent,
 * on a tint -- off keeps the plain icon look. */
const toggleOnClass = 'bg-accent/15 text-accent-fg hover:bg-accent/25 dark:text-accent-fg'

/** A key with three entries: the legend. */
function LegendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="5" cy="6" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="5" cy="18" r="1.5" />
      <path d="M10 6h10M10 12h10M10 18h10" />
    </svg>
  )
}

/** A stopwatch: session time. */
function SessionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="14" r="7" />
      <path d="M12 14v-3M10 3h4M12 3v4" />
    </svg>
  )
}

/** A pushpin: filled while pinned. */
function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={pinned ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6z" />
    </svg>
  )
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 transition-transform motion-reduce:transition-none ${up ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** The storyline map's frame, shared by the MSEL and the control center: a
 * titled panel with the map's toggles at the right -- legend, session time,
 * maximize (over the page, `useMaximize`: Escape restores), pin (sticks to the top while
 * the page scrolls) and fold -- each remembered in this browser. The page
 * draws the map in it (`children`, told whether it's maximized and whether
 * to show session time) and may add header items of its own (`meta` after
 * the summary, `actions` before the toggles) and legend entries. */
export function StorylineFrame({
  frame,
  title,
  summary,
  meta,
  actions,
  hasMap,
  offsetVar,
  legendExtra,
  children,
  belowMap,
  footer,
}: {
  frame: StorylineFrameState
  title: string
  summary?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  /** Whether there's a map yet: without one only the pin and fold show. */
  hasMap: boolean
  /** While pinned, the page keeps the frame's height in this CSS custom
   * property and as scroll padding, so a focused field isn't scrolled in
   * underneath it. */
  offsetVar?: string
  legendExtra?: ReactNode
  children: (view: { maximized: boolean; showSession: boolean }) => ReactNode
  /** Under the map and its legend (the MSEL's injects not on the map). */
  belowMap?: ReactNode
  /** After the frame (dialogs the page opens from the map). */
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  const bodyId = useId()
  const { open, maximized, setMaximized, pinned, showSession, showLegend } = frame
  const sectionRef = useRef<HTMLElement>(null)
  const maximizeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!offsetVar || !pinned || maximized || !section) return
    const root = document.documentElement
    const previousPadding = root.style.scrollPaddingTop
    const measure = () => {
      const height = `${section.offsetHeight}px`
      root.style.setProperty(offsetVar, height)
      root.style.scrollPaddingTop = height
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(section)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(offsetVar)
      root.style.scrollPaddingTop = previousPadding
    }
  }, [offsetVar, pinned, maximized])

  useMaximize({
    maximized,
    onRestore: () => setMaximized(false),
    panelRef: sectionRef,
    toggleRef: maximizeRef,
  })

  const showBody = open || maximized

  return (
    <>
      {maximized && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMaximized(false)}
        />
      )}
      <section
        ref={sectionRef}
        tabIndex={maximized ? -1 : undefined}
        aria-labelledby={`${bodyId}-title`}
        className={`rounded-sm border border-panel-line bg-panel px-4 py-3 focus:outline-none ${
          maximized
            ? 'fixed inset-4 z-40 overflow-y-auto overscroll-contain shadow-lg sm:inset-8'
            : pinned
              ? 'sticky top-0 z-30'
              : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={`${bodyId}-title`} className="text-balance text-sm font-semibold">
            {title}
          </h2>
          {summary && <p className={mutedClass}>{summary}</p>}
          {meta}
          <div className="ml-auto flex items-center gap-1.5">
            {showBody && actions}
            {hasMap && (
              <button
                type="button"
                onClick={frame.toggleLegend}
                aria-pressed={showLegend}
                aria-label={
                  showLegend
                    ? t('creator.msel.strip.hideLegend')
                    : t('creator.msel.strip.showLegend')
                }
                title={
                  showLegend
                    ? t('creator.msel.strip.hideLegend')
                    : t('creator.msel.strip.showLegend')
                }
                className={`${iconButtonClass} ${showLegend ? toggleOnClass : ''}`}
              >
                <LegendIcon />
              </button>
            )}
            {hasMap && (
              <button
                type="button"
                onClick={frame.toggleSession}
                aria-pressed={showSession}
                aria-label={
                  showSession
                    ? t('creator.msel.strip.hideSession')
                    : t('creator.msel.strip.showSession')
                }
                title={
                  showSession
                    ? t('creator.msel.strip.hideSession')
                    : t('creator.msel.strip.showSession')
                }
                className={`${iconButtonClass} ${showSession ? toggleOnClass : ''}`}
              >
                <SessionIcon />
              </button>
            )}
            {hasMap && (
              <button
                ref={maximizeRef}
                type="button"
                onClick={() => setMaximized(!maximized)}
                aria-pressed={maximized}
                aria-label={
                  maximized ? t('creator.msel.strip.restore') : t('creator.msel.strip.maximize')
                }
                title={
                  maximized ? t('creator.msel.strip.restore') : t('creator.msel.strip.maximize')
                }
                className={iconButtonClass}
              >
                <MaximizeIcon restore={maximized} />
              </button>
            )}
            {!maximized && (
              <button
                type="button"
                onClick={frame.togglePinned}
                aria-pressed={pinned}
                aria-label={pinned ? t('creator.msel.strip.unpin') : t('creator.msel.strip.pin')}
                title={pinned ? t('creator.msel.strip.unpin') : t('creator.msel.strip.pin')}
                className={`${iconButtonClass} ${pinned ? toggleOnClass : ''}`}
              >
                <PinIcon pinned={pinned} />
              </button>
            )}
            {!maximized && (
              <button
                type="button"
                onClick={frame.toggleOpen}
                aria-expanded={open}
                aria-controls={bodyId}
                aria-label={open ? t('creator.msel.strip.hide') : t('creator.msel.strip.show')}
                title={open ? t('creator.msel.strip.hide') : t('creator.msel.strip.show')}
                className={iconButtonClass}
              >
                <ChevronIcon up={open} />
              </button>
            )}
          </div>
        </div>

        <div id={bodyId} hidden={!showBody} className="mt-2 space-y-2">
          {hasMap && (
            <>
              {/* Scrolls sideways on a narrow screen; on a wide one the marks'
                  menus may overflow the drawing. */}
              <div className="overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
                <div className="min-w-[560px] lg:min-w-0">
                  {children({ maximized, showSession })}
                </div>
              </div>
              {showLegend && (
                <ul className={`flex flex-wrap justify-end gap-x-4 gap-y-1 ${mutedClass}`}>
                  <li className="flex items-center gap-1.5">
                    <InjectKindMark kind="mandatory" decorative />
                    {t('creator.msel.map.legendStop')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <InjectKindMark kind="contingent" decorative />
                    {t('creator.msel.map.legendBranch')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="w-4 border-t border-dashed border-chart-2"
                    />
                    {t('creator.msel.map.legendNoRejoin')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="font-mono italic">
                      +h
                    </span>
                    {t('creator.msel.map.legendIncident')}
                  </li>
                  {showSession && (
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="font-mono">
                        T+
                      </span>
                      {t('creator.msel.map.legendSession')}
                    </li>
                  )}
                  {legendExtra}
                </ul>
              )}
              {belowMap}
            </>
          )}
        </div>
        {footer}
      </section>
    </>
  )
}
