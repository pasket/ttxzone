import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { apiFetch, ApiError } from '../../lib/api'
import { actionsCellClass, linkAccent } from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { filterAndSortPeople, PEOPLE_SORT_OPTIONS } from '../../lib/peopleTable'
import type { TTXPlayerRead, TTXPlayersRead } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { LastLogin } from '../common/LastLogin'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'
import { PlayersTabs } from './PlayersTabs'

/** Creator -> Players -> Confirmed: the Players whose request was
 * approved, the end of the invite -> approve funnel. Removing one takes
 * them out of the exercise (Undo first). */
export function CreatorPlayersSection() {
  const { t } = useTranslation()
  const { activeTtxId } = useAuth()

  if (activeTtxId === null) {
    return (
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('creator.invitations.noTtxMessage')}
      </p>
    )
  }
  return <PlayersList key={activeTtxId} ttxId={activeTtxId} />
}

function PlayersList({ ttxId }: { ttxId: string }) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()
  const { data, error, loading } = useApiResource<TTXPlayersRead>(`/ttx/${ttxId}/players`)
  // Removed while the Undo window runs (and after the DELETE went through).
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const { sortDir, setSortDir, sortBy, setSortBy, search, setSearch } = useTableUrlState(
    'players_',
    PEOPLE_SORT_OPTIONS,
  )
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  const players = (data?.items ?? []).filter((p) => !removed.has(p.user_id))
  const visible = filterAndSortPeople(players, {
    search,
    sortBy,
    sortDir,
    grantedAt: (p) => p.joined_at,
  })
  const usesRooms = data?.uses_rooms ?? false

  function setGone(userId: string, gone: boolean) {
    setRemoved((current) => {
      const next = new Set(current)
      if (gone) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  function handleRemove(player: TTXPlayerRead) {
    runUndoable({
      message: t('creator.players.removedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setGone(player.user_id, true),
      onRestore: () => setGone(player.user_id, false),
      onCommit: async () => {
        try {
          await apiFetch(`/ttx/${ttxId}/players/${player.user_id}`, { method: 'DELETE' })
        } catch (err) {
          setGone(player.user_id, false)
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <PlayersTabs />
      <Panel
        label={t('creator.players.title')}
        description={
          <HelpText id="creator.players.description" text={t('creator.players.description')} />
        }
        meta={data ? t('creator.players.count', { count: players.length }) : undefined}
        aside={
          players.length > 0 ? (
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={PEOPLE_SORT_OPTIONS}
              sortLabels={{ created_at: t('creator.players.joinedSort') }}
            />
          ) : undefined
        }
        flush
      >
        {error && !data && (
          <p role="alert" className="px-5 py-12 text-center text-sm text-danger-fg">
            {t('creator.players.loadError')}
          </p>
        )}
        {data && !loading && players.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.players.empty')}{' '}
            <Link to="/creator/players/invitations" className={linkAccent}>
              {t('creator.players.emptyCta')}
            </Link>
          </p>
        )}
        {players.length > 0 && visible.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('common.toolbar.noSearchResults', { query: search })}
          </p>
        )}
        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={panelTh}>
                    {t('creator.players.columnPlayer')}
                  </th>
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('creator.players.columnJoined')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('creator.players.columnInvitation')}
                  </th>
                  {usesRooms && (
                    <th scope="col" className={panelTh}>
                      {t('creator.players.columnRoom')}
                    </th>
                  )}
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('common.lastLogin.column')}
                  </th>
                  <th scope="col" className={panelActionsTh}>
                    {t('common.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {visible.map((player) => (
                  <tr key={player.user_id} className={panelTr}>
                    <th scope="row" className={`${panelTd} text-left font-normal`}>
                      <span className="block font-semibold text-paper-ink dark:text-fg">
                        {player.full_name}
                      </span>
                      <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                        {player.email}
                      </span>
                    </th>
                    <td className={`${panelTd} whitespace-nowrap text-sm`}>
                      {dateFmt.format(new Date(player.joined_at))}
                    </td>
                    <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                      {player.invited_by_email
                        ? t('creator.players.invitationByEmail')
                        : player.invitation
                          ? (player.invitation.description ??
                            t('creator.players.invitationUnnamed'))
                          : t('creator.players.invitationNone')}
                    </td>
                    {usesRooms && (
                      <td className={`${panelTd} text-sm`}>
                        {player.room ? (
                          <CodeRef code={player.room.code} title={player.room.name} />
                        ) : (
                          <span className="text-paper-ink/70 dark:text-fg-muted">
                            {t('creator.players.noRoom')}
                          </span>
                        )}
                      </td>
                    )}
                    <td className={panelTd}>
                      <LastLogin value={player.last_login_at} />
                    </td>
                    <td className={panelTd}>
                      <div className={actionsCellClass}>
                        <IconButton
                          label={t('creator.players.removeLabel', { name: player.full_name })}
                          onClick={() => handleRemove(player)}
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
    </div>
  )
}
