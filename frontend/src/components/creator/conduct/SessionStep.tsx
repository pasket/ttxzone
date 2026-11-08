import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { btnSecondary, linkAccent } from '../../../lib/buttonStyles'
import {
  BRIEFING_ITEMS,
  conductFieldId,
  FALLBACKS,
  formatDay,
  LOGISTICS_ITEMS,
  MODALITIES,
  newAttendee,
  patchEvaluator,
  rowId,
  type ConductPrepDraft,
  type DraftAttendee,
} from '../../../lib/conductPrep'
import type { ConductPrep, SessionModality } from '../../../lib/types'
import { FieldGroup } from '../../common/FieldGroup'
import { IconButton } from '../../common/IconButton'
import { LeadEvaluatorBadge } from '../../common/LeadPlannerBadge'
import { RadioCards } from '../../common/RadioCards'
import { CheckboxGroup, Field, Select, TextArea, TextInput } from '../needs/fields'
import { Checkbox, DateInput } from './fields'
import type { StepProps } from './stepProps'

function timeZones(current: string): string[] {
  let zones: string[]
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  return [...new Set([current, local, ...zones].filter(Boolean))].sort()
}

/** Step 3, the session. Required: when, where and how it's held (with
 * any complementary information, whatever the modality) and how it stops
 * for a real incident. Optional, folded while empty: the convocation and
 * its key decision makers, the room and materials, and the controller and
 * evaluator briefing. */
export function SessionStep(props: StepProps) {
  const { t, i18n } = useTranslation()
  const { prep, draft, update, isInvalid } = props
  const ctx = prep.context
  const modalities = t('creator.conductPrep.logistics.modalities', {
    returnObjects: true,
  }) as Record<string, { label: string; hint: string }>
  const items = t('creator.conductPrep.logistics.items', { returnObjects: true }) as Record<
    string,
    string
  >
  const needsVenue = draft.modality === 'in_person' || draft.modality === 'hybrid'
  const needsLink = draft.modality === 'remote' || draft.modality === 'hybrid'
  const keyword = ctx.stop_exercise_keyword
  const briefedCount =
    draft.briefed_controller_ids.length + draft.evaluators.filter((e) => e.briefed).length
  const convocationFilled =
    draft.invitation_sent_on !== null ||
    draft.invitation_text.trim() !== '' ||
    draft.attendees.length > 0
  const briefingFilled =
    draft.briefing_date !== null ||
    draft.briefing_checklist.length > 0 ||
    draft.briefing_notes.trim() !== '' ||
    briefedCount > 0

  return (
    <div className="space-y-5">
      <FieldGroup
        id="cp-session-title"
        number={1}
        title={t('creator.conductPrep.fieldGroups.session.title')}
        hint={t('creator.conductPrep.fieldGroups.session.hint')}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id={conductFieldId('session_date')}
            label={t('creator.conductPrep.fields.session_date')}
            hint={
              ctx.date_window_start || ctx.date_window_end
                ? t('creator.conductPrep.logistics.window', {
                    start: formatDay(ctx.date_window_start, i18n.language) || '…',
                    end: formatDay(ctx.date_window_end, i18n.language) || '…',
                  })
                : undefined
            }
          >
            <DateInput
              id={conductFieldId('session_date')}
              value={draft.session_date}
              invalid={isInvalid('session_date')}
              describedBy={`${conductFieldId('session_date')}-hint`}
              onChange={(session_date) => update({ session_date })}
            />
          </Field>
          <Field
            id={conductFieldId('session_time')}
            label={t('creator.conductPrep.fields.session_time')}
            hint={
              ctx.msel_exercise_start
                ? t('creator.conductPrep.logistics.mselStart', {
                    time: ctx.msel_exercise_start.slice(0, 5),
                  })
                : undefined
            }
          >
            <DateInput
              id={conductFieldId('session_time')}
              type="time"
              value={draft.session_time}
              invalid={isInvalid('session_time')}
              onChange={(session_time) => update({ session_time })}
            />
          </Field>
          <Field id={conductFieldId('timezone')} label={t('creator.conductPrep.fields.timezone')}>
            <Select
              id={conductFieldId('timezone')}
              value={draft.timezone || null}
              invalid={isInvalid('timezone')}
              placeholder={t('creator.conductPrep.logistics.pickZone')}
              options={timeZones(draft.timezone).map((zone) => ({ value: zone, label: zone }))}
              onChange={(timezone) => update({ timezone })}
            />
          </Field>
        </div>
        <RadioCards<SessionModality>
          id={conductFieldId('modality')}
          name="cp-modality"
          legend={t('creator.conductPrep.fields.modality')}
          columns={3}
          value={draft.modality ?? ('' as SessionModality)}
          options={MODALITIES.map((value) => ({ value, ...modalities[value] }))}
          onChange={(modality) => update({ modality })}
        />
        {(needsVenue || needsLink) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {needsVenue && (
              <>
                <Field id={conductFieldId('venue')} label={t('creator.conductPrep.fields.venue')}>
                  <TextInput
                    id={conductFieldId('venue')}
                    value={draft.venue}
                    maxLength={255}
                    invalid={isInvalid('venue')}
                    onChange={(venue) => update({ venue })}
                  />
                </Field>
                <Field
                  id={conductFieldId('room')}
                  label={t('creator.conductPrep.fields.room')}
                  optional
                >
                  <TextInput
                    id={conductFieldId('room')}
                    value={draft.room}
                    maxLength={255}
                    onChange={(room) => update({ room })}
                  />
                </Field>
              </>
            )}
            {needsLink && (
              <Field
                id={conductFieldId('meeting_link')}
                label={t('creator.conductPrep.fields.meeting_link')}
              >
                <TextInput
                  id={conductFieldId('meeting_link')}
                  type="url"
                  value={draft.meeting_link}
                  maxLength={2048}
                  placeholder="https://…"
                  invalid={isInvalid('meeting_link')}
                  onChange={(meeting_link) => update({ meeting_link })}
                />
              </Field>
            )}
          </div>
        )}
        <Field
          id={conductFieldId('session_notes')}
          label={t('creator.conductPrep.fields.session_notes')}
          optional
        >
          <TextArea
            id={conductFieldId('session_notes')}
            value={draft.session_notes}
            rows={3}
            placeholder={t('creator.conductPrep.logistics.sessionNotesPlaceholder')}
            onChange={(session_notes) => update({ session_notes })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup
        id="cp-stop-title"
        number={2}
        title={t('creator.conductPrep.fieldGroups.stop.title')}
        hint={t('creator.conductPrep.fieldGroups.stop.hint')}
      >
        <p className="text-sm">
          <span className="font-medium">{t('creator.conductPrep.documents.keyword')}: </span>
          {keyword ? (
            <span className="font-mono">{keyword}</span>
          ) : (
            <span className="text-paper-ink/60 dark:text-fg-faint">
              {t('creator.conductPrep.documents.noKeyword')}
            </span>
          )}
        </p>
        <Field
          id={conductFieldId('stop_procedure')}
          label={t('creator.conductPrep.fields.stop_procedure')}
        >
          <TextArea
            id={conductFieldId('stop_procedure')}
            value={draft.stop_procedure}
            rows={5}
            invalid={isInvalid('stop_procedure')}
            onChange={(stop_procedure) => update({ stop_procedure })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup
        id="cp-convocation-title"
        number={3}
        optional
        title={t('creator.conductPrep.fieldGroups.convocation.title')}
        hint={t('creator.conductPrep.fieldGroups.convocation.hint')}
        collapsible={{
          filled: convocationFilled,
          summary: convocationFilled
            ? [
                draft.invitation_sent_on &&
                  t('creator.conductPrep.summaries.invitationSent', {
                    date: formatDay(draft.invitation_sent_on, i18n.language),
                  }),
                t('creator.conductPrep.summaries.decisionMakers', {
                  count: draft.attendees.length,
                }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined,
        }}
      >
        <Convocation {...props} />
      </FieldGroup>

      <FieldGroup
        id="cp-room-title"
        number={4}
        optional
        title={t('creator.conductPrep.fieldGroups.room.title')}
        hint={t('creator.conductPrep.fieldGroups.room.hint')}
        collapsible={{
          filled: draft.logistics_checklist.length > 0,
          summary:
            draft.logistics_checklist.length > 0
              ? t('creator.conductPrep.summaries.checked', {
                  count: draft.logistics_checklist.length,
                  total: LOGISTICS_ITEMS.length,
                })
              : undefined,
        }}
      >
        <CheckboxGroup
          id={conductFieldId('logistics_checklist')}
          legend={t('creator.conductPrep.fields.logistics_checklist')}
          columns={2}
          options={LOGISTICS_ITEMS.map((value) => ({ value, label: items[value] }))}
          selected={draft.logistics_checklist}
          onChange={(logistics_checklist) => update({ logistics_checklist })}
        />
      </FieldGroup>

      <FieldGroup
        id="cp-briefing-title"
        number={5}
        optional
        title={t('creator.conductPrep.fieldGroups.briefing.title')}
        hint={t('creator.conductPrep.fieldGroups.briefing.hint')}
        collapsible={{
          filled: briefingFilled,
          summary: draft.briefing_date
            ? t('creator.conductPrep.summaries.briefingOn', {
                date: formatDay(draft.briefing_date, i18n.language),
              })
            : undefined,
        }}
      >
        <Briefing {...props} />
      </FieldGroup>
    </div>
  )
}

/** The controller and evaluator briefing: when, what it covers, notes,
 * and who attended -- the Controllers and the Evaluators of the day. */
function Briefing({ prep, draft, update, isInvalid, readOnly }: StepProps) {
  const { t } = useTranslation()
  const items = t('creator.conductPrep.briefing.items', { returnObjects: true }) as Record<
    string,
    string
  >
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Field
          id={conductFieldId('briefing_date')}
          label={t('creator.conductPrep.fields.briefing_date')}
          optional
        >
          <DateInput
            id={conductFieldId('briefing_date')}
            value={draft.briefing_date}
            invalid={isInvalid('briefing_date')}
            onChange={(briefing_date) => update({ briefing_date })}
          />
        </Field>
      </div>
      <CheckboxGroup
        id={conductFieldId('briefing_checklist')}
        legend={t('creator.conductPrep.fields.briefing_checklist')}
        columns={2}
        options={BRIEFING_ITEMS.map((value) => ({ value, label: items[value] }))}
        selected={draft.briefing_checklist}
        onChange={(briefing_checklist) => update({ briefing_checklist })}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {t('creator.conductPrep.briefing.attended')}
        </legend>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.conductPrep.briefing.controllers')}
            </p>
            {prep.context.exercise_controllers.map((person) => (
              <Checkbox
                key={person.user_id}
                id={conductFieldId('briefed_controller', person.user_id)}
                checked={draft.briefed_controller_ids.includes(person.user_id)}
                disabled={readOnly}
                onChange={(briefed) =>
                  update({
                    briefed_controller_ids: briefed
                      ? [...draft.briefed_controller_ids, person.user_id]
                      : draft.briefed_controller_ids.filter((id) => id !== person.user_id),
                  })
                }
              >
                {person.full_name}
              </Checkbox>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.conductPrep.briefing.evaluators')}
            </p>
            {prep.context.exercise_evaluators.length === 0 && (
              <p className="text-sm text-paper-ink/60 dark:text-fg-faint">
                {t('creator.conductPrep.evaluators.none')}
              </p>
            )}
            {prep.context.exercise_evaluators.map((person) => {
              const row = draft.evaluators.find((e) => e.user_id === person.user_id)
              return (
                <Checkbox
                  key={person.user_id}
                  id={conductFieldId('briefed', person.user_id)}
                  checked={row?.briefed ?? false}
                  disabled={readOnly}
                  onChange={(briefed) => patchEvaluator(draft, update, person.user_id, { briefed })}
                >
                  {person.full_name}
                  {prep.context.lead_evaluator?.user_id === person.user_id && (
                    <LeadEvaluatorBadge />
                  )}
                </Checkbox>
              )
            })}
          </div>
        </div>
      </fieldset>
      <Field
        id={conductFieldId('briefing_notes')}
        label={t('creator.conductPrep.fields.briefing_notes')}
        optional
      >
        <TextArea
          id={conductFieldId('briefing_notes')}
          value={draft.briefing_notes}
          onChange={(briefing_notes) => update({ briefing_notes })}
        />
      </Field>
    </div>
  )
}

/** The convocation: when the formal invitation went out and its text,
 * then who must be there -- the key decision makers. */
function Convocation(props: StepProps) {
  const { t } = useTranslation()
  const { draft, update } = props
  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <Field
          id={conductFieldId('invitation_sent_on')}
          label={t('creator.conductPrep.fields.invitation_sent_on')}
          optional
        >
          <DateInput
            id={conductFieldId('invitation_sent_on')}
            value={draft.invitation_sent_on}
            onChange={(invitation_sent_on) => update({ invitation_sent_on })}
          />
        </Field>
      </div>
      <Field
        id={conductFieldId('invitation_text')}
        label={t('creator.conductPrep.fields.invitation_text')}
        optional
      >
        <TextArea
          id={conductFieldId('invitation_text')}
          value={draft.invitation_text}
          rows={6}
          maxLength={20000}
          placeholder={t('creator.conductPrep.convocation.invitationTextPlaceholder')}
          onChange={(invitation_text) => update({ invitation_text })}
        />
      </Field>
      <Attendees {...props} />
    </div>
  )
}

/** Key decision makers. First who already has access to the exercise as
 * a Player (they used an invitation and were let in) -- each can be made
 * a decision maker, their name taken from the account; then the decision
 * makers, Players or added by hand, with their attendance and, for those
 * not confirmed, what happens if they don't come. */
function Attendees({ prep, draft, update, removeRow, isInvalid, readOnly }: StepProps) {
  const { t, i18n } = useTranslation()
  const ctx = prep.context
  const players = new Map(ctx.exercise_players.map((p) => [p.user_id, p]))
  const linked = new Set(draft.attendees.map((a) => a.user_id).filter(Boolean))
  const day = (iso: string | null) => (iso ? formatDay(iso.slice(0, 10), i18n.language) : '')

  function patch(id: string, change: Partial<DraftAttendee>) {
    update({ attendees: draft.attendees.map((a) => (rowId(a) === id ? { ...a, ...change } : a)) })
  }

  function add(userId: string | null, name = '') {
    update({ attendees: [...draft.attendees, newAttendee(userId, name)] })
  }

  function remove(attendee: DraftAttendee, index: number) {
    const id = rowId(attendee)
    removeRow(
      t('creator.conductPrep.logistics.attendees.removed'),
      (d: ConductPrepDraft) => ({ ...d, attendees: d.attendees.filter((a) => rowId(a) !== id) }),
      (d: ConductPrepDraft) => {
        if (d.attendees.some((a) => rowId(a) === id)) return d
        const attendees = [...d.attendees]
        attendees.splice(Math.min(index, attendees.length), 0, attendee)
        return { ...d, attendees }
      },
    )
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="cp-players-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h4 id="cp-players-title" className="text-sm font-medium">
            {t('creator.conductPrep.logistics.attendees.playersTitle', {
              count: ctx.exercise_players.length,
            })}
          </h4>
          {ctx.pending_access_requests > 0 && (
            <p className="text-xs text-paper-ink/70 dark:text-fg-muted">
              {t('creator.conductPrep.logistics.attendees.pendingRequests', {
                count: ctx.pending_access_requests,
              })}{' '}
              <Link to="/creator/players/pending" className={linkAccent}>
                {t('creator.conductPrep.logistics.attendees.review')}
              </Link>
            </p>
          )}
        </div>
        {ctx.exercise_players.length === 0 ? (
          <p className="text-sm text-paper-ink/60 dark:text-fg-faint">
            {t('creator.conductPrep.logistics.attendees.noPlayers')}{' '}
            <Link to="/creator/players/invitations" className={linkAccent}>
              {t('creator.conductPrep.logistics.attendees.createInvitation')}
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-panel-line rounded-sm border border-panel-line">
            {ctx.exercise_players.map((player) => (
              <li
                key={player.user_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{player.full_name}</p>
                  <p className="truncate text-xs text-paper-ink/60 dark:text-fg-faint">
                    {player.email}
                  </p>
                </div>
                <p
                  className="col-span-2 row-start-2 text-xs text-paper-ink/70 sm:col-span-1 sm:col-start-2 sm:row-start-1 dark:text-fg-muted"
                  title={t('creator.conductPrep.logistics.attendees.joinedOn', {
                    date: day(player.joined_at),
                  })}
                >
                  {player.invited_at
                    ? t('creator.conductPrep.logistics.attendees.invitedOn', {
                        date: day(player.invited_at),
                      })
                    : t('creator.conductPrep.logistics.attendees.joinedOn', {
                        date: day(player.joined_at),
                      })}
                </p>
                <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3">
                  {linked.has(player.user_id) ? (
                    <span className="text-xs text-success-fg">
                      <span aria-hidden="true">✓ </span>
                      {t('creator.conductPrep.logistics.attendees.alreadyAdded')}
                    </span>
                  ) : (
                    !readOnly && (
                      <button
                        type="button"
                        onClick={() => add(player.user_id, player.full_name)}
                        aria-label={t('creator.conductPrep.logistics.attendees.addPlayerLabel', {
                          name: player.full_name,
                        })}
                        className={`${btnSecondary} h-8 px-3 text-xs`}
                      >
                        {t('creator.conductPrep.logistics.attendees.addPlayer')}
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        id={conductFieldId('attendees')}
        tabIndex={-1}
        aria-labelledby="cp-makers-title"
        className="space-y-2"
      >
        <h4 id="cp-makers-title" className="text-sm font-medium">
          {t('creator.conductPrep.logistics.attendees.makersTitle', {
            count: draft.attendees.length,
          })}
        </h4>
        {draft.attendees.length === 0 ? (
          <p className="text-sm text-paper-ink/60 dark:text-fg-faint">
            {t('creator.conductPrep.logistics.attendees.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-panel-line rounded-sm border border-panel-line">
            {draft.attendees.map((attendee, index) => (
              <DecisionMaker
                key={rowId(attendee)}
                attendee={attendee}
                player={attendee.user_id ? players.get(attendee.user_id) : undefined}
                day={day}
                index={index}
                isInvalid={isInvalid}
                readOnly={readOnly}
                onPatch={(change) => patch(rowId(attendee), change)}
                onRemove={() => remove(attendee, index)}
              />
            ))}
          </ul>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => add(null)}
            className={`rounded-xs text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
          >
            {t('creator.conductPrep.logistics.attendees.addManual')}
          </button>
        )}
      </section>
    </div>
  )
}

/** One decision maker: who (a Player's account name, or typed), their
 * position, attendance, and -- when not confirmed -- the decision taken
 * now for if they don't come. */
function DecisionMaker({
  attendee,
  player,
  day,
  index,
  isInvalid,
  readOnly,
  onPatch,
  onRemove,
}: {
  attendee: DraftAttendee
  player: ConductPrep['context']['exercise_players'][number] | undefined
  day: (iso: string | null) => string
  index: number
  isInvalid: StepProps['isInvalid']
  readOnly: boolean
  onPatch: (change: Partial<DraftAttendee>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const id = rowId(attendee)
  const fallbacks = t('creator.conductPrep.logistics.fallbacks', { returnObjects: true }) as Record<
    string,
    string
  >
  const name = player?.full_name ?? attendee.name
  return (
    <li className="space-y-3 px-3 py-3">
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start">
        <div className="min-w-0">
          {player ? (
            <p className="truncate text-sm font-medium">{name}</p>
          ) : (
            <TextInput
              id={conductFieldId('name', id)}
              value={attendee.name}
              maxLength={255}
              invalid={isInvalid('name', id)}
              aria-label={t('creator.conductPrep.logistics.attendees.name')}
              placeholder={t('creator.conductPrep.logistics.attendees.namePlaceholder')}
              onChange={(value) => onPatch({ name: value })}
            />
          )}
          <p className="mt-0.5 text-xs text-paper-ink/60 dark:text-fg-faint">
            {player
              ? t('creator.conductPrep.logistics.attendees.player', {
                  date: day(player.joined_at),
                })
              : t('creator.conductPrep.logistics.attendees.noAccess')}
          </p>
        </div>
        <TextInput
          id={`cp-role-${id}`}
          value={attendee.role}
          maxLength={255}
          aria-label={t('creator.conductPrep.logistics.attendees.role')}
          placeholder={t('creator.conductPrep.logistics.attendees.rolePlaceholder')}
          onChange={(role) => onPatch({ role })}
        />
        <button
          type="button"
          aria-pressed={attendee.confirmed}
          disabled={readOnly}
          onClick={() => onPatch({ confirmed: !attendee.confirmed })}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
            attendee.confirmed
              ? 'border-success/60 bg-success/10 text-success-fg'
              : 'border-panel-line text-paper-ink/70 hover:bg-hover dark:text-fg-muted'
          }`}
        >
          <span aria-hidden="true">{attendee.confirmed ? '✓' : '○'}</span>
          {attendee.confirmed
            ? t('creator.conductPrep.logistics.attendees.confirmedState')
            : t('creator.conductPrep.logistics.attendees.unconfirmed')}
        </button>
        {!readOnly ? (
          <IconButton
            label={t('creator.conductPrep.logistics.attendees.removeLabel', {
              name: name || index + 1,
            })}
            onClick={onRemove}
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {!attendee.confirmed && (
        <fieldset
          id={conductFieldId('fallback', id)}
          tabIndex={-1}
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <legend className="float-left mr-2 text-xs text-paper-ink/70 dark:text-fg-muted">
            {t('creator.conductPrep.logistics.attendees.fallback')}
          </legend>
          {FALLBACKS.map((value) => (
            <label key={value} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={`cp-fallback-${id}`}
                checked={attendee.fallback === value}
                disabled={readOnly}
                onChange={() => onPatch({ fallback: value })}
                className="h-4 w-4 accent-accent-fg"
              />
              {fallbacks[value]}
            </label>
          ))}
          {attendee.fallback === 'substitute' && (
            <div className="w-full sm:w-64">
              <TextInput
                id={conductFieldId('substitute', id)}
                value={attendee.substitute}
                maxLength={255}
                invalid={isInvalid('substitute', id)}
                aria-label={t('creator.conductPrep.logistics.attendees.substitute')}
                placeholder={t('creator.conductPrep.logistics.attendees.substitutePlaceholder')}
                onChange={(substitute) => onPatch({ substitute })}
              />
            </div>
          )}
        </fieldset>
      )}
    </li>
  )
}
