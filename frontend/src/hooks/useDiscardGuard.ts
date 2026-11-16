import { useState } from 'react'

/** A form dialog that asks before throwing away what was typed: `touch`
 * goes on the form's `onChange` (any field's change reaches it), and
 * `requestClose` replaces the plain close on Escape, the backdrop and
 * Cancel. Once something changed it shows `common/DiscardConfirm` in the
 * dialog's footer instead of closing. */
export function useDiscardGuard(onClose: () => void) {
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  return {
    confirming,
    touch: () => setTouched(true),
    requestClose: () => (touched ? setConfirming(true) : onClose()),
    keep: () => setConfirming(false),
    discard: onClose,
  }
}
