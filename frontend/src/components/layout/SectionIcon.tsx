import type { ReactNode } from 'react'

// Envelope: Execution's enrollments (joining by invitation), Platform's email.
const ENVELOPE = (
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </>
)

/** Glyph per Primary Menu section, keyed by `SectionDef.key` -- a key
 * means the same thing in every module that has it (dashboard, feed,
 * evaluation, library...), so one map serves them all. Same stroke style
 * as RoleIcon. The section's name always travels with the icon (visible
 * label, or the link's accessible name + tooltip when the menu is
 * folded), so the glyph never has to carry meaning on its own. */
const PATHS: Record<string, ReactNode> = {
  // Clipboard with lines: the exercise's own profile.
  exercise: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  // Target: what the exercise has to address.
  needs: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" />
    </>
  ),
  // Timeline of events.
  msel: (
    <>
      <path d="M6 4v16" />
      <circle cx="6" cy="7" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="6" cy="17" r="1.5" />
      <path d="M10 7h9M10 12h7M10 17h9" />
    </>
  ),
  // Checklist: getting the session ready.
  'conduct-prep': (
    <>
      <path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5" />
      <path d="M11 7h9M11 13h9M11 19h9" />
    </>
  ),
  // Two people: the exercise's Players.
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M15.5 13.6c.3-.1.7-.1 1-.1 2.5 0 4.5 2 4.5 4.5" />
    </>
  ),
  enrollments: ENVELOPE,
  // Books on a shelf.
  library: (
    <>
      <path d="M5 4v16M9 4v16M13 5l4.5 15M3.5 20h17" />
    </>
  ),
  // Four tiles.
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="4" rx="1" />
      <rect x="13" y="10" width="7" height="10" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
    </>
  ),
  // Stream of messages.
  feed: (
    <>
      <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
    </>
  ),
  // Fork: a choice between paths.
  decisions: (
    <>
      <path d="M12 21v-7M12 14L6 8M12 14l6-6" />
      <path d="M6 4v4h4M18 4v4h-4" />
    </>
  ),
  // Clipboard with a check.
  evaluation: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="1.5" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M9.5 12.5l1.75 1.75L15 10.5" />
    </>
  ),
  // Building.
  // A report with a rising line: what the exercise taught.
  'after-action': (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8.5 16l3-3 2 2 3-4" />
      <path d="M9 7h6" />
    </>
  ),
  // A checklist: actions to follow up.
  'improvement-plan': (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2" />
      <circle cx="5" cy="18" r="1" />
    </>
  ),
  organization: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10.5 21v-3h3v3" />
    </>
  ),
  // Stacked sheets: the organization's exercises.
  exercises: (
    <>
      <rect x="7" y="7" width="13" height="14" rx="1.5" />
      <path d="M4 17V4.5A1.5 1.5 0 0 1 5.5 3H16" />
      <path d="M10.5 12h6M10.5 16h4" />
    </>
  ),
  // Two people.
  usersAndRoles: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15.5 4.9a3.25 3.25 0 010 6.2M17.5 14.4c2 .8 3.5 2.9 3.5 5.6" />
    </>
  ),
  // One person: an account, whatever its organizations.
  accounts: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  // A page with a seal: terms and privacy policy.
  legal: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H11" />
      <path d="M14 3l5 5h-5z" />
      <path d="M8.5 9h3M8.5 13h4" />
      <circle cx="16.5" cy="15.5" r="2.5" />
      <path d="M15.25 17.7L14.5 21l2-1 2 1-.75-3.3" />
    </>
  ),
  // A list with a clock: what was done, and when.
  activity: (
    <>
      <path d="M4 6h9M4 11h6M4 16h5" />
      <circle cx="16.5" cy="15.5" r="4.5" />
      <path d="M16.5 13v2.5l1.75 1.25" />
    </>
  ),
  // Outgoing email.
  email: ENVELOPE,
  // A key: signing in through an identity provider.
  sso: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M21 12v2" />
    </>
  ),
  // A spark: the AI assistant.
  assistant: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </>
  ),
  // A person in a circle: your own profile and appearance (Preferences).
  profile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.7 18.4c1.2-2 3.1-3.1 5.3-3.1s4.1 1.1 5.3 3.1" />
    </>
  ),
  // A house: where you land after signing in (Preferences -> Workspace).
  workspace: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  // An eye struck through: your data and your account (Preferences -> Privacy).
  privacy: (
    <>
      <path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.6 0-3-.5-4.2-1.2" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      <path d="M4 20L20 4" />
    </>
  ),
  // A shield: the rules an account signs in under (Platform -> Sign-in
  // security, and your own in Preferences -> Security).
  security: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.25-7 10-4-1.75-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Sliders.
  settings: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
}

// A section added without its own glyph still gets a neutral dot.
const FALLBACK = <circle cx="12" cy="12" r="3" />

export function SectionIcon({ sectionKey }: { sectionKey: string }) {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[sectionKey] ?? FALLBACK}
    </svg>
  )
}
