import type { ReactNode } from 'react'

/** The control center's icon-only session actions, in the stroke style of
 * the app's other row icons (`common/IconButton`). */
function Glyph({ children, className = 'h-4 w-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PauseIcon() {
  return (
    <Glyph>
      <path d="M9 5v14M15 5v14" />
    </Glyph>
  )
}

export function PlayIcon() {
  return (
    <Glyph>
      <path d="M7 5l12 7-12 7z" />
    </Glyph>
  )
}

export function StopIcon() {
  return (
    <Glyph>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </Glyph>
  )
}

/** Release again the inject before the one in play: back to a bar. */
export function StepBackIcon() {
  return (
    <Glyph>
      <path d="M18 6l-8 6 8 6V6zM6 6v12" />
    </Glyph>
  )
}

/** Reset the time since the last inject: a stopwatch turning back. */
export function TimerResetIcon() {
  return (
    <Glyph>
      <path d="M10 2h4M12 9v4l2 2" />
      <path d="M4.5 14A7.5 7.5 0 1 0 7 7.6M4 4v4h4" />
    </Glyph>
  )
}

/** Release (or fire) an inject: a send arrow. */
export function ReleaseIcon() {
  return (
    <Glyph>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </Glyph>
  )
}

/** Jump ahead to an inject and release it: forward to a bar. */
export function JumpIcon() {
  return (
    <Glyph>
      <path d="M4 6l7 6-7 6V6zM11 6l7 6-7 6V6zM20 6v12" />
    </Glyph>
  )
}

/** Skip an inject: past it, to a bar. */
export function SkipIcon() {
  return (
    <Glyph>
      <path d="M5 12h11M12 7l5 5-5 5M20 5v14" />
    </Glyph>
  )
}

/** Put an inject on the main room's screen: a screen on its stand. */
export function ProjectIcon() {
  return (
    <Glyph>
      <rect x="3" y="4" width="18" height="12" rx="1" />
      <path d="M12 16v4M8 20h8" />
    </Glyph>
  )
}

/** ENDEX: the end of play (the session's End button once it's out, and the
 * closing message on the stage). */
export function FlagIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Glyph>
  )
}

/** An inject's supporting material. */
export function PaperclipIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7" />
    </Glyph>
  )
}

/** A key question the table has covered. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Glyph>
  )
}
