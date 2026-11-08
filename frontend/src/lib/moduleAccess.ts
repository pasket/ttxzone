import type { OrganizationSummary, TTXRead } from './types'

export type ModuleName = 'admin' | 'creator' | 'control' | 'playground'

export const MODULE_DEFS: {
  name: ModuleName
  path: string
  titleKey: 'admin.title' | 'creator.title' | 'control.title' | 'execution.title'
}[] = [
  { name: 'admin', path: '/admin', titleKey: 'admin.title' },
  { name: 'creator', path: '/creator', titleKey: 'creator.title' },
  { name: 'control', path: '/control', titleKey: 'control.title' },
  { name: 'playground', path: '/playground', titleKey: 'execution.title' },
]

/** A role the acting user can hold within the active organization, as
 * the context bar's Role segment presents it. `program_manager`/`planner`
 * can be org-scoped grants; every other role comes from per-TTX access --
 * Controller and Facilitator from the planning and control team flags of
 * a `planner` row (`controls`, `facilitates`), the rest from the row's
 * own role. */
export type ContextRole =
  'program_manager' | 'planner' | 'controller' | 'facilitator' | 'evaluator' | 'observer' | 'player'

/** The Role selector's order. */
const ROLE_ORDER: ContextRole[] = [
  'program_manager',
  'planner',
  'controller',
  'facilitator',
  'evaluator',
  'observer',
  'player',
]

/** The roles that act on the Player landing (Execution): Players, and
 * the Facilitators, Observers and Evaluators who sit with them,
 * identified as such. */
const EXECUTION_ROLES: ContextRole[] = ['facilitator', 'evaluator', 'observer', 'player']

/** Whether `ttx` (one of the user's exercises) lets them act as `role` --
 * the client twin of the backend's TTXAccess.context_roles(). */
export function actsAs(ttx: TTXRead, role: ContextRole): boolean {
  if (ttx.role === 'planner') {
    if (role === 'planner') return ttx.plans
    if (role === 'controller') return ttx.controls
    if (role === 'facilitator') return ttx.facilitates
    if (role === 'evaluator') return ttx.evaluates
    if (role === 'observer') return ttx.observes
    return false
  }
  return role !== 'program_manager' && ttx.role === role
}

/** The single module each role works in. */
export function moduleForRole(role: ContextRole): ModuleName {
  if (role === 'program_manager') return 'admin'
  if (role === 'planner') return 'creator'
  if (role === 'controller') return 'control'
  return 'playground'
}

export type VisibleModules = Record<ModuleName, boolean>

/** Which top-level modules are visible **within the active organization**
 * (ttxList here is expected to already be org-filtered, see
 * AuthContext.tsx): one per held role. Creator is visible from org-scoped
 * Planner membership alone (`is_planner`) too -- a brand-new Planner with
 * zero TTX yet still needs to reach Creator to create their first one. */
export function getVisibleModules(
  activeOrg: Pick<OrganizationSummary, 'is_program_manager' | 'is_planner'> | null,
  ttxList: TTXRead[],
): VisibleModules {
  const holds = (role: ContextRole) => ttxList.some((ttx) => actsAs(ttx, role))
  return {
    admin: activeOrg?.is_program_manager ?? false,
    creator: (activeOrg?.is_planner ?? false) || holds('planner'),
    control: holds('controller'),
    playground: EXECUTION_ROLES.some(holds),
  }
}

/** TTX instances that qualify for the given module's TTX switcher --
 * Admin has no TTX param, so this is only meaningful for the others. */
export function ttxOptionsForModule(
  module: Exclude<ModuleName, 'admin'>,
  ttxList: TTXRead[],
): TTXRead[] {
  const roles = (module === 'playground' ? EXECUTION_ROLES : [roleForModule(module)]).filter(
    (role): role is ContextRole => role !== null,
  )
  return activeFirst(ttxList.filter((ttx) => roles.some((role) => actsAs(ttx, role))))
}

/** Archived exercises after the others (order otherwise kept), so a
 * "first available" pick lands on one still in play. */
function activeFirst(ttxList: TTXRead[]): TTXRead[] {
  return [...ttxList].sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at))
}

function roleForModule(module: ModuleName): ContextRole | null {
  if (module === 'admin') return 'program_manager'
  if (module === 'creator') return 'planner'
  if (module === 'control') return 'controller'
  return null
}

/** Which module a given pathname belongs to -- used by the Header (TTX
 * switcher) and PrimaryNav (which section list to render) to know "where
 * am I" without each re-deriving it separately. */
export function currentModuleFromPath(pathname: string): ModuleName {
  return MODULE_DEFS.find((m) => pathname.startsWith(m.path))?.name ?? 'admin'
}

/** Whether a pathname is on an actual module route (as opposed to e.g.
 * /account/settings/*, which reuses the same Header but isn't "inside" any
 * module) -- ContextBar only renders on module routes. */
export function isModuleRoute(pathname: string): boolean {
  return MODULE_DEFS.some((m) => pathname.startsWith(m.path))
}

/** Every role the user holds in the active organization, in a fixed
 * order -- the options of the Role selector. Planner counts from the
 * org-scoped grant alone (a brand-new Planner with no exercise yet),
 * same rule as Creator's visibility in getVisibleModules. */
export function heldRoles(
  activeOrg: Pick<OrganizationSummary, 'is_program_manager' | 'is_planner'> | null,
  ttxList: TTXRead[],
): ContextRole[] {
  return ROLE_ORDER.filter((role) => {
    if (role === 'program_manager') return activeOrg?.is_program_manager ?? false
    if (role === 'planner' && activeOrg?.is_planner) return true
    return ttxList.some((ttx) => actsAs(ttx, role))
  })
}

/** The role the user is acting as right now: fixed by module for
 * Admin/Creator/Control; on the Player landing (Execution), what the
 * active exercise makes them there -- the one picked in the Role selector
 * (`preferred`) when the exercise allows it, since a team member can be
 * its Facilitator, Evaluator and Observer at once; else the first. */
export function currentContextRole(
  module: ModuleName,
  activeTtx: TTXRead | null,
  preferred: ContextRole | null = null,
): ContextRole | null {
  const fixed = roleForModule(module)
  if (fixed) return fixed
  if (!activeTtx) return null
  if (preferred && EXECUTION_ROLES.includes(preferred) && actsAs(activeTtx, preferred)) {
    return preferred
  }
  return EXECUTION_ROLES.find((role) => actsAs(activeTtx, role)) ?? null
}

/** Exercises a role works with -- the TTX selector only offers the
 * current role's exercises, so switching between acting as, say,
 * Controller and Facilitator goes through the Role selector. */
export function ttxOptionsForRole(role: ContextRole, ttxList: TTXRead[]): TTXRead[] {
  return activeFirst(ttxList.filter((ttx) => actsAs(ttx, role)))
}

/** Where to go when switching to `role` (Role selector), plus the
 * exercise to make active so the Role segment and the URL agree on
 * arrival. Stays on `currentTtxId` (the exercise in context) when the
 * new role acts on it; otherwise that role's first exercise. */
export function contextEntry(
  role: ContextRole,
  ttxList: TTXRead[],
  currentTtxId: string | null = null,
): { path: string; ttxId: string | null } {
  const options = role === 'program_manager' ? [] : ttxOptionsForRole(role, ttxList)
  const target = options.find((ttx) => ttx.id === currentTtxId) ?? options[0]
  return {
    path: routeForContext({ organizationId: null, role, ttxId: target?.id ?? null }) ?? '/',
    ttxId: target?.id ?? null,
  }
}

/** The user's saved default context (Preferences -> Workspace);
 * any level may be null ("first available"). */
export interface DefaultContext {
  organizationId: string | null
  role: ContextRole | null
  ttxId: string | null
}

export interface ResolvedContext {
  organizationId: string | null
  role: ContextRole | null
  ttxId: string | null
}

/** Resolve the context to open with: the saved default where it's still
 * valid, falling back level by level to the first available option --
 * first organization, then the first role held there (heldRoles' order:
 * Program Manager > Planner > Controller > Facilitator > Evaluator >
 * Observer > Player), then that role's first exercise. A default
 * that disappeared (access revoked, exercise deleted) or was never set
 * degrades to "first available" instead of failing. The role/exercise
 * defaults only apply inside the default organization. */
export function resolveDefaultContext(
  organizations: OrganizationSummary[],
  allTtxList: TTXRead[],
  defaults: DefaultContext,
): ResolvedContext {
  const org =
    organizations.find((o) => o.organization_id === defaults.organizationId) ?? organizations[0]
  if (!org) return { organizationId: null, role: null, ttxId: null }
  const isDefaultOrg = org.organization_id === defaults.organizationId
  const scoped = allTtxList.filter((ttx) => ttx.organization_id === org.organization_id)

  const roles = heldRoles(org, scoped)
  const role =
    isDefaultOrg && defaults.role && roles.includes(defaults.role)
      ? defaults.role
      : (roles[0] ?? null)

  // Program Manager works without an exercise; still keep one active so a
  // later switch to Creator/Execution has something selected.
  const candidates = role && role !== 'program_manager' ? ttxOptionsForRole(role, scoped) : scoped
  const ttx =
    (isDefaultOrg && candidates.find((t) => t.id === defaults.ttxId)) || candidates[0] || null
  return { organizationId: org.organization_id, role, ttxId: ttx?.id ?? null }
}

/** The context to open when switching to another organization from the
 * context bar: keep acting as `currentRole` when it's also held there,
 * otherwise fall back to the first role held there (same order as
 * resolveDefaultContext), on that role's first exercise in the new org. */
export function contextForOrgSwitch(
  org: OrganizationSummary,
  allTtxList: TTXRead[],
  currentRole: ContextRole | null,
): ResolvedContext {
  const scoped = allTtxList.filter((ttx) => ttx.organization_id === org.organization_id)
  const roles = heldRoles(org, scoped)
  const role = currentRole && roles.includes(currentRole) ? currentRole : (roles[0] ?? null)
  const candidates = role && role !== 'program_manager' ? ttxOptionsForRole(role, scoped) : scoped
  return { organizationId: org.organization_id, role, ttxId: candidates[0]?.id ?? null }
}

/** Where a resolved context lands: the role's workspace, on its exercise
 * when it has one. */
export function routeForContext(context: ResolvedContext): string | null {
  const { role, ttxId } = context
  if (role === null) return null
  if (role === 'program_manager') return '/admin'
  if (role === 'planner') return ttxId ? `/creator/${ttxId}` : '/creator/exercises'
  const base = `/${moduleForRole(role)}`
  return ttxId ? `${base}/${ttxId}` : role === 'controller' ? base : null
}

/** Whether there's any default to choose: several organizations, several
 * roles in one of them, or several exercises. Gates Preferences' Workspace
 * section. */
export function hasContextChoices(
  organizations: OrganizationSummary[],
  allTtxList: TTXRead[],
): boolean {
  if (organizations.length > 1 || allTtxList.length > 1) return true
  return organizations.some(
    (org) =>
      heldRoles(
        org,
        allTtxList.filter((ttx) => ttx.organization_id === org.organization_id),
      ).length > 1,
  )
}
