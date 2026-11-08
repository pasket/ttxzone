import { createContext } from 'react'

import { apiFetch, ApiError } from './api'
import type { ContextRole } from './moduleAccess'
import type {
  AuthMeResponse,
  OrganizationSummaryListResponse,
  TTXListResponse,
  TTXRead,
  OrganizationSummary,
} from './types'

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'needs-password-change'
  | 'needs-email-verification'
  | 'needs-legal-acceptance'
  | 'needs-mfa-enrollment'
  | 'ready'

export interface AuthSnapshot {
  status: AuthStatus
  user: AuthMeResponse | null
  ttxList: TTXRead[]
  organizations: OrganizationSummary[]
}

export interface AuthContextValue extends AuthSnapshot {
  /** The currently active org's own summary, or null if none selected yet
   * (e.g. a brand-new user with zero organizations). `ttxList` above is
   * already filtered to this org -- see AuthContext.tsx. */
  activeOrganizationId: string | null
  activeOrganization: OrganizationSummary | null
  /** Every exercise across all organizations -- for screens that work
   * outside the active org (Preferences' Workspace). Everything
   * else should use the org-filtered `ttxList`. */
  allTtxList: TTXRead[]
  setActiveOrganizationId: (organizationId: string, ttxId?: string | null) => void
  /** The currently active TTX within the active org, or null if the org
   * has none (or none the user has a role on). `ttxList` is already
   * filtered to the active org -- see AuthContext.tsx. */
  activeTtxId: string | null
  activeTtx: TTXRead | null
  setActiveTtxId: (ttxId: string) => void
  /** The role picked to act as on the Player landing (Execution), where
   * one exercise can make someone Facilitator, Evaluator and Observer at
   * once (see currentContextRole). Null: the first the exercise allows. */
  executionRole: ContextRole | null
  setExecutionRole: (role: ContextRole | null) => void
  /** Make a TTX the user can reach -- in any org -- the active one, its
   * org included: a link or reload to /creator/{ttx} must put the context
   * bar on that exercise, not leave it on another org. No-op for an id the
   * user has no access to. */
  followTtx: (ttxId: string) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
  /** End the session because it timed out (session policy): signs out on
   * the server, then goes anonymous the way an expired session does --
   * /login says why and brings the user back to this page. */
  expireSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

// The API's largest page of `GET /ttx`.
const TTX_PAGE = 200

/** Every exercise the user reaches, page by page: the roles they hold, the
 * modules, the two-factor rule and the ContextBar's exercise selector all
 * read this list, so it can't stop at the API's first page. */
async function loadAllExercises(): Promise<TTXRead[]> {
  const items: TTXRead[] = []
  for (;;) {
    const page = await apiFetch<TTXListResponse>(`/ttx?limit=${TTX_PAGE}&offset=${items.length}`)
    items.push(...page.items)
    if (page.items.length < TTX_PAGE || items.length >= page.total) return items
  }
}

export async function loadAuthSnapshot(): Promise<AuthSnapshot> {
  try {
    const me = await apiFetch<AuthMeResponse>('/auth/me')
    // New legal documents to accept come first: until then the API answers
    // only the account itself (LEGAL_ACCEPTANCE_REQUIRED elsewhere), so
    // there are no exercises or organizations to load yet.
    // A temporary password (reset from Platform) comes before everything:
    // the API answers only /auth/... until the person picks their own.
    if (me.password_change_required) {
      return { status: 'needs-password-change', user: me, ttxList: [], organizations: [] }
    }
    // Then confirming the address the account signed up with (a link sent
    // to it): the API answers only /auth/... until then too.
    // Or confirming it again, once past the periodic reconfirmation's grace
    // period: the same screen.
    if (me.email_verification_pending || me.email_reconfirmation_overdue) {
      return { status: 'needs-email-verification', user: me, ttxList: [], organizations: [] }
    }
    if (me.legal_acceptance_pending.length > 0) {
      return { status: 'needs-legal-acceptance', user: me, ttxList: [], organizations: [] }
    }
    const [ttxItems, organizations] = await Promise.all([
      loadAllExercises(),
      apiFetch<OrganizationSummaryListResponse>('/organizations/mine'),
    ])

    // Which roles must have a second factor is the deployment's choice
    // (Platform -> Sign-in security); the backend works it out across every org
    // and exercise the user touches (security_policy_service.mfa_mandated)
    // and enforces it on every guard (core/security.py).
    // A single sign-on whose provider asked for a second factor counts as
    // one on this session (core/security.py's mfa_satisfied).
    const mfaSatisfied = me.totp_enabled || me.session?.mfa_source === 'provider'
    if (me.mfa_mandated && !mfaSatisfied) {
      return { status: 'needs-mfa-enrollment', user: me, ttxList: [], organizations: [] }
    }

    return { status: 'ready', user: me, ttxList: ttxItems, organizations: organizations.items }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { status: 'anonymous', user: null, ttxList: [], organizations: [] }
    }
    throw err
  }
}

const SESSION_EXPIRED_KEY = 'ttx_session_expired'

/** Where a user was when their session expired, and who they were. */
export interface ExpiredSession {
  /** The in-app path (with its query) to return to after signing in. */
  returnTo: string
  email: string
}

/** Remembers, for the login screen, that the user was signed out because
 * their session expired (not because they logged out), and where they
 * were. Per tab. */
export function markSessionExpired(returnTo: string, email: string): void {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, JSON.stringify({ returnTo, email }))
  } catch {
    // Storage unavailable: the login screen just won't explain why.
  }
}

/** The last sign-out, if it was an expired session (read-only, so a
 * StrictMode double render reads the same answer). */
export function readSessionExpired(): ExpiredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_EXPIRED_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<ExpiredSession>
    if (typeof value.returnTo !== 'string' || typeof value.email !== 'string') return null
    return { returnTo: value.returnTo, email: value.email }
  } catch {
    return null
  }
}

/** Where to land after signing in: back where the session expired -- only
 * for the same account (another one may not reach that page) and only an
 * in-app path (never another origin, never the login screen itself). */
export function returnPathAfterLogin(expired: ExpiredSession | null, email: string): string {
  if (!expired || expired.email.toLowerCase() !== email.trim().toLowerCase()) return '/'
  const path = expired.returnTo
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) return '/'
  return path
}

/** Forgets it, once the user signs in again. */
export function clearSessionExpired(): void {
  try {
    sessionStorage.removeItem(SESSION_EXPIRED_KEY)
  } catch {
    // Nothing to clear.
  }
}
