/** How many mounted forms currently hold unsaved edits. Module-level
 * rather than React state: in-app navigation points (ContextBar, links,
 * logout) only need to ask "is anything dirty?" at the moment they act,
 * and a counter lets several forms register independently. */
let dirtyForms = 0

/** Registers one dirty form; the returned release is idempotent. */
export function registerDirtyForm(): () => void {
  dirtyForms += 1
  let released = false
  return () => {
    if (released) return
    released = true
    dirtyForms -= 1
  }
}

export function hasUnsavedChanges(): boolean {
  return dirtyForms > 0
}
