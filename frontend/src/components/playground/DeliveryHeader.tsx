import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { DeliveryMethod, RunInject } from '../../lib/types'

const CHANNEL_PATHS: Record<DeliveryMethod, ReactNode> = {
  // Envelope.
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  // Handset.
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  // Speech bubble.
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  // Ticket with a perforation.
  ticket: (
    <>
      <path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M14 5v14" strokeDasharray="2 2" />
    </>
  ),
  // Shield.
  security_tool: <path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z" />,
  // Two people.
  in_person: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6" />
    </>
  ),
  // Presentation board.
  briefing: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M12 16v4M8 20h8" />
    </>
  ),
  // Megaphone.
  media: <path d="M4 10v4h3l8 4V6l-8 4H4ZM18 9a4 4 0 0 1 0 6" />,
  // Page with a folded corner.
  document: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
}

function ChannelIcon({ method }: { method: DeliveryMethod }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
    >
      {CHANNEL_PATHS[method]}
    </svg>
  )
}

/** "CrowdStrike IR" -> "CI": the source's monogram. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

// Sentence-case labels beside their values, as a message's header reads.
const label = 'shrink-0 text-sm text-paper-ink/60 dark:text-fg-muted'
// Source and Audience share a label column, so their values line up.
const column = 'w-28'
const chip =
  'inline-flex h-6 max-w-full items-center gap-1.5 rounded-xs border border-panel-line bg-field px-2 text-sm whitespace-nowrap'

/** Audience chips shown before "+N more": past this (and one more, not
 * worth a button) the list folds. */
const FOLDED = 6

/** Who an inject comes from and how it arrives on one line, and who it's
 * addressed to on a row of its own below (a long audience flows across the
 * width, folded past six), above the inject's body -- labels beside their
 * values, like a message's header. Monochrome: nothing here is a state. */
export function DeliveryHeader({ inject }: { inject: RunInject }) {
  const { t } = useTranslation()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const { recipients } = inject
  const folds = recipients.length > FOLDED + 1
  const shown = folds && !expanded ? recipients.slice(0, FOLDED) : recipients
  return (
    <dl className="space-y-3 border-b border-panel-line pb-4">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
        {inject.sender && (
          <div className="flex min-w-0 items-center gap-3">
            <dt className={`${label} ${column}`}>{t('playground.delivery.source')}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-panel-line bg-field font-mono text-xs font-semibold"
              >
                {initials(inject.sender.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{inject.sender.name}</span>
                <span className="block text-xs text-paper-ink/60 dark:text-fg-muted">
                  {t(`creator.msel.actorTypes.${inject.sender.type}`)}
                </span>
              </span>
            </dd>
          </div>
        )}
        <div className="flex items-center gap-3">
          <dt className={label}>{t('playground.delivery.channel')}</dt>
          <dd>
            <span className={chip}>
              <ChannelIcon method={inject.delivery_method} />
              {t(`creator.msel.deliveryMethods.${inject.delivery_method}`)}
            </span>
          </dd>
        </div>
      </div>
      {recipients.length > 0 && (
        <div className="flex items-start gap-3">
          {/* Level with the first row of chips. */}
          <dt className={`${label} ${column} leading-6`}>
            {t('playground.delivery.audience')}
            <span className="ml-1.5 font-mono">· {recipients.length}</span>
          </dt>
          <dd className="min-w-0 flex-1">
            <ul id={listId} className="flex flex-wrap items-center gap-1.5">
              {shown.map((recipient, index) => (
                <li key={`${index}-${recipient}`} className={chip} title={recipient}>
                  <span className="truncate">{recipient}</span>
                </li>
              ))}
              {folds && (
                <li>
                  <button
                    type="button"
                    onClick={() => setExpanded((open) => !open)}
                    aria-expanded={expanded}
                    aria-controls={listId}
                    className={`${chip} text-paper-ink/70 hover:border-accent hover:text-accent-fg focus-visible:border-accent dark:text-fg-muted`}
                  >
                    {expanded
                      ? t('playground.delivery.less')
                      : t('playground.delivery.more', { count: recipients.length - FOLDED })}
                  </button>
                </li>
              )}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  )
}
