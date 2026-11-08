import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlaceName } from '../../hooks/usePlaceName'
import { useStageRoom } from '../../hooks/useViewedRoom'
import { apiFetch } from '../../lib/api'
import { inputBase } from '../../lib/buttonStyles'
import { injectSequence, inPlayAt } from '../../lib/run'
import type { ContextRole } from '../../lib/moduleAccess'
import type { RunNote, RunRead } from '../../lib/types'
import { Panel } from '../common/Panel'

/** How long typing pauses before a note is saved. */
const SAVE_AFTER_MS = 800

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

/** One note, autosaved as the user types: on the inject in play
 * (`injectCode`) or the general one (""). */
function NotePad({
  ttxId,
  role,
  injectCode,
  where,
  label,
  initial,
  onSaved,
}: {
  ttxId: string
  role: ContextRole
  injectCode: string
  /** Rooms: the place the note is about. */
  where: string | null
  label: string
  initial: string
  onSaved: (notes: RunNote[]) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial)
  const [state, setState] = useState<SaveState>('saved')
  const saved = useRef(initial)
  const id = `note-${injectCode || 'general'}`

  useEffect(() => {
    if (text === saved.current) return
    const timer = window.setTimeout(async () => {
      setState('saving')
      try {
        const result = await apiFetch<{ items: RunNote[] }>(`/ttx/${ttxId}/run/notes?as=${role}`, {
          method: 'PUT',
          body: JSON.stringify({ inject_code: injectCode, text, room_code: where ?? undefined }),
        })
        saved.current = text
        setState('saved')
        onSaved(result.items)
      } catch {
        setState('error')
      }
    }, SAVE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [text, ttxId, role, injectCode, where, onSaved])

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span
          role="status"
          aria-live="polite"
          className={`text-xs ${state === 'error' ? 'text-danger-fg' : 'text-paper-ink/60 dark:text-fg-faint'}`}
        >
          {t(`playground.notes.${state}`)}
        </span>
      </div>
      <textarea
        name={id}
        autoComplete="off"
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setState('pending')
        }}
        rows={5}
        maxLength={10000}
        className={inputBase}
      />
    </div>
  )
}

/** The user's notes during the session, as the role they act as: one on
 * the inject in play, one general, and the ones on earlier injects. A
 * Player's are private; the team's feed the hot wash and the report. */
export function NotesPanel({
  ttxId,
  role,
  run,
  title,
  description,
}: {
  ttxId: string
  role: ContextRole
  run: RunRead
  title: string
  description: string
}) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<RunNote[] | null>(null)
  const stage = useStageRoom(run.rooms)
  // A Player's notes are theirs, wherever they were; the team's on an
  // inject are per room.
  const where = role === 'player' ? null : stage
  const place = usePlaceName(run)(where)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const scope = where ? `&room=${where}` : ''
        const result = await apiFetch<{ items: RunNote[] }>(
          `/ttx/${ttxId}/run/notes?as=${role}${scope}`,
        )
        if (!cancelled) setNotes(result.items)
      } catch {
        if (!cancelled) setNotes([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, role, where])

  const inPlay = inPlayAt(run, stage)
  const text = (code: string) => notes?.find((n) => n.inject_code === code)?.text ?? ''
  const titles = new Map(run.injects.map((i) => [i.code, i.title]))
  // An inject by its number in the story; the team also reads its code.
  const sequence = injectSequence(run)
  const showCodes = role !== 'player'
  const injectRef = (code: string) =>
    [t('playground.seq', { seq: sequence.get(code) ?? '' }), showCodes && code]
      .filter(Boolean)
      .join(' · ')
  const earlier = (notes ?? []).filter(
    (n) => n.inject_code && n.inject_code !== inPlay?.code && titles.has(n.inject_code),
  )

  return (
    <Panel title={title} meta={place ?? undefined} description={description}>
      {notes === null ? (
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">{t('common.loading')}</p>
      ) : (
        <div className="space-y-5">
          {inPlay && (
            <NotePad
              key={`${inPlay.code}-${where}`}
              ttxId={ttxId}
              role={role}
              injectCode={inPlay.code}
              where={where}
              label={[
                t('playground.notes.onInject', { seq: sequence.get(inPlay.code) ?? '' }),
                showCodes && inPlay.code,
              ]
                .filter(Boolean)
                .join(' · ')}
              initial={text(inPlay.code)}
              onSaved={setNotes}
            />
          )}
          <NotePad
            ttxId={ttxId}
            role={role}
            injectCode=""
            where={null}
            label={t('playground.notes.general')}
            initial={text('')}
            onSaved={setNotes}
          />
          {earlier.length > 0 && (
            <section aria-label={t('playground.notes.earlier')} className="space-y-2">
              <h3 className="text-sm font-semibold">{t('playground.notes.earlier')}</h3>
              <ul className="space-y-2">
                {earlier.map((note) => (
                  <li key={note.id} className="rounded-sm border border-panel-line p-2 text-sm">
                    <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
                      <span translate="no" className="font-mono">
                        {injectRef(note.inject_code)}
                      </span>{' '}
                      · {titles.get(note.inject_code)}
                    </p>
                    <p className="whitespace-pre-wrap">{note.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  )
}
