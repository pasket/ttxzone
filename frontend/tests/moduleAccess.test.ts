import { describe, expect, it } from 'vitest'

import {
  contextEntry,
  currentContextRole,
  getVisibleModules,
  hasContextChoices,
  heldRoles,
  contextForOrgSwitch,
  resolveDefaultContext,
  routeForContext,
  moduleForRole,
  ttxOptionsForModule,
} from '../src/lib/moduleAccess'
import type { TTXRead } from '../src/lib/types'

/** One of the user's exercises; a 'planner' row plans unless `flags`
 * say otherwise. */
function ttx(
  role: string,
  id = role,
  flags: Partial<
    Pick<TTXRead, 'plans' | 'controls' | 'facilitates' | 'evaluates' | 'observes'>
  > = {},
): TTXRead {
  return {
    id,
    name: role,
    description: null,
    organization_id: 'org-1',
    created_by_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    role,
    plans: role === 'planner',
    controls: false,
    facilitates: false,
    evaluates: false,
    observes: false,
    ...flags,
  } as TTXRead
}

const NO_MODULES = { admin: false, creator: false, control: false, playground: false }

function org(is_program_manager: boolean, is_planner: boolean) {
  return { is_program_manager, is_planner }
}

describe('getVisibleModules', () => {
  it('program-manager org sees only admin when they hold no TTXAccess there', () => {
    expect(getVisibleModules(org(true, false), [])).toEqual({ ...NO_MODULES, admin: true })
  })

  it('org-scoped planner sees creator even with zero TTX yet in that org', () => {
    expect(getVisibleModules(org(false, true), [])).toEqual({ ...NO_MODULES, creator: true })
  })

  it('a planner sees creator only; a controller control; a facilitator the Playground', () => {
    expect(getVisibleModules(org(false, false), [ttx('planner')])).toEqual({
      ...NO_MODULES,
      creator: true,
    })
    const controller = ttx('planner', 'c', { plans: false, controls: true })
    expect(getVisibleModules(org(false, false), [controller])).toEqual({
      ...NO_MODULES,
      control: true,
    })
    const facilitator = ttx('planner', 'f', { plans: false, controls: true, facilitates: true })
    expect(getVisibleModules(org(false, false), [facilitator])).toEqual({
      ...NO_MODULES,
      control: true,
      playground: true,
    })
  })

  it('player, observer and evaluator see the Playground only', () => {
    for (const role of ['player', 'observer', 'evaluator']) {
      expect(getVisibleModules(org(false, false), [ttx(role)])).toEqual({
        ...NO_MODULES,
        playground: true,
      })
    }
  })

  it('combines the org program-manager flag with per-TTX roles in that org', () => {
    expect(getVisibleModules(org(true, false), [ttx('player', 'ttx-a')])).toEqual({
      ...NO_MODULES,
      admin: true,
      playground: true,
    })
  })

  it('no active organization and empty ttxList sees nothing', () => {
    expect(getVisibleModules(null, [])).toEqual(NO_MODULES)
  })
})

describe('ttxOptionsForModule', () => {
  const list = [
    ttx('planner', 'e', { plans: true, controls: true }),
    ttx('planner', 'f', { plans: false, controls: true, facilitates: true }),
    ttx('player', 'p'),
  ]

  it('creator offers the exercises the user plans', () => {
    expect(ttxOptionsForModule('creator', list).map((t) => t.id)).toEqual(['e'])
  })

  it('control offers the exercises the user controls', () => {
    expect(ttxOptionsForModule('control', list).map((t) => t.id)).toEqual(['e', 'f'])
  })

  it('the Playground offers the ones played, facilitated, observed or evaluated', () => {
    expect(ttxOptionsForModule('playground', list).map((t) => t.id)).toEqual(['f', 'p'])
  })
})

describe('context-bar roles', () => {
  const programManagerAndManager = { is_program_manager: true, is_planner: true }

  it('lists every role held in the org, org-scoped grants included', () => {
    // Program Manager + Planner of the same org, no exercise yet.
    expect(heldRoles(programManagerAndManager, [])).toEqual(['program_manager', 'planner'])
    expect(heldRoles({ is_program_manager: false, is_planner: false }, [ttx('player')])).toEqual([
      'player',
    ])
  })

  it('lists Controller and Facilitator from the team flags, in order', () => {
    const list = [
      ttx('player', 'p1'),
      ttx('planner', 'e1', { plans: true, controls: true, facilitates: true }),
      ttx('observer', 'o1'),
    ]
    expect(heldRoles(programManagerAndManager, list)).toEqual([
      'program_manager',
      'planner',
      'controller',
      'facilitator',
      'observer',
      'player',
    ])
  })

  it('derives the acting role from the module, and from the exercise in Execution', () => {
    expect(currentContextRole('admin', null)).toBe('program_manager')
    expect(currentContextRole('creator', null)).toBe('planner')
    expect(currentContextRole('control', null)).toBe('controller')
    expect(currentContextRole('playground', ttx('player'))).toBe('player')
    expect(currentContextRole('playground', ttx('observer'))).toBe('observer')
    const facilitator = ttx('planner', 'f', { controls: true, facilitates: true })
    expect(currentContextRole('playground', facilitator)).toBe('facilitator')
    // A team member who doesn't facilitate has no place at the table.
    expect(currentContextRole('playground', ttx('planner'))).toBeNull()
    expect(currentContextRole('playground', null)).toBeNull()
  })

  it('lets a team member also act as the exercise Evaluator and Observer', () => {
    const both = ttx('planner', 'c', {
      plans: false,
      controls: true,
      facilitates: true,
      evaluates: true,
      observes: true,
    })
    expect(heldRoles(org(false, false), [both])).toEqual([
      'controller',
      'facilitator',
      'evaluator',
      'observer',
    ])
    // Execution: the role picked in the Role selector, when the exercise
    // allows it; else the first.
    expect(currentContextRole('playground', both)).toBe('facilitator')
    expect(currentContextRole('playground', both, 'evaluator')).toBe('evaluator')
    expect(currentContextRole('playground', both, 'observer')).toBe('observer')
    expect(currentContextRole('playground', both, 'player')).toBe('facilitator')
    expect(currentContextRole('control', both, 'evaluator')).toBe('controller')
  })

  it('gives each role a single workspace', () => {
    expect(moduleForRole('program_manager')).toBe('admin')
    expect(moduleForRole('planner')).toBe('creator')
    expect(moduleForRole('controller')).toBe('control')
    for (const role of ['facilitator', 'evaluator', 'observer', 'player'] as const) {
      expect(moduleForRole(role)).toBe('playground')
    }
  })

  it("routes a role switch to that role's workspace and exercise", () => {
    expect(contextEntry('program_manager', [])).toEqual({ path: '/admin', ttxId: null })
    expect(contextEntry('planner', [])).toEqual({ path: '/creator/exercises', ttxId: null })
    const list = [
      ttx('player', 'p1'),
      ttx('planner', 'e1', { plans: true, controls: true, facilitates: true }),
    ]
    expect(contextEntry('planner', list)).toEqual({ path: '/creator/e1', ttxId: 'e1' })
    expect(contextEntry('controller', list)).toEqual({ path: '/control/e1', ttxId: 'e1' })
    expect(contextEntry('facilitator', list)).toEqual({ path: '/playground/e1', ttxId: 'e1' })
    expect(contextEntry('player', list)).toEqual({ path: '/playground/p1', ttxId: 'p1' })
  })

  it('keeps the exercise in context when the new role acts on it', () => {
    const list = [
      ttx('planner', 'e1', { plans: true, controls: true }),
      ttx('planner', 'e2', { plans: true, controls: true }),
      ttx('player', 'p1'),
    ]
    expect(contextEntry('controller', list, 'e2')).toEqual({ path: '/control/e2', ttxId: 'e2' })
    expect(contextEntry('planner', list, 'e2')).toEqual({ path: '/creator/e2', ttxId: 'e2' })
    // Not an exercise the new role acts on: that role's first one.
    expect(contextEntry('player', list, 'e2')).toEqual({ path: '/playground/p1', ttxId: 'p1' })
    expect(contextEntry('program_manager', list, 'e2')).toEqual({ path: '/admin', ttxId: null })
  })
})

describe('Evaluator role', () => {
  const noOrgRole = { is_program_manager: false, is_planner: false }

  it('is held per exercise, after Planner and before Player', () => {
    expect(
      heldRoles({ is_program_manager: true, is_planner: true }, [
        ttx('player', 'p1'),
        ttx('evaluator', 'v1'),
      ]),
    ).toEqual(['program_manager', 'planner', 'evaluator', 'player'])
  })

  it('works on the Player landing', () => {
    const list = [ttx('evaluator', 'v1')]
    expect(getVisibleModules(noOrgRole, list)).toEqual({ ...NO_MODULES, playground: true })
    expect(currentContextRole('playground', ttx('evaluator'))).toBe('evaluator')
    expect(contextEntry('evaluator', list)).toEqual({ path: '/playground/v1', ttxId: 'v1' })
    expect(routeForContext({ organizationId: 'org-1', role: 'evaluator', ttxId: 'v1' })).toBe(
      '/playground/v1',
    )
  })
})

describe('default context resolution', () => {
  const abc = {
    organization_id: 'abc',
    organization_name: 'Abc',
    alias: null,
    logo_url: null,
    domain: null,
    is_program_manager: true,
    is_planner: true,
  }
  const other = { ...abc, organization_id: 'other', is_program_manager: false, is_planner: true }
  const list = [
    { ...ttx('player', 'p1'), organization_id: 'abc' },
    { ...ttx('planner', 'e1'), organization_id: 'abc' },
  ]
  const none = { organizationId: null, role: null, ttxId: null }

  it('falls back to the first org, first held role and its first exercise', () => {
    expect(resolveDefaultContext([abc, other], list, none)).toEqual({
      organizationId: 'abc',
      role: 'program_manager',
      ttxId: 'p1',
    })
    expect(resolveDefaultContext([], list, none)).toEqual(none)
  })

  it('uses a valid saved default, level by level', () => {
    expect(
      resolveDefaultContext([abc, other], list, {
        organizationId: 'abc',
        role: 'player',
        ttxId: 'p1',
      }),
    ).toEqual({ organizationId: 'abc', role: 'player', ttxId: 'p1' })
    // Exercise deleted since: first exercise of the saved role instead.
    expect(
      resolveDefaultContext([abc], list, {
        organizationId: 'abc',
        role: 'planner',
        ttxId: 'gone',
      }),
    ).toEqual({ organizationId: 'abc', role: 'planner', ttxId: 'e1' })
    // Organization gone: its role/exercise defaults don't leak elsewhere.
    expect(
      resolveDefaultContext([other], [], {
        organizationId: 'abc',
        role: 'player',
        ttxId: 'p1',
      }),
    ).toEqual({ organizationId: 'other', role: 'planner', ttxId: null })
  })

  it('routes to the role workspace', () => {
    expect(routeForContext({ organizationId: 'abc', role: 'program_manager', ttxId: 'p1' })).toBe(
      '/admin',
    )
    expect(routeForContext({ organizationId: 'abc', role: 'planner', ttxId: null })).toBe(
      '/creator/exercises',
    )
    expect(routeForContext({ organizationId: 'abc', role: 'player', ttxId: 'p1' })).toBe(
      '/playground/p1',
    )
    expect(routeForContext(none)).toBeNull()
  })

  it('only offers a default selection when there is a choice', () => {
    const single = { ...abc, is_planner: false }
    expect(hasContextChoices([single], [])).toBe(false)
    expect(hasContextChoices([abc], [])).toBe(true)
    expect(hasContextChoices([single, other], [])).toBe(true)
    expect(hasContextChoices([single], list)).toBe(true)
  })
})

describe('org switch context', () => {
  const abc = {
    organization_id: 'abc',
    organization_name: 'Abc',
    alias: null,
    logo_url: null,
    domain: null,
    is_program_manager: true,
    is_planner: true,
  }
  const globex = { ...abc, organization_id: 'globex', is_program_manager: false }
  const playerOnly = { ...abc, organization_id: 'po', is_program_manager: false, is_planner: false }
  const list = [
    { ...ttx('planner', 'a1'), organization_id: 'abc' },
    { ...ttx('player', 'p1'), organization_id: 'po' },
  ]

  it('keeps a role held in the new org, landing on that role without an exercise', () => {
    const next = contextForOrgSwitch(globex, list, 'planner')
    expect(next).toEqual({ organizationId: 'globex', role: 'planner', ttxId: null })
    expect(routeForContext(next)).toBe('/creator/exercises')
  })

  it('keeps the role and opens its first exercise in the new org', () => {
    expect(contextForOrgSwitch(abc, list, 'planner')).toEqual({
      organizationId: 'abc',
      role: 'planner',
      ttxId: 'a1',
    })
  })

  it('falls back to the first role held in the new org', () => {
    expect(contextForOrgSwitch(globex, list, 'program_manager').role).toBe('planner')
    const next = contextForOrgSwitch(playerOnly, list, 'planner')
    expect(next).toEqual({ organizationId: 'po', role: 'player', ttxId: 'p1' })
    expect(routeForContext(next)).toBe('/playground/p1')
  })
})
