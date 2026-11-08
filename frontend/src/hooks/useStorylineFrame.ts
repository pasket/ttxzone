import { useState } from 'react'

/** Where a frame remembers the viewer's choices (this browser only). */
export interface StorylineFrameStorage {
  open: string
  pinned: string
  session: string
  legend: string
}

/** What the viewer gets before choosing anything. Without `open`, the
 * fold starts open on a wide screen and folded on a narrow one. */
export interface StorylineFrameDefaults {
  open?: boolean
  pinned: boolean
  session: boolean
  legend: boolean
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage unavailable: the default applies.
    return null
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not remembered; the frame still switches.
  }
}

function initiallyOpen(key: string, fallback?: boolean): boolean {
  const stored = read(key)
  if (stored) return stored === 'open'
  if (fallback !== undefined) return fallback
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches
}

function initiallyOn(key: string, on: string, off: string, fallback: boolean): boolean {
  const stored = read(key)
  return stored === on ? true : stored === off ? false : fallback
}

/** The frame's state, kept by the page that draws in it (so it can unfold
 * the frame itself, as the MSEL does on the Phases tab). */
export function useStorylineFrame(
  storage: StorylineFrameStorage,
  defaults: StorylineFrameDefaults,
) {
  const [open, setOpen] = useState(() => initiallyOpen(storage.open, defaults.open))
  // Over the page, larger -- and back exactly as it was (open or folded).
  const [maximized, setMaximized] = useState(false)
  const [pinned, setPinned] = useState(() =>
    initiallyOn(storage.pinned, 'pinned', 'unpinned', defaults.pinned),
  )
  const [showSession, setShowSession] = useState(() =>
    initiallyOn(storage.session, 'shown', 'hidden', defaults.session),
  )
  const [showLegend, setShowLegend] = useState(() =>
    initiallyOn(storage.legend, 'shown', 'hidden', defaults.legend),
  )
  return {
    open,
    setOpen,
    maximized,
    setMaximized,
    pinned,
    showSession,
    showLegend,
    toggleOpen() {
      setOpen(!open)
      remember(storage.open, open ? 'closed' : 'open')
    },
    togglePinned() {
      setPinned(!pinned)
      remember(storage.pinned, pinned ? 'unpinned' : 'pinned')
    },
    toggleSession() {
      setShowSession(!showSession)
      remember(storage.session, showSession ? 'hidden' : 'shown')
    },
    toggleLegend() {
      setShowLegend(!showLegend)
      remember(storage.legend, showLegend ? 'hidden' : 'shown')
    },
  }
}

export type StorylineFrameState = ReturnType<typeof useStorylineFrame>
