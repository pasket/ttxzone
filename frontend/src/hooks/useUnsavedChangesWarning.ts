import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { hasUnsavedChanges, registerDirtyForm } from '../lib/unsavedChanges'

// One confirm per click even when several dirty forms are listening.
const handledClicks = new WeakSet<Event>()

/** Warns before a form's unsaved edits are lost. Covers leaving the page
 * (reload/close, via `beforeunload`) and in-app navigation: clicks on any
 * same-origin link are confirmed first (plain <BrowserRouter> has no
 * route blocker, so this intercepts in the capture phase, before React
 * Router's Link handler), and ContextBar/logout ask through
 * useConfirmDiscardChanges below, which reads the same registry. */
export function useUnsavedChangesWarning(dirty: boolean) {
  const { t } = useTranslation()
  const message = t('common.unsavedChangesConfirm')

  useEffect(() => {
    if (!dirty) return
    const release = registerDirtyForm()
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      // Legacy browsers only show the prompt when returnValue is set.
      event.returnValue = ''
    }
    function handleClick(event: MouseEvent) {
      if (handledClicks.has(event) || event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return // Opens elsewhere; this page and its edits stay.
      }
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return
      // A download doesn't leave the page.
      if (link.hasAttribute('download')) return
      if (link.origin !== window.location.origin) return
      handledClicks.add(event)
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true)
    return () => {
      release()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [dirty, message])
}

/** For in-app navigation that isn't a link (ContextBar selects, logout):
 * returns a check to call right before acting -- true when nothing is
 * dirty or the user confirms discarding. */
export function useConfirmDiscardChanges() {
  const { t } = useTranslation()
  return () => !hasUnsavedChanges() || window.confirm(t('common.unsavedChangesConfirm'))
}

/** Order-insensitive id-set comparison for dirty checks on tag pickers. */
export function sameIds(selected: Set<string>, original: Iterable<string>) {
  const originalSet = new Set(original)
  return selected.size === originalSet.size && [...selected].every((id) => originalSet.has(id))
}
