import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
} from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import {
  panelActionsTh,
  panelDivider,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { filterAndSortPeople, PEOPLE_SORT_OPTIONS } from '../../lib/peopleTable'
import type {
  AssignableTag,
  ExercisePeopleListResponse,
  ExercisePersonCandidateListResponse,
  ExercisePersonRead,
  PeopleRole,
  TTXRead,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { LastLogin } from '../common/LastLogin'
import { FlagIcon, LeadEvaluatorBadge, LeadPlannerBadge } from '../common/LeadPlannerBadge'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import { RoleColumnHeader, RoleMark } from '../common/RoleMatrix'
import { RoleGuide } from '../common/RoleGuide'
import { RoleIcon } from '../common/RoleIcon'
import { TableToolbar } from '../common/TableToolbar'
import { TagAssignmentField } from '../common/TagAssignmentField'
import { TagChip } from '../common/TagChip'

/** The matrix's columns: the planning and control team's three functions,
 * then who watches and who rates. */
const COLUMNS: {
  key: 'planner' | 'controller' | 'facilitator' | 'observer' | 'evaluator'
  role: ContextRole
  label:
    | 'creator.exerciseTeam.columns.planner'
    | 'creator.exerciseTeam.columns.controller'
    | 'creator.exerciseTeam.columns.facilitator'
    | 'creator.exerciseTeam.columns.observer'
    | 'creator.exerciseTeam.columns.evaluator'
  guide:
    | 'creator.exerciseTeam.guide.planner'
    | 'creator.exerciseTeam.guide.controller'
    | 'creator.exerciseTeam.guide.facilitator'
    | 'creator.exerciseTeam.guide.observer'
    | 'creator.exerciseTeam.guide.evaluator'
  holds: (
    p: Pick<
      ExercisePersonRead,
      'role' | 'plans' | 'controls' | 'facilitates' | 'evaluates' | 'observes'
    >,
  ) => boolean
}[] = [
  {
    key: 'planner',
    role: 'planner',
    label: 'creator.exerciseTeam.columns.planner',
    guide: 'creator.exerciseTeam.guide.planner',
    holds: (p) => p.role === 'planner' && p.plans,
  },
  {
    key: 'controller',
    role: 'controller',
    label: 'creator.exerciseTeam.columns.controller',
    guide: 'creator.exerciseTeam.guide.controller',
    holds: (p) => p.role === 'planner' && p.controls,
  },
  {
    key: 'facilitator',
    role: 'facilitator',
    label: 'creator.exerciseTeam.columns.facilitator',
    guide: 'creator.exerciseTeam.guide.facilitator',
    holds: (p) => p.role === 'planner' && p.facilitates,
  },
  {
    key: 'observer',
    role: 'observer',
    label: 'creator.exerciseTeam.columns.observer',
    guide: 'creator.exerciseTeam.guide.observer',
    // An Observer, or a team member who also observes.
    holds: (p) => p.role === 'observer' || (p.role === 'planner' && p.observes),
  },
  {
    key: 'evaluator',
    role: 'evaluator',
    label: 'creator.exerciseTeam.columns.evaluator',
    guide: 'creator.exerciseTeam.guide.evaluator',
    holds: (p) => isEvaluator(p),
  },
]

/** What someone is on the exercise, as the matrix shows it: one flag per
 * column. Saved as the API's role + flags (toRoleRequest). */
interface RoleFlags {
  plans: boolean
  controls: boolean
  facilitates: boolean
  observes: boolean
  evaluates: boolean
}

const NO_ROLES: RoleFlags = {
  plans: false,
  controls: false,
  facilitates: false,
  observes: false,
  evaluates: false,
}

/** A person's matrix row as flags. */
function fromPerson(p: ExercisePersonRead): RoleFlags {
  return {
    plans: p.role === 'planner' && p.plans,
    controls: p.role === 'planner' && p.controls,
    facilitates: p.role === 'planner' && p.facilitates,
    observes: p.role === 'observer' || (p.role === 'planner' && p.observes),
    evaluates: isEvaluator(p),
  }
}

/** The flags as the API takes them: planning or controlling puts them on
 * the planning and control team (Evaluator / Observer as its flags);
 * otherwise they're an Evaluator or an Observer (never both: one watches,
 * the other takes notes and rates with the EEG). */
function toRoleRequest(flags: RoleFlags) {
  const observes = flags.observes && !flags.evaluates
  if (flags.plans || flags.controls) {
    return {
      role: 'planner' as PeopleRole,
      plans: flags.plans,
      controls: flags.controls,
      facilitates: flags.controls && flags.facilitates,
      evaluates: flags.evaluates,
      observes,
    }
  }
  return {
    role: (flags.evaluates ? 'evaluator' : 'observer') as PeopleRole,
    plans: false,
    controls: false,
    facilitates: false,
    evaluates: false,
    observes: false,
  }
}

const hasRole = (f: RoleFlags) => f.plans || f.controls || f.observes || f.evaluates

/** An Evaluator of the exercise: the role, or a team member who also
 * evaluates (the usual Controller/Evaluator of a small exercise). */
function isEvaluator(p: Pick<ExercisePersonRead, 'role' | 'evaluates'>): boolean {
  return p.role === 'evaluator' || (p.role === 'planner' && p.evaluates)
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

/** Creator -> Exercise -> Edit: everyone on the exercise besides its
 * Players, as a read-only matrix -- the planning and control team
 * (Planner, Controller, Facilitator), Observers and Evaluators. Changes
 * happen in the person's editor; only people a Program Manager granted
 * the role in Admin -> Users and roles can be given it. Tags show the
 * organization's first, then the exercise's own. The team's rules (a
 * Planner, a Controller, a lead who plans) are the backend's; the editor
 * mirrors them. */
export function ExerciseTeamPanel({
  ttx,
  availableTags,
}: {
  ttx: TTXRead
  /** The exercise's tags, owned by the host page. */
  availableTags: AssignableTag[]
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const base = `/ttx/${ttx.id}/people`
  const { data, loading, error, refetch } = useApiResource<ExercisePeopleListResponse>(base)
  const candidatesResource = useApiResource<ExercisePersonCandidateListResponse>(
    `${base}/candidates`,
  )
  const items = data?.items ?? []
  const { sortDir, setSortDir, sortBy, setSortBy, search, setSearch } = useTableUrlState(
    'team_',
    PEOPLE_SORT_OPTIONS,
  )
  const visible = filterAndSortPeople(items, {
    search,
    sortBy,
    sortDir,
    grantedAt: (item) => item.added_at,
  })

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ExercisePersonRead | null>(null)
  const [removing, setRemoving] = useState<ExercisePersonRead | null>(null)
  const [leadBusy, setLeadBusy] = useState<string | null>(null)
  const triggerRefs = useRef<Map<string, HTMLElement>>(new Map())

  async function changed(userId: string) {
    refetch()
    candidatesResource.refetch()
    // Your own roles (and the lead in the identity band) come from the
    // auth snapshot.
    if (userId === user?.id) await refresh()
    else void refresh()
  }

  async function makeLead(person: ExercisePersonRead, evaluator: boolean) {
    setLeadBusy(`${person.user_id}-${evaluator ? 'evaluator' : 'planner'}`)
    try {
      await apiFetch(
        evaluator ? `/ttx/${ttx.id}/evaluators/lead` : `/ttx/${ttx.id}/planning-team/lead`,
        { method: 'PUT', body: JSON.stringify({ user_id: person.user_id }) },
      )
      showToast(
        evaluator
          ? t('creator.exerciseTeam.leadEvaluatorToast', { name: person.full_name })
          : t('creator.planningTeam.leadToast', { name: person.full_name }),
      )
      await changed(person.user_id)
    } catch (err) {
      showToast(errorText(err, t('auth.common.genericError')), { variant: 'error' })
    } finally {
      setLeadBusy(null)
    }
  }

  const counts = Object.fromEntries(
    COLUMNS.map((c) => [c.key, items.filter((p) => c.holds(p)).length]),
  ) as Record<(typeof COLUMNS)[number]['key'], number>

  if (adding) {
    return (
      <AddPersonForm
        ttx={ttx}
        candidates={candidatesResource.data?.items ?? []}
        availableTags={availableTags}
        onClose={() => setAdding(false)}
        onAdded={async (userId) => {
          setAdding(false)
          showToast(t('creator.exerciseTeam.addedToast'))
          await changed(userId)
        }}
      />
    )
  }

  return (
    <>
      <Panel
        title={t('creator.exerciseTeam.title')}
        description={
          <RoleGuide
            id="creator.exerciseTeam.intro"
            intro={t('creator.exerciseTeam.intro', { exercise: ttx.name })}
            items={COLUMNS.map((c) => ({
              role: c.role,
              name: t(c.label),
              description: t(c.guide),
            }))}
            footnote={`${t('creator.planningTeam.leadDescription')} ${t('common.appliesImmediately')}`}
          />
        }
        aside={
          <button type="button" onClick={() => setAdding(true)} className={btnSecondary}>
            <span aria-hidden="true">+ </span>
            {t('creator.exerciseTeam.addButton')}
          </button>
        }
        flush
      >
        {error && !data && (
          <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
            {t('creator.exerciseTeam.loadError')}
          </p>
        )}
        {items.length > 0 && (
          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 ${panelDivider}`}
          >
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('creator.exerciseTeam.count', { count: items.length, exercise: ttx.name })}
            </p>
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={PEOPLE_SORT_OPTIONS}
            />
          </div>
        )}
        {items.length > 0 && visible.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('common.toolbar.noSearchResults', { query: search })}
          </p>
        )}
        {visible.length > 0 && (
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="w-full min-w-[60rem] text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={`${panelTh} sticky left-0 z-10 bg-panel`}>
                    {t('creator.exerciseTeam.columns.person')}
                  </th>
                  {COLUMNS.map((c) => (
                    <RoleColumnHeader
                      key={c.key}
                      icon={c.role}
                      count={counts[c.key]}
                      label={t(c.label)}
                      hint={t(c.guide)}
                    />
                  ))}
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('common.lastLogin.column')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('creator.exerciseTeam.columns.tags')}
                  </th>
                  <th scope="col" className={`${panelActionsTh} w-36`}>
                    {t('common.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {visible.map((person) => (
                  <tr key={person.user_id} className={panelTr}>
                    <th
                      scope="row"
                      className={`${panelTd} sticky left-0 z-10 bg-panel text-left font-normal`}
                    >
                      <span className="block font-semibold text-paper-ink dark:text-fg">
                        {person.full_name}
                        {person.user_id === user?.id && (
                          <span className="ml-1.5 text-sm font-normal text-paper-ink/60 dark:text-fg-muted">
                            {t('creator.planningTeam.youSuffix')}
                          </span>
                        )}
                        {person.is_lead && <LeadPlannerBadge />}
                        {person.leads && <LeadEvaluatorBadge />}
                      </span>
                      <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                        {person.email}
                      </span>
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={`${panelTd} text-center`}>
                        <RoleMark
                          held={c.holds(person)}
                          label={t('creator.exerciseTeam.cellLabel', {
                            role: t(c.label),
                            name: person.full_name,
                          })}
                        />
                      </td>
                    ))}
                    <td className={panelTd}>
                      <LastLogin value={person.last_login_at} />
                    </td>
                    <td className={panelTd}>
                      <div className="flex flex-wrap gap-1">
                        {person.org_tags.map((tag) => (
                          <TagChip
                            key={`org-${tag.id}`}
                            name={tag.name}
                            color={tag.color}
                            customHex={tag.custom_hex}
                          />
                        ))}
                        {person.tags.map((tag) => (
                          <TagChip
                            key={tag.id}
                            name={tag.name}
                            color={tag.color}
                            customHex={tag.custom_hex}
                          />
                        ))}
                      </div>
                    </td>
                    <td className={panelTd}>
                      <div className={actionsCellClass}>
                        {person.role === 'planner' && person.plans && !person.is_lead && (
                          <LeadButton
                            label={t('creator.planningTeam.makeLeadLabel', {
                              name: person.full_name,
                            })}
                            busy={leadBusy === `${person.user_id}-planner`}
                            disabled={leadBusy !== null}
                            onClick={() => void makeLead(person, false)}
                          />
                        )}
                        {isEvaluator(person) && !person.leads && (
                          <LeadButton
                            label={t('creator.exerciseTeam.makeLeadEvaluatorLabel', {
                              name: person.full_name,
                            })}
                            busy={leadBusy === `${person.user_id}-evaluator`}
                            disabled={leadBusy !== null}
                            onClick={() => void makeLead(person, true)}
                          />
                        )}
                        <EditButton
                          ref={(node) => {
                            if (node) triggerRefs.current.set(`edit-${person.user_id}`, node)
                          }}
                          label={t('creator.exerciseTeam.editLabel', { name: person.full_name })}
                          onClick={() => setEditing(person)}
                        />
                        <IconButton
                          label={t('creator.exerciseTeam.removeLabel', { name: person.full_name })}
                          onClick={(event) => {
                            triggerRefs.current.set(`remove-${person.user_id}`, event.currentTarget)
                            setRemoving(person)
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && (
        <EditPersonModal
          ttx={ttx}
          person={editing}
          people={items}
          availableTags={availableTags}
          onClose={() => {
            const id = editing.user_id
            setEditing(null)
            triggerRefs.current.get(`edit-${id}`)?.focus()
          }}
          onSaved={async () => {
            const id = editing.user_id
            setEditing(null)
            showToast(t('common.toast.savedSuccess'))
            await changed(id)
          }}
        />
      )}

      {removing && (
        <RemovePersonModal
          ttx={ttx}
          person={removing}
          people={items}
          isYou={removing.user_id === user?.id}
          onClose={() => {
            const id = removing.user_id
            setRemoving(null)
            triggerRefs.current.get(`remove-${id}`)?.focus()
          }}
          onRemoved={async () => {
            const self = removing.user_id === user?.id
            setRemoving(null)
            showToast(t('creator.exerciseTeam.removedToast'))
            if (self && removing.role === 'planner') {
              // No longer on this exercise's team: leave it.
              await refresh()
              navigate('/creator')
            } else await changed(removing.user_id)
          }}
        />
      )}
    </>
  )
}

/** Make someone Lead Planner or Lead Evaluator (a team member who also
 * evaluates can be offered both). */
function LeadButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      {busy ? <ButtonSpinner /> : <FlagIcon />}
    </button>
  )
}

/** Who leads: the Lead Planner (always one; changed by making someone
 * else lead) and the optional Lead Evaluator. */
interface LeadFlags {
  planner: boolean
  evaluator: boolean
}

/** The person's roles on the exercise, one checkbox per matrix column, in
 * two groups, and -- when editing -- whether they lead the planning or
 * the evaluation. The backend's rules are applied as you tick: a
 * Facilitator is a Controller, Observer and Evaluator exclude each other
 * (one watches, the other takes notes and rates), and each role
 * needs its organization grant (Planner for the first three) -- a role
 * without one is locked and listed once, with where to get it; one the
 * person already holds stays available. */
function RolesFieldset({
  value,
  onChange,
  grants,
  held = NO_ROLES,
  leads,
  heldLeads,
  onLeadsChange,
  disabled,
}: {
  value: RoleFlags
  onChange: (next: RoleFlags) => void
  grants: PeopleRole[]
  /** What they hold now: kept available even if its grant is gone. */
  held?: RoleFlags
  /** Editing only: the lead choices, and what they lead now. */
  leads?: LeadFlags
  heldLeads?: LeadFlags
  onLeadsChange?: (next: LeadFlags) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const grantFor: Record<keyof RoleFlags, PeopleRole> = {
    plans: 'planner',
    controls: 'planner',
    facilitates: 'planner',
    observes: 'observer',
    evaluates: 'evaluator',
  }
  const allowed = (key: keyof RoleFlags) => grants.includes(grantFor[key]) || held[key]
  const missing = (['planner', 'observer', 'evaluator'] as const).filter(
    (grant) =>
      !grants.includes(grant) &&
      (Object.keys(grantFor) as (keyof RoleFlags)[]).some(
        (key) => grantFor[key] === grant && !held[key],
      ),
  )

  function toggle(key: keyof RoleFlags) {
    const next = { ...value, [key]: !value[key] }
    if (key === 'controls' && !next.controls) next.facilitates = false
    // Observer or Evaluator, not both.
    if (key === 'observes' && next.observes) next.evaluates = false
    if (key === 'evaluates' && next.evaluates) next.observes = false
    onChange(next)
    if (leads && onLeadsChange) {
      onLeadsChange({
        planner: leads.planner && next.plans,
        evaluator: leads.evaluator && next.evaluates,
      })
    }
  }

  // A lead option under its role: the Lead Planner can't be unticked
  // (there's always one: make someone else lead instead).
  const leadOption = (kind: keyof LeadFlags, label: string) => {
    if (!leads || !onLeadsChange) return null
    const roleOn = kind === 'planner' ? value.plans : value.evaluates
    const fixed = kind === 'planner' && !!heldLeads?.planner && value.plans
    return (
      <label
        key={`lead-${kind}`}
        className={`ml-6.5 flex items-start gap-2 pl-0.5 text-sm ${roleOn && !fixed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
      >
        <input
          type="checkbox"
          name={`lead-${kind}`}
          checked={roleOn && leads[kind]}
          disabled={disabled || !roleOn || fixed}
          onChange={() => onLeadsChange({ ...leads, [kind]: !leads[kind] })}
          className="mt-0.5 h-4 w-4 accent-accent-fg"
        />
        <span>
          <span className="inline-flex items-center gap-1.5 font-medium text-paper-ink dark:text-fg">
            <FlagIcon />
            {label}
          </span>
          <span className="block text-paper-ink/60 dark:text-fg-muted">
            {fixed
              ? t('creator.exerciseTeam.leadPlannerFixed')
              : kind === 'planner'
                ? t('creator.exerciseTeam.leadPlannerHint')
                : t('creator.exerciseTeam.leadEvaluatorHint')}
          </span>
        </span>
      </label>
    )
  }

  const row = (key: keyof RoleFlags, role: ContextRole, label: string, hint: string) => {
    const locked = !allowed(key)
    const needsController = key === 'facilitates' && !value.controls
    return (
      <label
        key={key}
        className={`flex items-start gap-2.5 text-sm ${locked || needsController ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          name={key}
          checked={value[key]}
          disabled={disabled || locked || needsController}
          onChange={() => toggle(key)}
          className="mt-0.5 h-4 w-4 accent-accent-fg"
        />
        <span className={locked ? 'opacity-60' : undefined}>
          <span className="inline-flex items-center gap-1.5 font-medium text-paper-ink dark:text-fg">
            <RoleIcon role={role} />
            {label}
            {locked && <LockIcon label={t('creator.exerciseTeam.notGranted')} />}
          </span>
          <span className="block text-paper-ink/60 dark:text-fg-muted">{hint}</span>
        </span>
      </label>
    )
  }

  const group = (title: string, rows: React.ReactNode[], hint?: string) => (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-paper-ink/60 dark:text-fg-faint">
        {title}
      </p>
      {hint && <p className="text-xs text-paper-ink/60 dark:text-fg-muted">{hint}</p>}
      {rows}
    </div>
  )

  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-sm font-semibold text-paper-ink dark:text-fg">
        {t('creator.exerciseTeam.rolesTitle')}
      </legend>
      {group(t('creator.exerciseTeam.groupDesign'), [
        row(
          'plans',
          'planner',
          t('creator.exerciseTeam.columns.planner'),
          t('creator.exerciseTeam.short.planner'),
        ),
        leadOption('planner', t('creator.exerciseTeam.leadPlannerOption')),
        row(
          'controls',
          'controller',
          t('creator.exerciseTeam.columns.controller'),
          t('creator.exerciseTeam.short.controller'),
        ),
        row(
          'facilitates',
          'facilitator',
          t('creator.exerciseTeam.columns.facilitator'),
          t('creator.exerciseTeam.short.facilitator'),
        ),
      ])}
      {group(
        t('creator.exerciseTeam.groupWatch'),
        [
          row(
            'observes',
            'observer',
            t('creator.exerciseTeam.columns.observer'),
            t('creator.exerciseTeam.short.observer'),
          ),
          row(
            'evaluates',
            'evaluator',
            t('creator.exerciseTeam.columns.evaluator'),
            t('creator.exerciseTeam.short.evaluator'),
          ),
          leadOption('evaluator', t('creator.exerciseTeam.leadEvaluatorOption')),
        ],
        t('creator.exerciseTeam.groupWatchHint'),
      )}
      {missing.length > 0 && (
        <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
          {t('creator.exerciseTeam.missingGrants', {
            roles: missing.map((grant) => t(GRANT_LABEL_KEYS[grant])).join(', '),
          })}
        </p>
      )}
    </fieldset>
  )
}

const GRANT_LABEL_KEYS = {
  planner: 'creator.exerciseTeam.grantNames.planner',
  observer: 'creator.exerciseTeam.grantNames.observer',
  evaluator: 'creator.exerciseTeam.grantNames.evaluator',
} as const

function LockIcon({ label }: { label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 text-paper-ink/60 dark:text-fg-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <title>{label}</title>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

function TagsFieldset({
  availableTags,
  selected,
  onChange,
  orgTags,
}: {
  availableTags: AssignableTag[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  orgTags: ExercisePersonRead['org_tags']
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-paper-ink dark:text-fg">
        {t('creator.exerciseTeam.sectionTags')}
      </legend>
      {orgTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-paper-ink/60 dark:text-fg-muted">
          <span>{t('creator.exerciseTeam.orgTags')}</span>
          {orgTags.map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} customHex={tag.custom_hex} />
          ))}
        </div>
      )}
      <TagAssignmentField
        availableTags={availableTags}
        selectedTagIds={selected}
        onChange={onChange}
      />
    </fieldset>
  )
}

/** Why the change can't be saved as is (the backend's rules), or null. */
function useParticipationProblem(
  person: ExercisePersonRead | null,
  next: RoleFlags,
  people: ExercisePersonRead[],
): string | null {
  const { t } = useTranslation()
  if (!person || person.role !== 'planner') return null
  const others = people.filter((p) => p.user_id !== person.user_id && p.role === 'planner')
  const plansNext = next.plans
  const controlsNext = next.controls
  if (person.plans && !plansNext && !others.some((p) => p.plans)) {
    return t('creator.planningTeam.lastPlannerHint')
  }
  if (person.controls && !controlsNext && !others.some((p) => p.controls)) {
    return t('creator.planningTeam.lastControllerHint')
  }
  return null
}

function SuccessorField({
  person,
  people,
  value,
  onChange,
}: {
  person: ExercisePersonRead
  people: ExercisePersonRead[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor="team-successor">
        {t('creator.planningTeam.successorLabel', { name: person.full_name })}
      </label>
      <select
        id="team-successor"
        name="successor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      >
        {people
          .filter((p) => p.user_id !== person.user_id && p.role === 'planner' && p.plans)
          .map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.full_name}
            </option>
          ))}
      </select>
    </div>
  )
}

function firstOtherPlanner(person: ExercisePersonRead, people: ExercisePersonRead[]): string {
  return (
    people.find((p) => p.user_id !== person.user_id && p.role === 'planner' && p.plans)?.user_id ??
    ''
  )
}

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

/** The person's editor: 1. Role on the exercise, 2. Tags, one Save. */
function EditPersonModal({
  ttx,
  person,
  people,
  availableTags,
  onClose,
  onSaved,
}: {
  ttx: TTXRead
  person: ExercisePersonRead
  people: ExercisePersonRead[]
  availableTags: AssignableTag[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const initial = fromPerson(person)
  const [value, setValue] = useState<RoleFlags>(initial)
  const initialLeads: LeadFlags = { planner: person.is_lead, evaluator: person.leads }
  const [leads, setLeads] = useState<LeadFlags>(initialLeads)
  const [tags, setTags] = useState<Set<string>>(() => new Set(person.tags.map((tag) => tag.id)))
  const [successor, setSuccessor] = useState(() => firstOtherPlanner(person, people))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const teamProblem = useParticipationProblem(person, value, people)
  const problem = hasRole(value) ? teamProblem : t('creator.exerciseTeam.noRole')

  const roleChanged =
    JSON.stringify(toRoleRequest(value)) !== JSON.stringify(toRoleRequest(initial))
  const tagsChanged = !sameSet(tags, new Set(person.tags.map((tag) => tag.id)))
  const leadStopsPlanning = person.is_lead && !value.plans
  // Leading follows the role: a lead who stops evaluating stops leading
  // on the server already; only a change while keeping the role is sent.
  const becomesLeadPlanner = value.plans && leads.planner && !initialLeads.planner
  const leadEvaluatorChange =
    value.evaluates && leads.evaluator !== initialLeads.evaluator ? leads.evaluator : null
  const leadsChanged = becomesLeadPlanner || leadEvaluatorChange !== null

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (tagsChanged) {
        await apiFetch(`/ttx/${ttx.id}/people/${person.user_id}/tags`, {
          method: 'PUT',
          body: JSON.stringify({ tag_ids: Array.from(tags) }),
        })
      }
      if (roleChanged) {
        const query = leadStopsPlanning ? `?lead_successor_id=${encodeURIComponent(successor)}` : ''
        await apiFetch(`/ttx/${ttx.id}/people/${person.user_id}/role${query}`, {
          method: 'PUT',
          body: JSON.stringify(toRoleRequest(value)),
        })
      }
      if (becomesLeadPlanner) {
        await apiFetch(`/ttx/${ttx.id}/planning-team/lead`, {
          method: 'PUT',
          body: JSON.stringify({ user_id: person.user_id }),
        })
      }
      if (leadEvaluatorChange === true) {
        await apiFetch(`/ttx/${ttx.id}/evaluators/lead`, {
          method: 'PUT',
          body: JSON.stringify({ user_id: person.user_id }),
        })
      } else if (leadEvaluatorChange === false) {
        await apiFetch(`/ttx/${ttx.id}/evaluators/lead`, { method: 'DELETE' })
      }
      await onSaved()
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="team-edit-title" onClose={onClose} size="lg">
      <div className="w-full space-y-6">
        <div className="space-y-1">
          <h2 id="team-edit-title" className="text-balance text-lg font-semibold tracking-tight">
            {t('creator.exerciseTeam.editTitle', { name: person.full_name })}
          </h2>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">{person.email}</p>
        </div>
        <RolesFieldset
          value={value}
          onChange={setValue}
          grants={person.grants}
          held={initial}
          leads={leads}
          heldLeads={initialLeads}
          onLeadsChange={setLeads}
          disabled={busy}
        />
        {leadStopsPlanning && (
          <SuccessorField
            person={person}
            people={people}
            value={successor}
            onChange={setSuccessor}
          />
        )}
        <TagsFieldset
          availableTags={availableTags}
          selected={tags}
          onChange={setTags}
          orgTags={person.org_tags}
        />
        {(problem || error) && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {problem ?? error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={
              busy ||
              problem !== null ||
              (!roleChanged && !tagsChanged && !leadsChanged) ||
              (leadStopsPlanning && !successor)
            }
            className={btnPrimary}
          >
            {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Create pattern: pick someone the organization authorized, what they'll
 * be on the exercise, and its tags. */
function AddPersonForm({
  ttx,
  candidates,
  availableTags,
  onClose,
  onAdded,
}: {
  ttx: TTXRead
  candidates: ExercisePersonCandidateListResponse['items']
  availableTags: AssignableTag[]
  onClose: () => void
  onAdded: (userId: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [userId, setUserId] = useState('')
  const candidate = candidates.find((c) => c.user_id === userId) ?? null
  const [value, setValue] = useState<RoleFlags>({ ...NO_ROLES, plans: true })
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = hasRole(value) ? null : t('creator.exerciseTeam.noRole')
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  function pick(id: string) {
    setUserId(id)
    const grants = candidates.find((c) => c.user_id === id)?.grants ?? []
    // Start on the first role they're authorized for.
    const role = (['planner', 'observer', 'evaluator'] as const).find((r) => grants.includes(r))
    if (role) {
      setValue({
        ...NO_ROLES,
        plans: role === 'planner',
        observes: role === 'observer',
        evaluates: role === 'evaluator',
      })
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!candidate) return
    setBusy(true)
    setError(null)
    try {
      const request = toRoleRequest(value)
      const { evaluates, observes, ...participation } = request
      await apiFetch(`/ttx/${ttx.id}/people`, {
        method: 'POST',
        body: JSON.stringify({ email: candidate.email, ...participation }),
      })
      // A team member who also evaluates / observes: set once on the team.
      if (evaluates || observes) {
        await apiFetch(`/ttx/${ttx.id}/people/${candidate.user_id}/role`, {
          method: 'PUT',
          body: JSON.stringify(request),
        })
      }
      if (tags.size > 0) {
        await apiFetch(`/ttx/${ttx.id}/people/${candidate.user_id}/tags`, {
          method: 'PUT',
          body: JSON.stringify({ tag_ids: Array.from(tags) }),
        })
      }
      await onAdded(candidate.user_id)
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <Panel
        title={t('creator.exerciseTeam.addTitle')}
        description={t('creator.exerciseTeam.addDescription', { exercise: ttx.name })}
        footer={
          <div className={panelFormActions}>
            <button type="button" onClick={onClose} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !candidate || problem !== null}
              className={btnPrimary}
            >
              {busy ? <ButtonSpinner /> : t('creator.exerciseTeam.addSubmit')}
            </button>
          </div>
        }
      >
        <div className="max-w-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm" htmlFor="team-add-person">
              {t('creator.exerciseTeam.personLabel')}
            </label>
            <select
              ref={selectRef}
              id="team-add-person"
              name="person"
              value={userId}
              onChange={(e) => pick(e.target.value)}
              disabled={busy || candidates.length === 0}
              className={inputBase}
            >
              <option value="">{t('creator.exerciseTeam.personPlaceholder')}</option>
              {candidates.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.full_name} · {c.email}
                </option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {t('creator.exerciseTeam.noCandidates')}
              </p>
            )}
          </div>
          {candidate && (
            <>
              <RolesFieldset
                value={value}
                onChange={setValue}
                grants={candidate.grants}
                disabled={busy}
              />
              <TagsFieldset
                availableTags={availableTags}
                selected={tags}
                onChange={setTags}
                orgTags={[]}
              />
            </>
          )}
          {(problem || error) && candidate && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {problem ?? error}
            </p>
          )}
        </div>
      </Panel>
    </form>
  )
}

/** Remove from the exercise: typed full name; a leaving lead names who
 * takes over. The team never drops its last Planner or Controller. */
function RemovePersonModal({
  ttx,
  person,
  people,
  isYou,
  onClose,
  onRemoved,
}: {
  ttx: TTXRead
  person: ExercisePersonRead
  people: ExercisePersonRead[]
  isYou: boolean
  onClose: () => void
  onRemoved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const [successor, setSuccessor] = useState(() => firstOtherPlanner(person, people))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = useParticipationProblem(person, NO_ROLES, people)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const query = person.is_lead ? `?lead_successor_id=${encodeURIComponent(successor)}` : ''
      await apiFetch(`/ttx/${ttx.id}/people/${person.user_id}${query}`, { method: 'DELETE' })
      await onRemoved()
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="team-remove-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h2
          id="team-remove-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('creator.exerciseTeam.removeTitle')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {isYou
            ? t('creator.exerciseTeam.removeSelfWarning', { exercise: ttx.name })
            : t('creator.exerciseTeam.removeWarning', {
                name: person.full_name,
                exercise: ttx.name,
              })}
        </p>
        {problem ? (
          <p className="text-sm text-danger-fg">{problem}</p>
        ) : (
          <>
            {person.is_lead && (
              <SuccessorField
                person={person}
                people={people}
                value={successor}
                onChange={setSuccessor}
              />
            )}
            <label className="block text-sm" htmlFor="team-remove-confirm">
              {t('creator.planningTeam.removeConfirmLabel', { name: person.full_name })}
            </label>
            <input
              id="team-remove-confirm"
              name="confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={person.full_name}
              className={inputBase}
            />
          </>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              busy ||
              problem !== null ||
              confirmation !== person.full_name ||
              (person.is_lead && !successor)
            }
            className={`flex-1 ${btnDanger}`}
          >
            {busy ? <ButtonSpinner /> : t('creator.exerciseTeam.removeSubmit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
