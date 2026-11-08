import { useState } from 'react'

import { ApiError } from '../lib/api'
import { acceptedLegal } from '../lib/legal'
import type { LegalDocumentListResponse } from '../lib/types'
import { useApiResource } from './useApiResource'

/** A signup form's acceptance of the deployment's published legal
 * documents (GET /legal): nothing to accept while none is published. */
export function useLegalConsent() {
  const { data, loading, refetch } = useApiResource<LegalDocumentListResponse>('/legal')
  const [accepted, setAccepted] = useState(false)
  const documents = data?.items ?? []

  return {
    documents,
    accepted,
    setAccepted,
    /** Loaded, and accepted when there is anything to accept. */
    ready: !loading && (documents.length === 0 || accepted),
    /** The signup body's `accepted_legal`. */
    payload: accepted ? acceptedLegal(documents) : [],
    /** A new version was published while the form was open: reload the
     * documents and ask again. True when it handled `err`. */
    handleError(err: unknown) {
      if (err instanceof ApiError && err.code === 'LEGAL_VERSION_OUTDATED') {
        setAccepted(false)
        refetch()
        return true
      }
      return false
    },
  }
}

export type LegalConsent = ReturnType<typeof useLegalConsent>
