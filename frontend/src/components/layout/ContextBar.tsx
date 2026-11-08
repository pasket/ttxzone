import { startTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useConfirmDiscardChanges } from '../../hooks/useUnsavedChangesWarning'
import {
  badgeNeutral,
  breadcrumbSelectWrapper,
  breadcrumbSeparator,
  breadcrumbStatic,
  chipSelectWrapper,
  linkAccent,
  selectCompact,
} from '../../lib/buttonStyles'
import {
  contextEntry,
  contextForOrgSwitch,
  currentContextRole,
  currentModuleFromPath,
  heldRoles,
  isModuleRoute,
  moduleForRole,
  routeForContext,
  ttxOptionsForModule,
  ttxOptionsForRole,
} from '../../lib/moduleAccess'
import type { ContextRole, ModuleName } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import { RoleIcon } from '../common/RoleIcon'

const chipImageClass = 'h-4 w-4 shrink-0 rounded-full object-cover'

function displayOrgName(org: { organization_name: string; alias: string | null }): string {
  return org.alias ? `${org.organization_name} (${org.alias})` : org.organization_name
}

/** Scope, first crumb. No visible caption: the trail reads as
 * "Org / Exercise" on its own; screen readers get the caption via
 * sr-only text (static) or the select's aria-label (pickable). */
function OrgSegment() {
  const { t } = useTranslation()
  const {
    organizations,
    allTtxList,
    activeOrganizationId,
    setActiveOrganizationId,
    activeTtx,
    executionRole,
  } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const confirmDiscard = useConfirmDiscardChanges()
  const activeOrg =
    organizations.find((org) => org.organization_id === activeOrganizationId) ?? organizations[0]
  const logo = activeOrg.logo_url && (
    <img width={16} height={16} src={activeOrg.logo_url} alt="" className={chipImageClass} />
  )

  if (organizations.length === 1) {
    return (
      <span className={breadcrumbStatic}>
        {logo}
        <span className="sr-only">{t('nav.orgLabel')}: </span>
        <span translate="no" className="truncate">
          {displayOrgName(organizations[0])}
        </span>
      </span>
    )
  }
  return (
    <div className={breadcrumbSelectWrapper}>
      {logo}
      <select
        name="organization"
        translate="no"
        aria-label={t('nav.selectOrganization')}
        value={activeOrganizationId ?? organizations[0].organization_id}
        onChange={(e) => {
          // Declining leaves the controlled value untouched.
          if (!confirmDiscard()) return
          const org = organizations.find((o) => o.organization_id === e.target.value)
          if (!org) return
          // Keep acting as the same role when the new org has it, else its
          // first role; land straight on that role's workspace.
          const next = contextForOrgSwitch(
            org,
            allTtxList,
            currentContextRole(currentModuleFromPath(pathname), activeTtx, executionRole),
          )
          // The router applies navigations as a transition; set the context
          // in the same one so both commit together. Otherwise the new org
          // renders first under the old URL, and its exercise (not in the
          // new org) redirects or gets followed back to the old org.
          startTransition(() => {
            setActiveOrganizationId(org.organization_id, next.ttxId)
            navigate(routeForContext(next) ?? '/')
          })
        }}
        className={selectCompact}
      >
        {organizations.map((org) => (
          <option key={org.organization_id} value={org.organization_id}>
            {displayOrgName(org)}
          </option>
        ))}
      </select>
    </div>
  )
}

// The selector value that is a destination, not an exercise (never a UUID).
const ALL_EXERCISES = '__all__'

/** Scope, second crumb -- backed by AuthContext's `activeTtxId`, not the
 * URL: picking an exercise on an org-scoped route (no `:ttxId`, e.g.
 * /creator/players) only updates context; on a ttx-scoped route it
 * also navigates, keeping the open section. Renders its own leading "/"
 * so the separator never dangles when there's nothing to show. With no
 * exercise yet, a Planner gets a way to create one instead of a
 * dead-end "none available" message (hidden on the no-exercise overview
 * and the New exercise page, which have their own create button). In
 * Creator it is always a selector, ending in "All exercises" (the
 * portfolio, shown as the value while you're on it). */
function TtxSegment({
  module,
  role,
}: {
  module: Exclude<ModuleName, 'admin'>
  role: ContextRole | null
}) {
  const { t } = useTranslation()
  const { ttxList, activeTtxId, setActiveTtxId } = useAuth()
  const navigate = useNavigate()
  const confirmDiscard = useConfirmDiscardChanges()
  const location = useLocation()
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()

  // In Execution, only the exercises of the role you're acting as -- the
  // Role segment is how you switch between, say, acting as Facilitator
  // and as Observer.
  // Archived ones last (both helpers order them so), in a group of their own.
  const options =
    module === 'playground' && role
      ? ttxOptionsForRole(role, ttxList)
      : ttxOptionsForModule(module, ttxList)
  const archivedOptions = options.filter((ttx) => ttx.archived_at)
  const activeOptions = options.filter((ttx) => !ttx.archived_at)
  const separator = (
    <span aria-hidden="true" className={breadcrumbSeparator}>
      /
    </span>
  )

  if (options.length === 0) {
    // Hidden where the page itself already offers to create one.
    if (
      module !== 'creator' ||
      ['/creator/exercise', '/creator/exercises', '/creator/exercises/new'].includes(
        location.pathname,
      )
    ) {
      return null
    }
    return (
      <>
        {separator}
        <Link
          to="/creator/exercises/new"
          className={`shrink-0 rounded px-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
        >
          <span aria-hidden="true">+ </span>
          {t('nav.createExercise')}
        </Link>
      </>
    )
  }
  // Creating one: the context is the exercise being made, not the one
  // you came from; the new one takes over once it's created.
  if (location.pathname === '/creator/exercises/new') {
    return (
      <>
        {separator}
        <span className={breadcrumbStatic}>
          <span className="sr-only">{t('nav.ttxLabel')}: </span>
          <span className="truncate italic text-paper-ink/70 dark:text-fg-muted">
            {t('nav.creatingExercise')}
          </span>
        </span>
      </>
    )
  }
  const activeOption = options.find((ttx) => ttx.id === activeTtxId) ?? options[0]
  const image = activeOption.image_url && (
    <img width={16} height={16} src={activeOption.image_url} alt="" className={chipImageClass} />
  )

  // Creator: the organization's exercises live behind this selector, not
  // in the Primary Menu -- "All exercises" opens the portfolio (where a new
  // one is created) without changing the exercise in context.
  const portfolio = module === 'creator'
  const onPortfolio = portfolio && location.pathname === '/creator/exercises'

  function handleChange(newTtxId: string) {
    if (!confirmDiscard()) return
    if (newTtxId === ALL_EXERCISES) {
      navigate('/creator/exercises')
      return
    }
    setActiveTtxId(newTtxId)
    // Picking an exercise on the portfolio leaves it for that exercise's
    // first page: the portfolio doesn't depend on the exercise in context.
    if (onPortfolio) {
      navigate(`/creator/${newTtxId}/exercise`)
      return
    }
    if (ttxId) {
      const base = `/${module}/${newTtxId}`
      // The section -- or, on a literal route with no `:section` param
      // ("/creator/:ttxId/library/injects"), the path after the exercise.
      const rest = section ?? location.pathname.split('/').slice(3).join('/')
      navigate(rest ? `${base}/${rest}` : base)
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      {separator}
      {options.length === 1 && !portfolio ? (
        <span className={breadcrumbStatic}>
          {image}
          <span className="sr-only">{t('nav.ttxLabel')}: </span>
          <span translate="no" className="truncate">
            {options[0].name}
          </span>
          {options[0].archived_at && (
            <span className="shrink-0 text-xs text-paper-ink/70 dark:text-fg-muted">
              {t('creator.exercises.archivedBadge')}
            </span>
          )}
        </span>
      ) : (
        <div className={breadcrumbSelectWrapper}>
          {!onPortfolio && image}
          <select
            name="exercise"
            translate="no"
            aria-label={t('nav.selectTtx')}
            value={onPortfolio ? ALL_EXERCISES : (activeTtxId ?? options[0].id)}
            onChange={(e) => handleChange(e.target.value)}
            className={selectCompact}
          >
            {activeOptions.map((ttx) => (
              <option key={ttx.id} value={ttx.id}>
                {ttx.name}
              </option>
            ))}
            {archivedOptions.length > 0 && (
              <optgroup label={t('nav.archivedExercises')}>
                {archivedOptions.map((ttx) => (
                  <option key={ttx.id} value={ttx.id}>
                    {ttx.name}
                  </option>
                ))}
              </optgroup>
            )}
            {portfolio && (
              <optgroup label={t('nav.exerciseActions')}>
                <option value={ALL_EXERCISES}>{t('nav.allExercises')}</option>
              </optgroup>
            )}
          </select>
        </div>
      )}
    </span>
  )
}

/** Mode: the role you're acting as, as a pill between the organization and
 * the exercise -- it comes from the organization and decides which
 * exercises the next segment lists. Read-only when you hold one role in
 * the active organization; a selector when you hold several (e.g. Program
 * Manager and Planner of the same org) -- picking one takes you to that
 * role's workspace. */
function RoleSegment({ role }: { role: ContextRole }) {
  const { t } = useTranslation()
  const { activeOrganization, ttxList, activeTtxId, setActiveTtxId, setExecutionRole } = useAuth()
  const navigate = useNavigate()
  const confirmDiscard = useConfirmDiscardChanges()
  const roles = heldRoles(activeOrganization, ttxList)
  const key = CONTEXT_ROLE_LABEL_KEYS[role]

  function handleChange(next: ContextRole) {
    if (!confirmDiscard()) return
    // On the Player landing one exercise can make someone Facilitator,
    // Evaluator and Observer at once: remember which.
    if (moduleForRole(next) === 'playground') setExecutionRole(next)
    // Stay on the exercise in context when the new role acts on it.
    const entry = contextEntry(next, ttxList, activeTtxId)
    if (entry.ttxId) setActiveTtxId(entry.ttxId)
    navigate(entry.path)
  }

  if (roles.length < 2) {
    return (
      <span className={`${badgeNeutral} shrink-0`}>
        <RoleIcon role={role} />
        <span className="sr-only">{t('nav.roleLabel')}: </span>
        <span className="truncate">{t(key)}</span>
      </span>
    )
  }
  return (
    <div className={`${chipSelectWrapper} shrink-0`}>
      <RoleIcon role={role} />
      <select
        name="role"
        aria-label={t('nav.selectRole')}
        value={role}
        onChange={(e) => handleChange(e.target.value as ContextRole)}
        className={selectCompact}
      >
        {roles.map((option) => (
          <option key={option} value={option}>
            {t(CONTEXT_ROLE_LABEL_KEYS[option])}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Platform's context: the whole instance, acted on as its administrator.
 * Nothing to pick -- Platform sits above every organization, so no
 * organization, role or exercise applies there. */
function PlatformScope() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('nav.contextLabel')}
      className="flex h-[52px] items-center gap-4 overflow-x-auto border-t border-paper-line bg-paper-surface px-4 dark:border-line dark:bg-surface"
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className={breadcrumbStatic}>
          <span className="sr-only">{t('platform.context.scopeLabel')}: </span>
          <span className="truncate">{t('platform.context.scope')}</span>
        </span>
        <span aria-hidden="true" className={breadcrumbSeparator}>
          ›
        </span>
        <span className={`${badgeNeutral} shrink-0`}>
          <span className="sr-only">{t('nav.roleLabel')}: </span>
          <span className="truncate">{t('platform.context.role')}</span>
        </span>
      </div>
    </nav>
  )
}

/** The context strip under the logo row -- the single source of truth for
 * "what context am I acting in"; every screen and form reads it from
 * useAuth()'s activeOrganizationId/activeTtxId instead of asking again.
 * One trail read left to right in dependency order: Organization › Role /
 * Exercise -- the role is held in the organization and filters its
 * exercises; each role works in one module, so picking the role is
 * picking the workspace. */
export function ContextBar() {
  const { t } = useTranslation()
  const { organizations, activeTtx, executionRole } = useAuth()
  const location = useLocation()

  // Only render on an actual module route, or Preferences (which reuses
  // this same Header) would wrongly show a context that doesn't apply --
  // currentModuleFromPath falls back to 'admin' for any unmatched path.
  const module = currentModuleFromPath(location.pathname)
  if (location.pathname.startsWith('/platform')) return <PlatformScope />
  if (!isModuleRoute(location.pathname)) return null

  const role = currentContextRole(module, activeTtx, executionRole)
  const showOrg = organizations.length > 0
  if (!showOrg && role === null && module === 'admin') return null

  return (
    <nav
      aria-label={t('nav.contextLabel')}
      className="flex h-[52px] items-center gap-4 overflow-x-auto border-t border-paper-line bg-paper-surface px-4 dark:border-line dark:bg-surface"
    >
      <div className="flex min-w-0 items-center gap-1">
        {showOrg && <OrgSegment />}
        {role && (
          <>
            {showOrg && (
              <span aria-hidden="true" className={breadcrumbSeparator}>
                ›
              </span>
            )}
            <RoleSegment role={role} />
          </>
        )}
        {module !== 'admin' && <TtxSegment module={module} role={role} />}
      </div>
    </nav>
  )
}
