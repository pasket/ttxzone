import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { ContextRole } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { RunPresence } from '../../lib/types'
import { RoleIcon } from '../common/RoleIcon'

const ORDER: ContextRole[] = ['player', 'controller', 'facilitator', 'evaluator', 'observer']

interface Group {
  role: ContextRole
  people: RunPresence[]
  /** How many there are: more than `people` names when the server sends
   * only a few (a Player's view of hundreds). */
  count: number
}

/** Present people by role, in ORDER, with each role's count from
 * `counts` (the server's) or else the list itself. */
function presenceGroups(presence: RunPresence[], counts?: Record<string, number>): Group[] {
  return ORDER.map((role) => {
    const people = presence.filter((p) => p.role === role)
    return { role, people, count: counts?.[role] ?? people.length }
  }).filter((group) => group.count > 0)
}

/** "and N more" under the names, when there are more than were named. */
function MoreNames({ group }: { group: Group }) {
  const { t } = useTranslation()
  const named = group.people.filter((person) => person.name).length
  if (named === 0 || group.count <= named) return null
  return (
    <li className="text-paper-ink/60 dark:text-fg-muted">
      {t('playground.presentMore', { count: group.count - named })}
    </li>
  )
}

/** Who is on the Playground right now, counted by role; the names behind
 * each count unfold on demand (a Player sees the team only as numbers).
 * `aside` shares the strip at the right -- the rooms (where a Player is,
 * the room switch for everyone else) -- and wraps under the counts when
 * the row runs out of width, so the sticky band spends one row on both. */
export function PresenceBar({
  presence,
  counts,
  aside,
}: {
  presence: RunPresence[]
  counts?: Record<string, number>
  aside?: ReactNode
}) {
  const groups = presenceGroups(presence, counts)

  if (groups.length === 0 && !aside) return null
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 rounded-sm border border-panel-line bg-panel px-4 py-2 text-sm">
      {groups.length > 0 && <Present groups={groups} />}
      {aside && <div className="max-w-full min-w-0">{aside}</div>}
    </div>
  )
}

function Present({ groups }: { groups: Group[] }) {
  const { t } = useTranslation()
  return (
    <details className="group min-w-0 flex-1 basis-48">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold">{t('playground.present')}</span>
        {groups.map(({ role, count }) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <RoleIcon role={role} />
            {t('playground.presentCount', {
              count,
              role: t(CONTEXT_ROLE_LABEL_KEYS[role]),
            })}
          </span>
        ))}
      </summary>
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {groups.flatMap(({ role, people }) =>
          people
            .filter((person) => person.name)
            .map((person) => (
              <li key={`${role}-${person.name}`} className="flex items-center gap-1.5">
                <RoleIcon role={role} />
                <span>{person.name}</span>
                <span className="text-xs text-paper-ink/60 dark:text-fg-muted">
                  {t(CONTEXT_ROLE_LABEL_KEYS[role])}
                </span>
              </li>
            )),
        )}
        {groups.map((group) => (
          <MoreNames key={`more-${group.role}`} group={group} />
        ))}
      </ul>
    </details>
  )
}

/** Who is present, on a projector: a column at the right, each role's
 * count, with the Players' names under theirs -- the team's only as
 * numbers, as a Player sees them, since the room may hold Players. Folded,
 * a rail of role icons and counts. `toggle` folds it. */
export function PresenceColumn({
  presence,
  counts,
  folded,
  toggle,
}: {
  presence: RunPresence[]
  counts?: Record<string, number>
  folded: boolean
  toggle: ReactNode
}) {
  const { t } = useTranslation()
  const groups = presenceGroups(presence, counts).map((group) => ({
    ...group,
    people: group.people.map((p) => (group.role === 'player' ? p : { ...p, name: null })),
  }))

  if (folded) {
    return (
      <aside
        aria-label={t('playground.present')}
        className="flex w-12 flex-col items-center gap-3 rounded-sm border border-panel-line bg-panel py-2"
      >
        {toggle}
        {groups.map(({ role, count }) => (
          <span
            key={role}
            title={t('playground.presentCount', {
              count,
              role: t(CONTEXT_ROLE_LABEL_KEYS[role]),
            })}
            className="flex flex-col items-center text-sm tabular-nums"
          >
            <RoleIcon role={role} />
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">
              {t('playground.presentCount', {
                count,
                role: t(CONTEXT_ROLE_LABEL_KEYS[role]),
              })}
            </span>
          </span>
        ))}
      </aside>
    )
  }
  return (
    <aside
      aria-label={t('playground.present')}
      className="w-64 space-y-3 rounded-sm border border-panel-line bg-panel px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('playground.present')}</h2>
        {toggle}
      </div>
      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.role} className="space-y-1">
            <p className="flex items-center gap-1.5 font-medium">
              <RoleIcon role={group.role} />
              {t('playground.presentCount', {
                count: group.count,
                role: t(CONTEXT_ROLE_LABEL_KEYS[group.role]),
              })}
            </p>
            {group.people.some((person) => person.name) && (
              <ul className="space-y-0.5 pl-6 text-sm text-paper-ink/70 dark:text-fg-muted">
                {group.people
                  .filter((person) => person.name)
                  .map((person) => (
                    <li key={person.name} className="truncate" title={person.name ?? undefined}>
                      {person.name}
                    </li>
                  ))}
                <MoreNames group={group} />
              </ul>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
