import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { btnNeutralIconGhost } from '../../lib/buttonStyles'

/** Icon-only row action that *navigates* -- a real link (middle-click,
 * open in new tab, correct semantics for screen readers), styled like
 * `EditButton`'s neutral icon button. `label` is both the accessible name
 * and the hover tooltip. */
export function IconLinkButton({
  to,
  label,
  icon,
}: {
  to: string
  label: string
  icon: ReactNode
}) {
  return (
    <Link to={to} aria-label={label} title={label} className={btnNeutralIconGhost}>
      {icon}
    </Link>
  )
}

/** Bar-chart glyph for "open dashboard" actions. */
export function ChartIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="M8 17v-5" />
      <path d="M13 17V8" />
      <path d="M18 17v-9" />
    </svg>
  )
}
