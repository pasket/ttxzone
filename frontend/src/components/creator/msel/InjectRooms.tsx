import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import type { MselRoom } from '../../../lib/types'
import { CodeRef } from '../../common/CodeRef'

/** The rooms an inject is played in, as code + name, or "All rooms". */
export function InjectRooms({ roomIds, rooms }: { roomIds: string[]; rooms: MselRoom[] }) {
  const { t } = useTranslation()
  const aimed = rooms.filter((room) => roomIds.includes(room.id))
  if (aimed.length === 0) return <>{t('creator.msel.rooms.all')}</>
  return (
    <>
      {aimed.map((room, index) => (
        <Fragment key={room.id}>
          {index > 0 && ' · '}
          <CodeRef code={room.code} title={room.name} />
        </Fragment>
      ))}
    </>
  )
}
