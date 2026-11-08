import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { apiFetch, SESSION_EXPIRED_EVENT } from './api'
import { AuthContext, loadAuthSnapshot, markSessionExpired } from './authStore'
import { forgetWorkspace } from './lastWorkspace'
import { resolveDefaultContext } from './moduleAccess'
import { broadcastSessionEnded, subscribeSessionEnded } from './sessionActivity'
import type { ContextRole, DefaultContext } from './moduleAccess'
import type { AuthMeResponse, OrganizationSummary, TTXRead } from './types'
import type { AuthSnapshot, AuthStatus } from './authStore'

/** Keep `prevId` if it's still present among `scoped`, otherwise reseed to
 * the first item -- the one reconciliation rule shared by both active-org
 * and active-ttx state below. */
function reconcileId<T extends { id: string }>(
  prevId: string | null,
  scoped: T[],
  fallbackId: string | null = scoped[0]?.id ?? null,
): string | null {
  if (prevId !== null && scoped.some((item) => item.id === prevId)) return prevId
  return fallbackId
}

function savedDefaults(user: AuthMeResponse | null): DefaultContext {
  return {
    organizationId: user?.default_organization_id ?? null,
    role: user?.default_role ?? null,
    ttxId: user?.default_ttx_id ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthMeResponse | null>(null)
  const [allTtxList, setAllTtxList] = useState<TTXRead[]>([])
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([])
  const [activeOrganizationId, setActiveOrganizationIdRaw] = useState<string | null>(null)
  const [activeTtxId, setActiveTtxId] = useState<string | null>(null)
  const [executionRole, setExecutionRole] = useState<ContextRole | null>(null)

  const applySnapshot = useCallback((snapshot: AuthSnapshot) => {
    setStatus(snapshot.status)
    setUser(snapshot.user)
    setAllTtxList(snapshot.ttxList)
    setOrganizations(snapshot.organizations)
    // Keep the current active org if it's still valid (e.g. a manual
    // switch surviving an unrelated refresh() after creating a TTX);
    // otherwise seed from the user's saved default, falling back to
    // whichever org comes first.
    setActiveOrganizationIdRaw((prevOrgId) => {
      // Keep a mid-session selection that's still valid; otherwise open
      // the saved default context (Preferences -> Workspace),
      // falling back level by level to the first available one.
      const keepOrg =
        prevOrgId !== null && snapshot.organizations.some((o) => o.organization_id === prevOrgId)
      const resolved = resolveDefaultContext(
        keepOrg
          ? snapshot.organizations.filter((o) => o.organization_id === prevOrgId)
          : snapshot.organizations,
        snapshot.ttxList,
        savedDefaults(snapshot.user),
      )
      // Reconciled against the just-resolved org (not the stale prevOrgId)
      // so a refresh() that also changes the active org doesn't leave a
      // TTX id from the old org sitting in state.
      const scopedTtx = snapshot.ttxList.filter(
        (t) => t.organization_id === resolved.organizationId,
      )
      setActiveTtxId((prevTtxId) => reconcileId(prevTtxId, scopedTtx, resolved.ttxId))
      return resolved.organizationId
    })
  }, [])

  // Switching org must also reseed the active TTX against the new org's
  // own list -- exposed under the same public name so callers (the
  // context bar's org selector) don't need to know two things changed.
  // A caller that already resolved the exercise to land on passes it
  // (`ttxId`, possibly null for "none") so state and route agree.
  const setActiveOrganizationId = useCallback(
    (organizationId: string, ttxId?: string | null) => {
      setActiveOrganizationIdRaw(organizationId)
      if (ttxId !== undefined) {
        setActiveTtxId(ttxId)
        return
      }
      const scopedTtx = allTtxList.filter((t) => t.organization_id === organizationId)
      // Same resolution Home() uses to pick the landing route, so the
      // active exercise matches the role it lands on.
      const resolved = resolveDefaultContext(
        organizations.filter((o) => o.organization_id === organizationId),
        allTtxList,
        savedDefaults(user),
      )
      setActiveTtxId((prev) => reconcileId(prev, scopedTtx, resolved.ttxId))
    },
    [allTtxList, organizations, user],
  )

  const followTtx = useCallback(
    (ttxId: string) => {
      const ttx = allTtxList.find((t) => t.id === ttxId)
      if (!ttx) return
      setActiveOrganizationIdRaw(ttx.organization_id)
      setActiveTtxId(ttx.id)
    },
    [allTtxList],
  )

  const refresh = useCallback(async () => {
    applySnapshot(await loadAuthSnapshot())
  }, [applySnapshot])

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    // A new session starts from the default workspace.
    forgetWorkspace()
    broadcastSessionEnded(false)
    await refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    loadAuthSnapshot().then((snapshot) => {
      if (!cancelled) applySnapshot(snapshot)
    })
    return () => {
      cancelled = true
    }
  }, [applySnapshot])

  // A request refused for lack of a session (it expired while the page was
  // open): re-check once and, if it's really gone, go anonymous -- the
  // route guards then send the user to /login, which says why and brings
  // them back to this page once they sign in again. Ignored while loading
  // or already anonymous (the /auth/me probe itself answers 401 there).
  const statusRef = useRef(status)
  const emailRef = useRef(user?.email ?? null)
  // Synced before the browser paints (a layout effect): once the page shows
  // a signed-in state, an expiry reported by its first request must not be
  // read against the previous status and ignored.
  useLayoutEffect(() => {
    statusRef.current = status
    emailRef.current = user?.email ?? null
  }, [status, user])
  // Gone anonymous because the session ended on its own (expired, timed
  // out): remember where the user was so /login can say why and bring
  // them back. Not applySnapshot: the active organization and exercise
  // are kept, so signing back in as the same account (whose snapshot still
  // lists them) returns to the same context, not the login default.
  const dropExpiredSession = useCallback(() => {
    if (statusRef.current === 'loading' || statusRef.current === 'anonymous') return
    statusRef.current = 'anonymous'
    markSessionExpired(
      `${window.location.pathname}${window.location.search}`,
      emailRef.current ?? '',
    )
    setStatus('anonymous')
    setUser(null)
    setAllTtxList([])
    setOrganizations([])
  }, [])

  const expireSession = useCallback(async () => {
    if (statusRef.current === 'loading' || statusRef.current === 'anonymous') return
    // Ends it server-side too: the server's own soft timeout may still be
    // a few seconds away, and the next request would otherwise renew it.
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined)
    broadcastSessionEnded(true)
    dropExpiredSession()
  }, [dropExpiredSession])

  useEffect(() => {
    let checking = false
    async function handleSessionExpired() {
      if (checking || statusRef.current === 'loading' || statusRef.current === 'anonymous') return
      checking = true
      try {
        const snapshot = await loadAuthSnapshot()
        if (snapshot.status !== 'anonymous') return
        dropExpiredSession()
      } finally {
        checking = false
      }
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [dropExpiredSession])

  // Another tab signed out (or its session timed out): this one follows.
  useEffect(
    () =>
      subscribeSessionEnded((expired) => {
        if (expired) dropExpiredSession()
        else void refresh()
      }),
    [dropExpiredSession, refresh],
  )

  const activeOrganization =
    organizations.find((o) => o.organization_id === activeOrganizationId) ?? null
  const ttxList = allTtxList.filter((t) => t.organization_id === activeOrganizationId)
  const activeTtx = ttxList.find((t) => t.id === activeTtxId) ?? null

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        ttxList,
        organizations,
        activeOrganizationId,
        activeOrganization,
        allTtxList,
        setActiveOrganizationId,
        activeTtxId,
        activeTtx,
        setActiveTtxId,
        executionRole,
        setExecutionRole,
        followTtx,
        refresh,
        logout,
        expireSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
