import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ARTIFACT_LABEL_KEYS } from '../../lib/artifacts'
import type { InjectArtifact } from '../../lib/types'
import { FormattedText } from './FormattedText'

/** An inject's content drawn as a simulated artifact -- a fake email,
 * press release, social post or chat message -- so the table reads it the
 * way it would arrive. Every field is plain text in a fixed template drawn
 * by the app: nothing an author wrote is ever rendered as markup. Marked
 * "Simulated" so it can never pass for the real thing in a screenshot. */
export function InjectArtifactView({
  artifact,
  content,
  textSize = 'text-base',
}: {
  artifact: InjectArtifact
  content: string
  textSize?: string
}) {
  const { t } = useTranslation()
  const body = (
    <FormattedText text={content} className={`${textSize} max-w-prose leading-relaxed`} />
  )
  const simulated = (
    <span className="rounded-xs border border-panel-line px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted">
      {t('artifacts.simulated')}
    </span>
  )
  const frame = 'max-w-3xl overflow-hidden rounded-sm border border-panel-line bg-panel'
  const label = t(ARTIFACT_LABEL_KEYS[artifact.kind])

  if (artifact.kind === 'email') {
    return (
      <article aria-label={label} className={frame}>
        <header className="space-y-1 border-b border-panel-line bg-field px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-semibold text-balance">
              {artifact.subject || t('artifacts.email.noSubject')}
            </p>
            {simulated}
          </div>
          <HeaderLine label={t('artifacts.email.from')}>
            <span className="font-medium">{artifact.sender}</span>
            {artifact.sender_address && (
              <span className="text-paper-ink/60 dark:text-fg-muted">
                {' '}
                &lt;{artifact.sender_address}&gt;
              </span>
            )}
          </HeaderLine>
          {artifact.recipient && (
            <HeaderLine label={t('artifacts.email.to')}>{artifact.recipient}</HeaderLine>
          )}
          {artifact.timestamp && (
            <HeaderLine label={t('artifacts.email.date')}>{artifact.timestamp}</HeaderLine>
          )}
        </header>
        <div className="px-4 py-4">{body}</div>
      </article>
    )
  }

  if (artifact.kind === 'press_release') {
    return (
      <article aria-label={label} className={`${frame} px-6 py-5`}>
        <div className="flex items-start justify-between gap-3 border-b border-panel-line pb-3">
          <p className="text-sm font-semibold tracking-wide uppercase">
            {artifact.sender || t('artifacts.pressRelease.label')}
          </p>
          {simulated}
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted">
          {t('artifacts.pressRelease.label')}
        </p>
        {artifact.subject && (
          <h3 className="mt-1 text-xl font-semibold text-balance">{artifact.subject}</h3>
        )}
        <div className="mt-3 space-y-2">
          {(artifact.location || artifact.timestamp) && (
            <p className="text-sm font-semibold">
              {[artifact.location, artifact.timestamp].filter(Boolean).join(', ')} —
            </p>
          )}
          {body}
        </div>
        {artifact.sender_address && (
          <p className="mt-4 border-t border-panel-line pt-3 text-xs text-paper-ink/60 dark:text-fg-muted">
            {t('artifacts.pressRelease.contact')}: {artifact.sender_address}
          </p>
        )}
      </article>
    )
  }

  if (artifact.kind === 'social_post') {
    const handle = artifact.sender_address.replace(/^@/, '')
    return (
      <article aria-label={label} className={`${frame} max-w-xl px-4 py-3`}>
        <div className="flex items-start gap-3">
          <Initial name={artifact.sender || handle} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm leading-tight">
                <span className="block font-semibold">{artifact.sender}</span>
                <span className="text-paper-ink/60 dark:text-fg-muted">
                  {handle && `@${handle}`}
                  {handle && artifact.timestamp && ' · '}
                  {artifact.timestamp}
                </span>
              </p>
              {simulated}
            </div>
            {body}
          </div>
        </div>
      </article>
    )
  }

  // Chat message.
  return (
    <article aria-label={label} className={`${frame} max-w-xl`}>
      <header className="flex items-center justify-between gap-3 border-b border-panel-line bg-field px-4 py-2 text-sm">
        <p className="min-w-0 truncate font-semibold">
          {artifact.location ? `# ${artifact.location.replace(/^#\s*/, '')}` : label}
        </p>
        {simulated}
      </header>
      <div className="flex items-start gap-3 px-4 py-3">
        <Initial name={artifact.sender} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">
            <span className="font-semibold">{artifact.sender}</span>
            {artifact.timestamp && (
              <span className="ml-2 text-xs text-paper-ink/60 dark:text-fg-muted">
                {artifact.timestamp}
              </span>
            )}
          </p>
          {body}
        </div>
      </div>
    </article>
  )
}

function HeaderLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex gap-2">
      <span className="w-12 shrink-0 text-paper-ink/60 dark:text-fg-muted">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

/** A neutral initial standing in for an avatar (no colour: colour marks
 * state only). */
function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-line bg-field text-sm font-semibold"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
