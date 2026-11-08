import type { ContextRole, ModuleName } from './moduleAccess'

type SectionTitleKey =
  | 'creator.sections.exercise'
  | 'creator.sections.needs'
  | 'creator.sections.players'
  | 'creator.sections.msel'
  | 'creator.sections.conductPrep'
  | 'creator.sections.library'
  | 'creator.sections.afterAction'
  | 'control.sections.dashboard'
  | 'control.sections.evaluation'
  | 'execution.sections.enrollments'
  | 'execution.sections.dashboard'
  | 'execution.sections.evaluation'
  | 'admin.sections.organization'
  | 'admin.sections.usersAndRoles'
  | 'admin.sections.exercises'
  | 'admin.sections.settings'
  | 'admin.sections.library'
  | 'admin.sections.improvementPlan'
  | 'platform.sections.organizations'
  | 'platform.sections.accounts'
  | 'platform.sections.legal'
  | 'platform.sections.tenancy'
  | 'platform.sections.security'
  | 'platform.sections.activity'
  | 'platform.sections.email'
  | 'platform.sections.sso'
  | 'platform.sections.assistant'
  | 'account.settings.generalTitle'
  | 'account.settings.workspaceTitle'
  | 'account.settings.securityTitle'
  | 'account.settings.privacyTitle'
  | 'account.settings.assistantTitle'

export interface SectionDef {
  key: string
  path: string
  titleKey: SectionTitleKey
  /** True for a section that is org-scoped rather than TTX-scoped -- its
   * route has no `:ttxId` segment (e.g. `/creator/players`, not
   * `/creator/:ttxId/players`). PrimaryNav/MobileBottomNav use this to
   * build the right link, and to recognize the section is active even
   * when it's reached through a literal sibling route with no `:section`
   * param of its own (e.g. `/creator/players/pending`). */
  orgScoped?: boolean
  /** Roles that see the section (all when omitted). Execution is the
   * Player landing, shared with the Facilitators, Observers and
   * Evaluators who sit with the Players; only Evaluators rate with the
   * EEG there (Players never see it). */
  roles?: ContextRole[]
  /** The Primary Menu block it's listed in: what belongs to the exercise
   * picked in the ContextBar, or what spans the organization (after a
   * divider, no heading -- the order and the line say it). */
  group?: SectionGroup
}

export type SectionGroup = 'organization' | 'exercise'

/** In-module Primary Menu sections -- the "big action blocks" per module.
 * Creator's first section is the active exercise's own page (profile +
 * dashboard), mirroring Admin -> Organization: which exercise is picked in
 * the ContextBar, never from a list here. Being first and TTX-scoped, it's
 * also where a bare /creator/:ttxId lands (RequireSection's fallback). */
export const CREATOR_SECTIONS: SectionDef[] = [
  // The exercise picked in the ContextBar. The organization's exercises
  // themselves (all of them, a new one) are reached from that selector,
  // not from here.
  { key: 'exercise', path: 'exercise', titleKey: 'creator.sections.exercise', group: 'exercise' },
  { key: 'needs', path: 'needs', titleKey: 'creator.sections.needs', group: 'exercise' },
  // The scenario -- storyline, phases, timed injects, key questions -- all
  // lives in the MSEL.
  { key: 'msel', path: 'msel', titleKey: 'creator.sections.msel', group: 'exercise' },
  // How the exercise is measured and its session secured, once the MSEL
  // says how the objectives are provoked.
  {
    key: 'conduct-prep',
    path: 'conduct-prep',
    titleKey: 'creator.sections.conductPrep',
    group: 'exercise',
  },
  // After the session: the after-action report and improvement plan.
  {
    key: 'after-action',
    path: 'after-action',
    titleKey: 'creator.sections.afterAction',
    group: 'exercise',
  },
  {
    key: 'players',
    path: 'players',
    titleKey: 'creator.sections.players',
    orgScoped: true,
    group: 'exercise',
  },
  // The organization's side, shared by its exercises.
  {
    key: 'library',
    path: 'library',
    titleKey: 'creator.sections.library',
    orgScoped: true,
    group: 'organization',
  },
]

/** The Controllers' workspace: they run the exercise -- deliver the
 * MSEL injects, keep the Players in scope -- and read the EEG. */
export const CONTROL_SECTIONS: SectionDef[] = [
  { key: 'dashboard', path: 'dashboard', titleKey: 'control.sections.dashboard' },
  { key: 'evaluation', path: 'evaluation', titleKey: 'control.sections.evaluation' },
  { key: 'after-action', path: 'after-action', titleKey: 'creator.sections.afterAction' },
]

const AT_THE_TABLE: ContextRole[] = ['player', 'facilitator', 'observer', 'evaluator']

export const PLAYGROUND_SECTIONS: SectionDef[] = [
  {
    key: 'enrollments',
    path: 'enrollments',
    titleKey: 'execution.sections.enrollments',
    orgScoped: true,
    roles: ['player'],
  },
  {
    key: 'dashboard',
    path: 'dashboard',
    titleKey: 'execution.sections.dashboard',
    roles: AT_THE_TABLE,
  },
  {
    key: 'evaluation',
    path: 'evaluation',
    titleKey: 'execution.sections.evaluation',
    roles: ['evaluator'],
  },
  // The Lead Evaluator writes the after-action report (other Evaluators
  // are told they can't).
  {
    key: 'after-action',
    path: 'after-action',
    titleKey: 'creator.sections.afterAction',
    roles: ['evaluator'],
  },
]

export const ADMIN_SECTIONS: SectionDef[] = [
  { key: 'organization', path: 'organization', titleKey: 'admin.sections.organization' },
  // Every org grant a Program Manager hands out, as one people x roles matrix.
  { key: 'usersAndRoles', path: 'users-and-roles', titleKey: 'admin.sections.usersAndRoles' },
  // The organization's exercise portfolio: status, Lead Planner, delete.
  { key: 'exercises', path: 'exercises', titleKey: 'admin.sections.exercises' },
  { key: 'settings', path: 'settings', titleKey: 'admin.sections.settings' },
  // The organization's library -- simulated actors, injects and tags
  // (shared with Creator, which adds the exercise's level).
  { key: 'library', path: 'library', titleKey: 'admin.sections.library' },
  // Every improvement action of the organization's after-action reports.
  {
    key: 'improvement-plan',
    path: 'improvement-plan',
    titleKey: 'admin.sections.improvementPlan',
  },
]

/** Platform, the instance administrator's workspace: above every
 * organization, so outside the modules and their context (no
 * organization, role or exercise to pick). Its links are
 * `/platform/${path}`. */
export const PLATFORM_SECTIONS: SectionDef[] = [
  // Who may found organizations here: set once, rarely changed.
  { key: 'settings', path: 'tenancy', titleKey: 'platform.sections.tenancy' },
  { key: 'accounts', path: 'accounts', titleKey: 'platform.sections.accounts' },
  {
    key: 'organization',
    path: 'organizations',
    titleKey: 'platform.sections.organizations',
  },
  { key: 'legal', path: 'legal', titleKey: 'platform.sections.legal' },
  // How the instance sends email: the server's configuration, or set here.
  { key: 'email', path: 'email', titleKey: 'platform.sections.email' },
  // Password rules and which roles must have a second factor.
  { key: 'security', path: 'security', titleKey: 'platform.sections.security' },
  // Who may sign in through an identity provider: the server's configuration, or set here.
  { key: 'sso', path: 'sso', titleKey: 'platform.sections.sso' },
  // Whether accounts may connect an AI client, and the notice they accept.
  { key: 'assistant', path: 'assistant', titleKey: 'platform.sections.assistant' },
  // Everything above, as it was done: append-only.
  { key: 'activity', path: 'activity', titleKey: 'platform.sections.activity' },
]

/** Preferences (avatar menu): the person's own account, with the same
 * menu as a module. Workspace is listed only when there is a default to
 * choose, the AI assistant only while the deployment has it on
 * (AccountSettingsLayout). Icons share their meaning across the app: the
 * shield is sign-in security, the spark the AI assistant. */
export const ACCOUNT_SECTIONS: SectionDef[] = [
  { key: 'profile', path: 'general', titleKey: 'account.settings.generalTitle' },
  { key: 'workspace', path: 'defaults', titleKey: 'account.settings.workspaceTitle' },
  { key: 'security', path: 'security', titleKey: 'account.settings.securityTitle' },
  { key: 'privacy', path: 'privacy', titleKey: 'account.settings.privacyTitle' },
  { key: 'assistant', path: 'assistant', titleKey: 'account.settings.assistantTitle' },
]

/** The sections `role` sees (every section while the role is unknown). */
export function sectionsForRole(sections: SectionDef[], role: ContextRole | null): SectionDef[] {
  return role === null ? sections : sections.filter((s) => !s.roles || s.roles.includes(role))
}

export function sectionsForModule(module: ModuleName): SectionDef[] {
  if (module === 'creator') return CREATOR_SECTIONS
  if (module === 'control') return CONTROL_SECTIONS
  if (module === 'playground') return PLAYGROUND_SECTIONS
  return ADMIN_SECTIONS
}

/** The subset of a module's sections reachable through its `:ttxId?/:section?`
 * catch-all route -- excludes org-scoped sections (Creator's
 * invitations, Execution's enrollments), which are their own
 * literal sibling routes with no `:ttxId` segment. RequireSection's
 * "no section in the URL yet" fallback must only ever pick from this
 * subset -- picking an org-scoped section here would silently drop the
 * ttxId from the URL. */
export function ttxScopedSections(sections: SectionDef[]): SectionDef[] {
  return sections.filter((s) => !s.orgScoped)
}
