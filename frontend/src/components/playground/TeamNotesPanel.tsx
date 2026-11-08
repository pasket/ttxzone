import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch } from '../../lib/api'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { RunTeamNote } from '../../lib/types'
import { RefreshButton } from '../common/RefreshButton'

/** What the team wrote (Facilitators, Observers, Evaluators, Controllers;
 * never a Player's notes), by inject: loaded when unfolded, refreshed on
 * demand. For the Controllers, and in the after-action report for the
 * run it was written from (`runId`). */
export function TeamNotesPanel({ ttxId, runId }: { ttxId: string; runId?: string }) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<RunTeamNote[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const query = runId ? `?run=${runId}` : ''
      setNotes(
        (await apiFetch<{ items: RunTeamNote[] }>(`/ttx/${ttxId}/run/notes/team${query}`)).items,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <details
      className="relative rounded-sm border border-panel-line bg-panel"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && notes === null) void load()
      }}
    >
      <summary className="cursor-pointer py-3 pr-14 pl-4 text-sm font-semibold">
        {t('playground.notes.team')}
      </summary>
      {/* A sibling of the summary, not inside it (no button within a
          button); shown only while open, like the rest of the content. */}
      <RefreshButton
        label={t('playground.notes.refresh')}
        onClick={() => void load()}
        refreshing={loading}
        className="absolute top-1 right-3"
      />
      <div className="space-y-3 border-t border-panel-line p-4">
        {notes !== null && notes.length === 0 && (
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('playground.notes.noneYet')}
          </p>
        )}
        <ul className="space-y-2">
          {(notes ?? []).map((note, index) => (
            <li key={index} className="rounded-sm border border-panel-line p-2 text-sm">
              <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
                {note.inject_code ? (
                  <span translate="no" className="font-mono">
                    {note.inject_code}
                  </span>
                ) : (
                  t('playground.notes.general')
                )}{' '}
                {note.room_code && (
                  <>
                    ·{' '}
                    <span translate="no" className="font-mono">
                      {note.room_code === 'main' ? t('playground.rooms.mainRoom') : note.room_code}
                    </span>{' '}
                  </>
                )}
                · {note.author} · {t(CONTEXT_ROLE_LABEL_KEYS[note.role])}
              </p>
              <p className="whitespace-pre-wrap">{note.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
