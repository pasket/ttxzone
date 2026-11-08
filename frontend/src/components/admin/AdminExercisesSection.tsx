import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnNeutralIconGhost, btnPrimary, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { actsAs } from '../../lib/moduleAccess'
import type { OrganizationSummary, TTXListResponse, TTXRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { archivedParam, useArchivedFilter } from '../../hooks/useArchivedFilter'
import {
  ArchiveExerciseModal,
  DeleteExerciseModal,
  ExerciseList,
} from '../common/ExercisePortfolio'
import { Modal } from '../common/Modal'
import { RadioCards } from '../common/RadioCards'
import { SectionHeader } from '../common/SectionHeader'

const mutedClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

type Seat = 'planner' | 'controller' | 'facilitator' | 'evaluator' | 'observer'

// What each seat is on the exercise (POST /ttx/{id}/people/me), and the
// organization grant it comes from.
const SEATS: Record<
  Seat,
  {
    body: {
      role: 'planner' | 'evaluator' | 'observer'
      plans?: boolean
      controls?: boolean
      facilitates?: boolean
    }
    granted: (org: OrganizationSummary) => boolean
  }
> = {
  planner: { body: { role: 'planner', plans: true }, granted: (org) => org.is_planner },
  controller: { body: { role: 'planner', controls: true }, granted: (org) => org.is_planner },
  facilitator: {
    body: { role: 'planner', controls: true, facilitates: true },
    granted: (org) => org.is_planner,
  },
  evaluator: { body: { role: 'evaluator' }, granted: (org) => org.is_evaluator },
  observer: { body: { role: 'observer' }, granted: (org) => org.is_observer },
}

function JoinIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M19 8v6M16 11h6" />
    </svg>
  )
}

const EXERCISES_PAGE_SIZE = 20

/** Admin -> Exercises: the organization's whole exercise portfolio, for
 * its Program Managers -- status, Lead Planner, and delete. A Program
 * Manager designs only from a seat on an exercise's team, so only the
 * exercises they plan open in the Creator; on the others they take a
 * seat themselves (Join), from their organization grants. Searched,
 * sorted and paged on the server: a portfolio outgrows the auth
 * snapshot's first page of exercises. */
export function AdminExercisesSection() {
  const { t } = useTranslation()
  const { activeOrganization } = useAuth()
  const { page, setPage, sortDir, sortBy, search } = useTableUrlState()
  const [deleting, setDeleting] = useState<TTXRead | null>(null)
  const [joining, setJoining] = useState<TTXRead | null>(null)
  const [archiving, setArchiving] = useState<TTXRead | null>(null)
  const [archivedFilter] = useArchivedFilter()
  const params = new URLSearchParams({
    limit: String(EXERCISES_PAGE_SIZE),
    offset: String((page - 1) * EXERCISES_PAGE_SIZE),
    sort_by: sortBy,
    sort_dir: sortDir,
  })
  if (activeOrganization) params.set('organization_id', activeOrganization.organization_id)
  if (search) params.set('q', search)
  const archived = archivedParam(archivedFilter)
  if (archived) params.set('archived', archived)
  const exercises = useApiResource<TTXListResponse>(activeOrganization ? `/ttx?${params}` : null)
  const total = exercises.data?.total ?? 0
  const totalPages = Math.ceil(total / EXERCISES_PAGE_SIZE)
  usePageFallback({ total, pageSize: EXERCISES_PAGE_SIZE, ready: exercises.data !== null })

  return (
    <div className="space-y-4">
      <SectionHeader title={t('admin.exercises.title')} />
      <ExerciseList
        exercises={exercises.data?.items ?? []}
        page={{
          total,
          page,
          totalPages,
          onPageChange: setPage,
          loading: exercises.loading,
          error: exercises.error,
        }}
        onDelete={setDeleting}
        onArchive={setArchiving}
        title={t('admin.exercises.listTitle')}
        description={t('admin.exercises.intro', {
          organization: activeOrganization?.organization_name ?? '',
        })}
        empty={<p className={mutedClass}>{t('admin.exercises.empty')}</p>}
        canOpen={(ttx) => actsAs(ttx, 'planner')}
        // No seat on it yet: oversight only.
        action={(ttx) =>
          ttx.role === 'program_manager' && (
            <button
              type="button"
              onClick={() => setJoining(ttx)}
              aria-label={t('admin.exercises.joinLabel', { name: ttx.name })}
              title={t('admin.exercises.joinLabel', { name: ttx.name })}
              className={btnNeutralIconGhost}
            >
              <JoinIcon />
            </button>
          )
        }
      />
      {archiving && (
        <ArchiveExerciseModal
          exercise={archiving}
          onClose={() => {
            setArchiving(null)
            exercises.refetch()
          }}
        />
      )}
      {deleting && (
        <DeleteExerciseModal
          exercise={deleting}
          onClose={() => {
            setDeleting(null)
            exercises.refetch()
          }}
        />
      )}
      {joining && activeOrganization && (
        <JoinExerciseModal
          exercise={joining}
          organization={activeOrganization}
          onClose={() => {
            setJoining(null)
            exercises.refetch()
          }}
        />
      )}
    </div>
  )
}

/** Take a seat on an exercise: one of the seats the Program Manager's
 * organization grants allow; the rest are named, with where to grant
 * them. More functions come later from the exercise's team. */
function JoinExerciseModal({
  exercise,
  organization,
  onClose,
}: {
  exercise: TTXRead
  organization: OrganizationSummary
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const seats = (Object.keys(SEATS) as Seat[]).filter((seat) => SEATS[seat].granted(organization))
  const missing = (Object.keys(SEATS) as Seat[]).filter((seat) => !seats.includes(seat))
  const [seat, setSeat] = useState<Seat | null>(seats[0] ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label: Record<Seat, string> = {
    planner: t('roles.planner'),
    controller: t('roles.controller'),
    facilitator: t('roles.facilitator'),
    evaluator: t('roles.evaluator'),
    observer: t('roles.observer'),
  }
  const hint: Record<Seat, string> = {
    planner: t('admin.exercises.seatHints.planner'),
    controller: t('admin.exercises.seatHints.controller'),
    facilitator: t('admin.exercises.seatHints.facilitator'),
    evaluator: t('admin.exercises.seatHints.evaluator'),
    observer: t('admin.exercises.seatHints.observer'),
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!seat) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${exercise.id}/people/me`, {
        method: 'POST',
        body: JSON.stringify(SEATS[seat].body),
      })
      showToast(t('admin.exercises.joined', { name: exercise.name, role: label[seat] }))
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="exercise-join-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <h2 id="exercise-join-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('admin.exercises.joinTitle', { name: exercise.name })}
        </h2>
        <p className={mutedClass}>{t('admin.exercises.joinDescription')}</p>
        {seat ? (
          <RadioCards
            id="exercise-join-seat"
            name="exercise-join-seat"
            legend={t('admin.exercises.seatLegend')}
            options={seats.map((value) => ({ value, label: label[value], hint: hint[value] }))}
            value={seat}
            onChange={setSeat}
          />
        ) : (
          <p className={mutedClass}>{t('admin.exercises.noSeat')}</p>
        )}
        {missing.length > 0 && (
          <p className={mutedClass}>
            {t('admin.exercises.missingGrants', {
              roles: missing.map((value) => label[value]).join(', '),
            })}{' '}
            <Link to="/admin/users-and-roles" className={linkAccent}>
              {t('admin.exercises.grantLink')}
            </Link>
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy || !seat} className={btnPrimary}>
            {busy ? <ButtonSpinner /> : t('admin.exercises.joinConfirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
