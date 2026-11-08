import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch } from '../lib/api'
import { useToast } from './useToast'

/** Renumbering a document's codes in order (`POST …/renumber`), with an
 * Undo toast that sends the previous codes back. The document comes back
 * from the server: `onServer` replaces the page's copy (callers only offer
 * it with nothing unsaved). `read` picks it out of the response. `extra`
 * goes in both requests (the MSEL's `confirm_frozen`, once confirmed). */
export function useRenumberCodes<
  K extends string,
  R extends { previous: Record<string, string> },
  D,
>({
  url,
  read,
  onServer,
  onError,
}: {
  url: string
  read: (result: R) => D
  onServer: (document: D) => void
  onError: (err: unknown) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  async function send(kind: K, codes: Record<string, string> | null, extra: object) {
    setBusy(true)
    try {
      const result = await apiFetch<R>(url, {
        method: 'POST',
        body: JSON.stringify({ kind, codes, ...extra }),
      })
      onServer(read(result))
      return result.previous
    } catch (err) {
      onError(err)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function renumber(kind: K, extra: object) {
    const previous = await send(kind, null, extra)
    if (!previous) return
    showToast(t('common.renumber.done'), {
      action: {
        label: t('common.toast.undo'),
        onAction: () => {
          void send(kind, previous, extra).then((back) => {
            if (back) showToast(t('common.renumber.undone'))
          })
        },
      },
    })
  }

  return { renumber: (kind: K, extra: object = {}) => void renumber(kind, extra), busy }
}
