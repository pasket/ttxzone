import type { ContextRole } from './moduleAccess'

/** Label key per context-bar role (see moduleAccess.ts's ContextRole). A
 * lookup record, not a template string -- i18next's typed resources
 * reject a widened `string` key. */
export const CONTEXT_ROLE_LABEL_KEYS = {
  program_manager: 'roles.programManager',
  planner: 'roles.planner',
  controller: 'roles.controller',
  facilitator: 'roles.facilitator',
  evaluator: 'roles.evaluator',
  observer: 'roles.observer',
  player: 'roles.player',
} as const satisfies Record<ContextRole, string>

/** TTXAccess role -> i18n key: an invitation's or access request's
 * target role, a dashboard row's role. */
export const ROLE_LABEL_KEYS = {
  planner: CONTEXT_ROLE_LABEL_KEYS.planner,
  evaluator: CONTEXT_ROLE_LABEL_KEYS.evaluator,
  observer: CONTEXT_ROLE_LABEL_KEYS.observer,
  player: CONTEXT_ROLE_LABEL_KEYS.player,
} as const
