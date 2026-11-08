import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { apiDownload, ApiError } from '../lib/api'
import { useToast } from './useToast'

/** A click handler for a download link to the API (`<a href download>`):
 * the file comes through `apiDownload`, so an expired session sends the
 * user to sign in and any other refusal shows as a toast, instead of the
 * browser leaving for the raw error. The link keeps its href for "Save
 * link as…" and modified clicks. */
export function useApiDownload() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  return (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    apiDownload(path).catch((err: unknown) => {
      // AuthProvider handles a session that's gone.
      if (err instanceof ApiError && err.status === 401) return
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    })
  }
}
