import type { ContextRole } from '../../lib/moduleAccess'

const sharedProps = {
  className: 'h-3.5 w-3.5 shrink-0',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function ShieldIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function ClipboardCheckIcon() {
  return (
    <svg {...sharedProps}>
      <rect x="6" y="4" width="12" height="17" rx="1.5" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M9.5 12.5l1.75 1.75L15 10.5" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg {...sharedProps}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c1-3.5 4-5.5 6.5-5.5s5.5 2 6.5 5.5" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M4 5h16v11H9l-5 4V5z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />
    </svg>
  )
}

/** Small icon for the header ContextBar's Role chip (Program Manager
 * shield, Planner clipboard, Controller sliders -- runs the exercise --
 * Facilitator speech bubble -- moderates it -- Observer eye, Evaluator
 * star -- rates it -- Player person). Hand-drawn (no icon library, same
 * reasoning as ButtonSpinner's own plain SVG), currentColor so it
 * inherits the chip's own muted text color rather than introducing a new
 * one. */
export function RoleIcon({ role }: { role: ContextRole }) {
  if (role === 'program_manager') return <ShieldIcon />
  if (role === 'planner') return <ClipboardCheckIcon />
  if (role === 'controller') return <SlidersIcon />
  if (role === 'facilitator') return <ChatIcon />
  if (role === 'observer') return <EyeIcon />
  if (role === 'evaluator') return <StarIcon />
  return <PersonIcon />
}
