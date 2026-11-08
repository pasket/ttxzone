import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { btnPrimary } from '../../lib/buttonStyles'
import { Panel } from '../common/Panel'

/** Stands in front of the MSEL until the exercise's needs analysis is
 * approved -- the same gate the backend enforces (409
 * NEEDS_FORM_NOT_APPROVED) -- explaining why and pointing to the form
 * instead of offering a screen that would fail. Once an MSEL exists it
 * stays reachable (read-only while the needs analysis is revised). */
export function CreatorDesignGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { ttxId } = useParams<{ ttxId?: string }>()
  const { ttxList } = useAuth()
  const exercise = ttxList.find((item) => item.id === ttxId)

  if (!exercise || exercise.needs_form_status === 'approved' || exercise.msel_status) {
    return <>{children}</>
  }

  return (
    <div className="p-6">
      <Panel title={t('creator.needs.gate.title')} className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.needs.gate.body')}
          </p>
          <Link to={`/creator/${exercise.id}/needs`} className={`${btnPrimary} inline-flex`}>
            {t('creator.needs.gate.link')}
          </Link>
        </div>
      </Panel>
    </div>
  )
}
