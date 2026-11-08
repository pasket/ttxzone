import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { API_BASE } from '../../lib/api'
import { btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { formatSize } from '../../lib/fileSize'
import { isTextPreviewable } from '../../lib/textPreview'
import { ENDEX_CODE } from '../../lib/run'
import type { RunInject, RunRead } from '../../lib/types'
import { useInjectTextSize } from '../../hooks/useInjectTextSize'
import { FileDigest } from '../common/FileDigest'
import { TextFilePreviewButton } from '../common/TextFilePreview'
import { FormattedText } from '../common/FormattedText'
import { InjectArtifactView } from '../common/InjectArtifactView'
import { Panel } from '../common/Panel'
import { CheckIcon, FlagIcon, PaperclipIcon } from './ControlIcons'
import { DeliveryHeader } from './DeliveryHeader'

function runImageUrl(ttxId: string, imageId: string): string {
  return `${API_BASE}/ttx/${ttxId}/run/images/${imageId}`
}

/** The API path a delivered inject's file downloads from. */
function runFilePath(ttxId: string, fileId: string): string {
  return `/ttx/${ttxId}/run/files/${fileId}`
}

/** The files handed out with the inject, to download and analyse: name
 * (the download), size, SHA-256 to check it, and what it is. */
function InjectFiles({ ttxId, inject }: { ttxId: string; inject: RunInject }) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const files = inject.files ?? []
  if (files.length === 0) return null
  return (
    <section aria-label={t('playground.files.label')} className="max-w-prose space-y-2">
      <h3 className="text-sm font-semibold">
        {t('playground.files.label')}
        <span className="ml-1.5 font-mono font-normal text-paper-ink/60 dark:text-fg-muted">
          · {files.length}
        </span>
      </h3>
      <ul className="space-y-2 text-sm">
        {files.map((file) => (
          <li key={file.id} className="space-y-0.5 rounded-sm border border-panel-line px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <a
                href={`${API_BASE}${runFilePath(ttxId, file.id)}`}
                download
                onClick={download(runFilePath(ttxId, file.id))}
                aria-label={t('playground.files.download', { name: file.name })}
                className={`min-w-0 font-medium break-all ${linkAccent}`}
              >
                {file.name}
              </a>
              <span className="text-xs tabular-nums text-paper-ink/60 dark:text-fg-muted">
                {formatSize(file.size_bytes, i18n.language)}
              </span>
              {isTextPreviewable(file.name) && (
                <TextFilePreviewButton path={runFilePath(ttxId, file.id)} name={file.name} />
              )}
            </p>
            {file.description && <p>{file.description}</p>}
            <FileDigest sha256={file.sha256} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function InjectBody({
  ttxId,
  inject,
  textSize = 'text-base',
}: {
  ttxId: string
  inject: RunInject
  /** The reader's chosen size for the inject's text (useInjectTextSize). */
  textSize?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* A new inject starts with its audience folded. */}
      {inject.format !== 'poll' && <DeliveryHeader key={inject.code} inject={inject} />}
      {inject.images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {inject.images.map((image) => (
            <figure key={image.id} className="max-w-full">
              <a href={runImageUrl(ttxId, image.id)} target="_blank" rel="noreferrer">
                <img
                  src={runImageUrl(ttxId, image.id)}
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  alt={image.caption}
                  className="h-auto max-h-80 w-auto max-w-full rounded-sm border border-panel-line"
                />
              </a>
              {image.caption && (
                <figcaption className="mt-1 text-xs text-paper-ink/60 dark:text-fg-muted">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      {/* A readable measure: the panel spans the page, the text doesn't. */}
      {inject.artifact ? (
        <InjectArtifactView
          artifact={inject.artifact}
          content={inject.content}
          textSize={textSize}
        />
      ) : (
        <FormattedText
          text={inject.content}
          className={`${textSize} max-w-prose leading-relaxed`}
        />
      )}
      {/* On a neutral tonal surface, numbered: set apart without the
          accent (colour marks state only). */}
      {inject.questions.length > 0 && (
        <section
          aria-label={t('playground.questions')}
          className="max-w-prose space-y-2 rounded-sm bg-field px-4 py-3"
        >
          <h3 className="text-sm font-semibold">{t('playground.questions')}</h3>
          <ol
            className={`list-decimal space-y-1.5 pl-5 marker:text-paper-ink/60 dark:marker:text-fg-muted ${textSize}`}
          >
            {inject.questions.map((question, index) => (
              <li
                key={index}
                className={question.covered ? 'text-paper-ink/60 dark:text-fg-muted' : ''}
              >
                {question.text}
                {question.covered && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-success-fg">
                    <CheckIcon className="h-3.5 w-3.5" />
                    {t('playground.covered')}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      <InjectFiles ttxId={ttxId} inject={inject} />
      {inject.attachment_notes.length > 0 && (
        <section aria-label={t('playground.attachments')} className="max-w-prose space-y-2">
          <h3 className="text-sm font-semibold">
            {t('playground.attachments')}
            <span className="ml-1.5 font-mono font-normal text-paper-ink/60 dark:text-fg-muted">
              · {inject.attachment_notes.length}
            </span>
          </h3>
          <ul className="space-y-1.5 text-sm">
            {inject.attachment_notes.map((note, index) => (
              <li key={index} className="flex items-start gap-2">
                <PaperclipIcon className="mt-0.5 h-4 w-4 shrink-0 text-paper-ink/60 dark:text-fg-muted" />
                <span className="min-w-0">{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** How the viewer reads the stage: each inject's number in the story
 * (`injectSequence`), whether they see the MSEL codes (the team does, to
 * cross-reference the MSEL; a Player never does), and the inject picked on
 * the phase track to look back on (null: the one in play). On a projector
 * the page passes `showCodes: false`, whoever presents. */
export interface StageView {
  sequence: Map<string, number>
  showCodes: boolean
  reviewing: string | null
  onReview: (code: string | null) => void
  /** Shown on a projector (`PlaygroundPage`): the text two steps larger. */
  presenting?: boolean
}

/** The review bar's step buttons' accessible names. */
const STEP_LABELS = {
  previous: { to: 'playground.review.previous', none: 'playground.review.previousNone' },
  next: { to: 'playground.review.next', none: 'playground.review.nextNone' },
} as const

/** A view without the phase track: numbered in the order given, codes
 * shown, nothing picked. */
// ENDEX's text one step above the reader's chosen size.
const LARGER: Record<string, string> = {
  'text-xs': 'text-sm',
  'text-sm': 'text-base',
  'text-base': 'text-lg',
  'text-lg': 'text-xl',
  'text-xl': 'text-2xl',
  'text-2xl': 'text-3xl',
}

/** ENDEX, the closing message: no delivery details and no timer, its
 * title and text set larger and centred, so the table reads that play is
 * over. The panel's heading is its title. */
function EndexBody({ inject, textSize }: { inject: RunInject; textSize: string }) {
  return (
    <div className="space-y-5 py-6 text-center sm:py-10">
      <p
        translate="no"
        className="inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.3em] text-paper-ink/60 uppercase dark:text-fg-muted"
      >
        <FlagIcon />
        {ENDEX_CODE}
      </p>
      <h2 className="text-2xl font-semibold text-balance text-paper-ink sm:text-3xl dark:text-fg">
        {inject.title}
      </h2>
      {/* Centred as a block, read left-aligned (lists keep their bullets). */}
      <FormattedText
        text={inject.content}
        className={`mx-auto w-fit max-w-full text-left ${LARGER[textSize] ?? 'text-lg'} leading-relaxed`}
      />
    </div>
  )
}

function defaultView(injects: RunInject[]): StageView {
  return {
    sequence: new Map(injects.map((inject, index) => [inject.code, index + 1])),
    showCodes: true,
    reviewing: null,
    onReview: () => {},
  }
}

/** An inject's number in the story and, for the team, its code. */
function InjectMarks({
  inject,
  view,
}: {
  inject: RunInject
  view: Pick<StageView, 'sequence' | 'showCodes'>
}) {
  const { t } = useTranslation()
  const seq = view.sequence.get(inject.code)
  if (seq === undefined && !view.showCodes) return null
  return (
    <span className="inline-flex items-baseline gap-2 font-mono text-sm text-paper-ink/60 tabular-nums dark:text-fg-muted">
      {seq !== undefined && <span>{t('playground.seq', { seq })}</span>}
      {view.showCodes && <span translate="no">{inject.code}</span>}
    </span>
  )
}

function InjectTitle({
  inject,
  view,
}: {
  inject: RunInject
  view: Pick<StageView, 'sequence' | 'showCodes'>
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <InjectMarks inject={inject} view={view} />
      <span>{inject.title}</span>
    </span>
  )
}

/** The shown inject's number between two small buttons to its neighbours
 * on the stage, like a pager: the controls sit on the value they change.
 * Each names where it leads (tooltip and accessible name); at either end
 * it's disabled. */
function InjectPager({
  inject,
  view,
  neighbours,
  onStep,
}: {
  inject: RunInject
  view: Pick<StageView, 'sequence' | 'showCodes'>
  neighbours: { previous?: RunInject; next?: RunInject }
  onStep: (inject: RunInject) => void
}) {
  const { t } = useTranslation()
  const button = (key: 'previous' | 'next') => {
    const target = neighbours[key]
    const label = target
      ? t(STEP_LABELS[key].to, {
          seq: view.sequence.get(target.code) ?? '',
          title: target.title,
        })
      : t(STEP_LABELS[key].none)
    return (
      <button
        type="button"
        disabled={!target}
        onClick={() => target && onStep(target)}
        aria-label={label}
        title={label}
        className="flex h-7 w-7 items-center justify-center rounded-xs border border-paper-line text-paper-ink hover:border-accent hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-accent-fg disabled:opacity-40 disabled:hover:border-paper-line disabled:hover:text-paper-ink dark:border-line dark:text-fg dark:disabled:hover:border-line dark:disabled:hover:text-fg"
      >
        <span aria-hidden="true">{key === 'previous' ? '←' : '→'}</span>
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      {button('previous')}
      <InjectMarks inject={inject} view={view} />
      {button('next')}
    </span>
  )
}

/** Where the shown inject stands, as a small pill beside its number: in
 * play (a filled dot) or looked back on (a hollow one). Monochrome: the
 * playhead colour belongs to the storyline. */
function StagePill({ live, children }: { live: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-panel-line px-2.5 text-xs font-medium text-paper-ink/70 dark:text-fg-muted">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-paper-ink dark:bg-fg' : 'border border-paper-ink/50 dark:border-fg-muted'}`}
      />
      {children}
    </span>
  )
}

/** Two small buttons, "A" smaller and larger, for the inject's text. */
function TextSizeControls({ size }: { size: ReturnType<typeof useInjectTextSize> }) {
  const { t } = useTranslation()
  const button =
    'flex h-7 w-7 items-center justify-center rounded-xs text-paper-ink/70 hover:bg-hover hover:text-paper-ink focus-visible:outline-2 focus-visible:outline-accent-fg disabled:opacity-40 disabled:hover:bg-transparent dark:text-fg-muted dark:hover:text-fg'
  return (
    <div role="group" aria-label={t('playground.textSize.label')} className="flex items-center">
      <button
        type="button"
        onClick={size.shrink}
        disabled={!size.canShrink}
        aria-label={t('playground.textSize.smaller')}
        title={t('playground.textSize.smaller')}
        className={button}
      >
        <span aria-hidden="true" className="text-xs font-semibold">
          A−
        </span>
      </button>
      <button
        type="button"
        onClick={size.grow}
        disabled={!size.canGrow}
        aria-label={t('playground.textSize.larger')}
        title={t('playground.textSize.larger')}
        className={button}
      >
        <span aria-hidden="true" className="text-base font-semibold">
          A+
        </span>
      </button>
    </div>
  )
}

/** The inject in play, as delivered to the table -- or, while the viewer
 * looks back on an earlier one picked on the phase track, that one, with
 * a bar naming the inject in play and the way back to it (a new inject
 * never pulls them away mid-read; it's announced and named there). A new
 * one is announced to screen readers without moving anyone's focus.
 * `currentCode` names the one in play when it isn't the latest (the main
 * room's screen; null: nothing on it). `timer` sits at the right of its
 * header when it's the inject it times (the latest released). */
export function InjectStage({
  ttxId,
  injects,
  phases = [],
  currentCode,
  currentLabel,
  emptyText,
  timer,
  view = defaultView(injects),
}: {
  ttxId: string
  injects: RunInject[]
  /** To name the phase of an inject looked back on. */
  phases?: RunRead['phases']
  currentCode?: string | null
  currentLabel?: string
  emptyText?: string
  timer?: { code: string; node: ReactNode }
  view?: StageView
}) {
  const { t } = useTranslation()
  const current =
    currentCode === undefined
      ? injects[injects.length - 1]
      : injects.find((inject) => inject.code === currentCode)
  const reviewed =
    view.reviewing && view.reviewing !== current?.code
      ? injects.find((inject) => inject.code === view.reviewing)
      : undefined
  const shown = reviewed ?? current
  const endex = shown?.code === ENDEX_CODE
  // The shown inject's neighbours on the stage, to step through the
  // story; stepping onto the one in play ends the review.
  const at = shown ? injects.indexOf(shown) : -1
  const neighbours = {
    previous: at > 0 ? injects[at - 1] : undefined,
    next: at >= 0 && at < injects.length - 1 ? injects[at + 1] : undefined,
  }
  const step = (inject: RunInject) =>
    view.onReview(inject.code === current?.code ? null : inject.code)
  const phaseName = (code: string | null) => {
    const phase = phases.find((p) => p.code === code)
    return phase && (phase.name ?? t('playground.phaseNumber', { number: phase.number }))
  }
  const label = reviewed
    ? [t('playground.review.label'), phaseName(reviewed.phase_code)].filter(Boolean).join(' · ')
    : (currentLabel ?? t('playground.currentInject'))
  const textSize = useInjectTextSize()
  // On a projector: read from across the room.
  const shownSize = view.presenting
    ? (LARGER[LARGER[textSize.className]] ?? 'text-3xl')
    : textSize.className
  const announced = current && {
    seq: view.sequence.get(current.code) ?? '',
    title: current.title,
  }

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {announced ? t('playground.newInject', announced) : ''}
      </p>
      {reviewed && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm border border-panel-line bg-panel px-4 py-2 text-sm">
          <p className="min-w-0">
            {current ? (
              <>
                <span className="text-paper-ink/70 dark:text-fg-muted">
                  {t('playground.review.inPlay')}
                </span>{' '}
                <InjectTitle inject={current} view={view} />
              </>
            ) : (
              <span className="text-paper-ink/70 dark:text-fg-muted">
                {emptyText ?? t('playground.noInjectYet')}
              </span>
            )}
          </p>
          <button type="button" onClick={() => view.onReview(null)} className={btnSecondary}>
            {t('playground.review.back')}
          </button>
        </div>
      )}
      {shown ? (
        <div className="relative">
          {/* The number and code on a line of their own, between the steps
              to its neighbours, so the timer sits at their right without
              taking width from the title below. The heading still reads
              the number first. */}
          <Panel
            eyebrow={
              // Clear of the text size and timer, placed over this row.
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-32">
                <InjectPager inject={shown} view={view} neighbours={neighbours} onStep={step} />
                {/* Its status on the number's line, so the title stands alone. */}
                {!endex && <StagePill live={!reviewed}>{label}</StagePill>}
              </span>
            }
            titleClassName={view.presenting ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}
            title={
              endex ? undefined : (
                <>
                  <span className="sr-only">
                    {t('playground.seq', { seq: view.sequence.get(shown.code) ?? '' })}{' '}
                  </span>
                  {shown.title}
                </>
              )
            }
            label={endex ? shown.title : undefined}
            meta={endex ? label : undefined}
          >
            {endex ? (
              <EndexBody inject={shown} textSize={shownSize} />
            ) : (
              <InjectBody ttxId={ttxId} inject={shown} textSize={shownSize} />
            )}
          </Panel>
          <div className="absolute top-4 right-5 flex items-center gap-3">
            <TextSizeControls size={textSize} />
            {timer && timer.code === shown.code && timer.node}
          </div>
        </div>
      ) : (
        <Panel label={label}>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {emptyText ?? t('playground.noInjectYet')}
          </p>
        </Panel>
      )}
    </div>
  )
}

/** Injects to look back on, each folded, under a heading. */
export function InjectHistory({
  ttxId,
  injects,
  heading,
  textSize,
  view = defaultView(injects),
}: {
  ttxId: string
  injects: RunInject[]
  heading: string
  textSize?: string
  view?: Pick<StageView, 'sequence' | 'showCodes'>
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-sm font-semibold">
        {heading}
      </h2>
      {injects.map((inject) => (
        <details key={inject.code} className="group rounded-sm border border-panel-line bg-panel">
          {/* The marker inline with the title (a flex title would push the
              native one onto a line of its own). */}
          <summary className="flex cursor-pointer list-none items-baseline gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="inline-block text-paper-ink/60 transition-transform group-open:rotate-90 motion-reduce:transition-none dark:text-fg-muted"
            >
              ▸
            </span>
            <InjectTitle inject={inject} view={view} />
          </summary>
          <div className="border-t border-panel-line p-4">
            <InjectBody ttxId={ttxId} inject={inject} textSize={textSize} />
          </div>
        </details>
      ))}
    </section>
  )
}
