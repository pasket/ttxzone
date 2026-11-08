import { useEffect, useState } from 'react'

import { apiFetch } from '../lib/api'
import type { OidcPublicConfig } from '../lib/types'

const OFF: OidcPublicConfig = { enabled: false, display_name: null, provider_kind: null }

/** Whether the deployment offers single sign-on, and as what. Off until
 * the answer comes (and if it never does). Asked once `enabled` (the
 * sign-in page waits until the session check says no one is signed in). */
export function useOidcConfig(enabled = true): OidcPublicConfig {
  const [config, setConfig] = useState<OidcPublicConfig>(OFF)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    apiFetch<OidcPublicConfig>('/auth/oidc/config')
      .then((value) => {
        if (!cancelled) setConfig(value)
      })
      .catch(() => {
        // No button: password sign-in still works.
      })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return config
}
