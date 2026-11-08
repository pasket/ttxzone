import { useTranslation } from 'react-i18next'

/** A pennant: the one who sets the course. Used both as the Lead Planner
 * badge and on the "Make Lead Planner" action, so the two read as one. */
export function FlagIcon({
  filled = false,
  className = 'h-4 w-4',
}: {
  filled?: boolean
  className?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V4" />
      <path d="M5 4h12l-3 4.5L17 13H5" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  )
}

/** A lead badge next to a person's name: icon *and* text (never colour
 * or icon alone), brand accent tint since it's an identity marker, not a
 * status -- green/red/amber stay for complete/error/pending. The title
 * says what the role is for. */
function LeadBadge({ label, description }: { label: string; description: string }) {
  return (
    <span
      title={description}
      className="ml-2 inline-flex h-5 items-center gap-1 rounded-xs bg-accent/10 px-1.5 align-middle text-xs font-medium whitespace-nowrap text-accent-fg"
    >
      <FlagIcon filled className="h-3 w-3" />
      {label}
    </span>
  )
}

export function LeadPlannerBadge() {
  const { t } = useTranslation()
  return (
    <LeadBadge
      label={t('creator.planningTeam.leadBadge')}
      description={t('creator.planningTeam.leadDescription')}
    />
  )
}

export function LeadEvaluatorBadge() {
  const { t } = useTranslation()
  return (
    <LeadBadge
      label={t('creator.exerciseTeam.leadEvaluatorBadge')}
      description={t('creator.exerciseTeam.leadEvaluatorDescription')}
    />
  )
}
