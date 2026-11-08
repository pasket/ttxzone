import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import type { TTXAccessRequestListResponse, TTXLeaveRequest } from '../../lib/types'
import { PageTabs } from '../common/PageTabs'
import { SectionHeader } from '../common/SectionHeader'

/** Creator -> Players: the page title and its three tabs, by where a
 * Player stands -- confirmed, waiting for approval (to join or to leave) -- then the invitation
 * codes that bring them in. Pending carries how many wait, the one tab that
 * asks for action; the Pending page passes its own live count. */
export function PlayersTabs({ pendingCount }: { pendingCount?: number }) {
  const { t } = useTranslation()
  const { activeTtxId } = useAuth()
  const page = useLocation().pathname.split('/')[3]
  const { data } = useApiResource<TTXAccessRequestListResponse>(
    pendingCount === undefined && activeTtxId
      ? `/ttx/${activeTtxId}/access-requests?limit=1&offset=0`
      : null,
  )
  const { data: leaving } = useApiResource<TTXLeaveRequest[]>(
    pendingCount === undefined && activeTtxId ? `/ttx/${activeTtxId}/leave-requests` : null,
  )
  // Joining and leaving requests alike wait for the team.
  const pending = pendingCount ?? (data?.total ?? 0) + (leaving?.length ?? 0)
  return (
    <div className="space-y-1">
      <SectionHeader title={t('creator.sections.players')} />
      <PageTabs
        label={t('creator.sections.players')}
        items={[
          {
            key: 'confirmed',
            to: '/creator/players',
            label: t('creator.players.tabConfirmed'),
            current: page !== 'pending' && page !== 'invitations',
          },
          {
            key: 'pending',
            to: '/creator/players/pending',
            label: t('creator.players.tabPending'),
            count: pending,
            current: page === 'pending',
          },
          {
            key: 'invitations',
            to: '/creator/players/invitations',
            label: t('creator.players.tabInvitations'),
            current: page === 'invitations',
          },
        ]}
      />
    </div>
  )
}
