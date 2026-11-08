import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../../hooks/useApiResource'
import { useAttackConversionSummary } from '../../../hooks/useAttackConversionSummary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { apiFetch, ApiError } from '../../../lib/api'
import { btnSecondary, inputBase, linkAccent } from '../../../lib/buttonStyles'
import { enabledOnly } from '../../../lib/libraryItems'
import {
  MAX_THREAT_ACTORS,
  mselFieldId,
  newMselKey,
  type MselDraft,
  type ThreatActorDraft,
} from '../../../lib/msel'
import {
  emptyThreatActor,
  copyOfSystem,
  fromOrganization,
  groupUrl,
  matchesGroup,
  type ThreatActorFields,
} from '../../../lib/threatActors'
import type {
  OrganizationThreatActor,
  SystemThreatActorCatalog,
  ThreatActorProfileConversion,
} from '../../../lib/types'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { Modal } from '../../common/Modal'
import { LibraryLevelSwitch } from '../../templates/LibraryLevelSwitch'
import {
  ThreatActorFormModal,
  ThreatActorTechniques,
  ThreatActorTechniquesPicker,
} from '../../templates/ThreatActorFormModal'
import type { TabProps } from './tabProps'

type Props = Pick<
  TabProps,
  'msel' | 'draft' | 'update' | 'removeRow' | 'catalog' | 'readOnly' | 'renumberButton'
>

/** Threat actor fields as a new row of the scenario's draft. */
function toDraft(fields: ThreatActorFields): ThreatActorDraft {
  return {
    id: null,
    key: newMselKey(),
    code: '',
    name: fields.name,
    mitre_group_id: fields.mitre_group_id,
    aliases: fields.aliases,
    description: fields.description,
    techniques: fields.techniques,
    origin: fields.origin ?? 'exercise',
    origin_id: fields.origin_id,
    origin_name: fields.origin_name,
    modified_at: null,
  }
}

function asFields(actor: ThreatActorDraft, attackVersion: string): ThreatActorFields {
  return { ...actor, attack_version: attackVersion }
}

/** Add threat actors from the library: MITRE ATT&CK's groups (searchable
 * by id, name or associated group) or the organization's. Each Add copies
 * one into the scenario's draft; it saves with the rest of the MSEL. */
function ThreatActorLibraryPicker({
  draft,
  onAdd,
  onClose,
}: {
  draft: MselDraft
  onAdd: (fields: ThreatActorFields) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { activeOrganizationId } = useAuth()
  const [level, setLevel] = useState<'system' | 'organization'>('system')
  const [query, setQuery] = useState('')
  const system = useApiResource<SystemThreatActorCatalog>('/threat-actor-catalog')
  const organization = useApiResource<{ items: OrganizationThreatActor[] }>(
    activeOrganizationId ? `/organizations/${activeOrganizationId}/threat-actors` : null,
  )
  const levels: ('system' | 'organization')[] = organization.data
    ? ['system', 'organization']
    : ['system']
  const version = system.data?.attack_version ?? ''
  const rows =
    level === 'system'
      ? (system.data?.items ?? [])
          .filter((group) => matchesGroup(group, query))
          .map((group) => ({
            key: group.id,
            fields: copyOfSystem(group, version),
            documented: group.techniques.length,
          }))
      : enabledOnly(organization.data?.items ?? [])
          .filter((actor) =>
            matchesGroup(
              {
                id: actor.mitre_group_id ?? '',
                name: actor.name,
                aliases: actor.aliases,
                techniques: [],
              },
              query,
            ),
          )
          .map((actor) => ({
            key: actor.id,
            fields: fromOrganization(actor),
            documented: actor.techniques.length,
          }))
  const added = new Set(draft.threat_actors.map((a) => a.origin_id))
  const full = draft.threat_actors.length >= MAX_THREAT_ACTORS

  return (
    <Modal titleId="threat-actor-picker-title" onClose={onClose} size="lg">
      <h2
        id="threat-actor-picker-title"
        className="text-balance text-lg font-semibold tracking-tight"
      >
        {t('creator.msel.threatActors.pickerTitle')}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {levels.length > 1 && (
          <LibraryLevelSwitch
            levels={levels}
            value={level}
            onChange={(next) => setLevel(next as 'system' | 'organization')}
          />
        )}
        <label htmlFor="threat-actor-picker-search" className="sr-only">
          {t('templates.filters.search')}
        </label>
        <input
          id="threat-actor-picker-search"
          name="threat-actor-picker-search"
          type="search"
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('templates.threats.searchPlaceholder')}
          className={`${inputBase} max-w-xs flex-1`}
        />
      </div>
      <ul className="max-h-[50vh] divide-y divide-panel-line overflow-y-auto rounded-sm border border-panel-line">
        {rows.map(({ key, fields, documented }) => {
          const isAdded = added.has(fields.origin_id)
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {fields.mitre_group_id && (
                    <span translate="no" className="mr-1.5 font-mono text-xs">
                      {fields.mitre_group_id}
                    </span>
                  )}
                  {fields.name}
                </p>
                <p className="truncate text-xs text-paper-ink/60 dark:text-fg-faint">
                  {[
                    fields.aliases.join(', '),
                    t('templates.threats.fields.techniques', { count: documented }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                disabled={isAdded || full}
                aria-label={t('creator.msel.threatActors.addLabel', { name: fields.name })}
                onClick={() => onAdd(fields)}
                className={btnSecondary}
              >
                {isAdded ? t('templates.actors.picker.added') : t('templates.actors.picker.add')}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('templates.actors.picker.close')}
        </button>
      </div>
    </Modal>
  )
}

/** The threat actors behind the scenario -- one or several, perhaps
 * collaborating: copies of Library -> Threat actors (MITRE groups or the
 * organization's), or unknown actors made here, with or without their own
 * techniques. Injects attribute their techniques to one of them (or to
 * noise); how many each is attributed shows on its card. */
export function ThreatActorsSection({
  msel,
  draft,
  update,
  removeRow,
  catalog,
  readOnly,
  renumberButton,
}: Props) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const summarize = useAttackConversionSummary()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<{ actor: ThreatActorDraft; isNew: boolean } | null>(null)
  const [choosing, setChoosing] = useState<ThreatActorDraft | null>(null)
  // How many techniques MITRE documents for each group: what the scenario's
  // choice is out of.
  const groups = useApiResource<SystemThreatActorCatalog>(
    draft.threat_actors.some((actor) => actor.mitre_group_id) ? '/threat-actor-catalog' : null,
  ).data
  const documentedCount = (groupId: string | null) =>
    groupId ? groups?.items.find((group) => group.id === groupId)?.techniques.length : undefined
  const full = draft.threat_actors.length >= MAX_THREAT_ACTORS
  // The techniques the injects attributed to an actor use ("domain|id").
  const exercisedBy = (key: string) =>
    new Set(
      draft.injects
        .filter((i) => i.attack_attribution === 'threat_actor' && i.threat_actor_key === key)
        .flatMap((i) => i.attack_techniques.map((ref) => `${ref.domain}|${ref.technique_id}`)),
    )
  const usedBy = (key: string) =>
    draft.injects.filter(
      (inject) => inject.attack_attribution === 'threat_actor' && inject.threat_actor_key === key,
    ).length

  /** A library actor into the draft, moved onto the MSEL's ATT&CK release
   * first (it may come from another): MITRE's replacements apply, and a
   * group that release doesn't have leaves an unknown actor -- said so. */
  async function addFromLibrary(fields: ThreatActorFields) {
    try {
      const converted = await apiFetch<ThreatActorProfileConversion>(
        `/attack/${msel.attack_version}/threat-actor`,
        {
          method: 'POST',
          body: JSON.stringify({
            mitre_group_id: fields.mitre_group_id,
            techniques: fields.techniques,
          }),
        },
      )
      update({
        threat_actors: [
          ...draft.threat_actors,
          toDraft({
            ...fields,
            mitre_group_id: converted.mitre_group_id,
            techniques: converted.techniques.map(({ domain, technique_id }) => ({
              domain,
              technique_id,
            })),
          }),
        ],
      })
      const groupGone = fields.mitre_group_id !== null && converted.mitre_group_id === null
      const notes = [
        groupGone
          ? t('creator.msel.threatActors.groupNotInRelease', {
              group: fields.mitre_group_id,
              version: msel.attack_version,
            })
          : '',
        summarize({
          ...converted.conversion,
          removed: converted.conversion.removed.filter((id) => id !== fields.mitre_group_id),
        }),
      ]
        .filter(Boolean)
        .join(' ')
      if (notes) showToast(notes)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    }
  }

  function save(actor: ThreatActorDraft) {
    update({
      threat_actors: draft.threat_actors.some((a) => a.key === actor.key)
        ? draft.threat_actors.map((a) =>
            a.key === actor.key
              ? { ...actor, id: a.id ?? actor.id, code: a.code || actor.code }
              : a,
          )
        : [...draft.threat_actors, actor],
    })
  }

  return (
    // The tab's own panel says what this is: here, like Phases, the count on
    // the left and the actions on the right.
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.msel.threatActors.count', { count: draft.threat_actors.length })}
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {renumberButton('threat_actors')}
            <button
              type="button"
              disabled={full}
              onClick={() => setPicking(true)}
              className={btnSecondary}
            >
              {t('creator.msel.threatActors.fromLibrary')}
            </button>
            <button
              type="button"
              disabled={full}
              onClick={() =>
                setEditing({
                  actor: toDraft(emptyThreatActor(msel.attack_version)),
                  isNew: true,
                })
              }
              className={btnSecondary}
            >
              <span aria-hidden="true">+ </span>
              {t('creator.msel.threatActors.newUnknown')}
            </button>
          </div>
        )}
      </div>

      {draft.threat_actors.length === 0 ? (
        <p className="rounded-sm border border-dashed border-paper-line px-4 py-6 text-center text-sm text-paper-ink/70 dark:border-line dark:text-fg-muted">
          {t('creator.msel.threatActors.empty')}
        </p>
      ) : (
        // One full-width row per actor: 1 or 5 read the same, and the
        // techniques open across the whole panel without stretching others.
        <ul className="-mx-5 divide-y divide-panel-line border-y border-panel-line">
          {draft.threat_actors.map((actor) => {
            const name = actor.name || actor.code || t('creator.msel.table.pendingCode')
            const documented = documentedCount(actor.mitre_group_id)
            const exercised = exercisedBy(actor.key).size
            const aliases = actor.aliases.join(', ')
            return (
              <li key={actor.key} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  {/* Who it is. Where a copy comes from is in its form. */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      <span
                        translate="no"
                        className="mr-1.5 font-mono text-xs text-paper-ink/60 dark:text-fg-faint"
                      >
                        {actor.code || t('creator.msel.table.pendingCode')}
                      </span>
                      {actor.name || '—'}
                    </p>
                    <p
                      title={aliases || undefined}
                      className="truncate text-xs text-paper-ink/60 dark:text-fg-faint"
                    >
                      {actor.mitre_group_id ? (
                        <a
                          href={groupUrl(msel.attack_version, actor.mitre_group_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono hover:underline"
                        >
                          {actor.mitre_group_id}
                        </a>
                      ) : (
                        t('creator.msel.threatActors.unknown')
                      )}
                      {aliases && ` · ${aliases}`}
                    </p>
                  </div>
                  {/* At a glance -- the scenario's techniques (out of MITRE's
                      documented ones), what the injects exercise of them and
                      how many injects are its -- then its actions. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    {actor.techniques.length === 0 ? (
                      <>
                        <p className="text-xs text-paper-ink/70 dark:text-fg-muted">
                          {t('creator.msel.threatActors.noTechniques')}
                          {usedBy(actor.key) > 0 &&
                            ` ${t('creator.msel.threatActors.injects', { count: usedBy(actor.key) })}.`}
                        </p>
                        {!readOnly && (
                          <button
                            type="button"
                            disabled={!catalog}
                            aria-label={t('creator.msel.threatActors.chooseTechniquesLabel', {
                              name,
                            })}
                            onClick={() => setChoosing(actor)}
                            className={btnSecondary}
                          >
                            {t('creator.msel.threatActors.chooseTechniques')}
                          </button>
                        )}
                      </>
                    ) : (
                      <ul className="flex flex-wrap items-center text-xs text-paper-ink/70 tabular-nums dark:text-fg-muted [&>li+li]:before:mx-1.5 [&>li+li]:before:text-paper-ink/35 [&>li+li]:before:content-['·'] dark:[&>li+li]:before:text-fg-faint">
                        <li
                          title={
                            documented !== undefined
                              ? t('creator.msel.threatActors.scenarioTechniquesHelp')
                              : undefined
                          }
                        >
                          {documented !== undefined
                            ? t('creator.msel.threatActors.scenarioTechniquesOf', {
                                count: actor.techniques.length,
                                total: documented,
                              })
                            : t('creator.msel.threatActors.scenarioTechniques', {
                                count: actor.techniques.length,
                              })}
                        </li>
                        <li className={exercised > 0 ? 'text-accent-fg' : undefined}>
                          {t('creator.msel.threatActors.exercised', { count: exercised })}
                        </li>
                        <li>
                          {t('creator.msel.threatActors.injects', { count: usedBy(actor.key) })}
                        </li>
                      </ul>
                    )}
                    <div className="flex items-center gap-1">
                      <EditButton
                        id={mselFieldId('threat_actor', actor.key)}
                        label={t('creator.msel.threatActors.editLabel', { name })}
                        onClick={() => setEditing({ actor, isNew: false })}
                      />
                      {!readOnly && (
                        <IconButton
                          label={t('creator.msel.threatActors.removeLabel', { name })}
                          onClick={() =>
                            removeRow(
                              'threat_actors',
                              actor.key,
                              t('creator.msel.toast.threatActorRemoved', { name }),
                            )
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
                {actor.description && (
                  <p className="line-clamp-2 text-xs text-pretty text-paper-ink/70 dark:text-fg-muted">
                    {actor.description}
                  </p>
                )}
                {actor.techniques.length > 0 && (
                  // The techniques themselves, folded, on their own tinted
                  // panel; changing them is one click away.
                  <details className="group">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none"
                      >
                        ›
                      </span>
                      <span className="group-open:hidden">
                        {t('creator.msel.threatActors.showProfile')}
                      </span>
                      <span className="hidden group-open:inline">
                        {t('creator.msel.threatActors.hideProfile')}
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2 rounded-sm bg-paper-ink/[0.03] p-3 dark:bg-white/[0.03]">
                      <ThreatActorTechniques
                        fields={{
                          techniques: actor.techniques,
                          attack_version: msel.attack_version,
                        }}
                        catalog={catalog}
                        exercised={exercisedBy(actor.key)}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          disabled={!catalog}
                          aria-label={t('creator.msel.threatActors.editTechniquesLabel', {
                            name,
                          })}
                          onClick={() => setChoosing(actor)}
                          className={`${linkAccent} text-xs`}
                        >
                          {t('creator.msel.threatActors.editTechniques')}
                        </button>
                      )}
                    </div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {picking && (
        <ThreatActorLibraryPicker
          draft={draft}
          onAdd={(fields) => void addFromLibrary(fields)}
          onClose={() => setPicking(false)}
        />
      )}
      {choosing && catalog && (
        <ThreatActorTechniquesPicker
          name={choosing.name}
          mitreGroupId={choosing.mitre_group_id}
          techniques={choosing.techniques}
          catalog={catalog}
          onApply={(techniques) => save({ ...choosing, techniques })}
          onClose={() => setChoosing(null)}
        />
      )}
      {editing && (
        <ThreatActorFormModal
          title={
            editing.isNew
              ? t('creator.msel.threatActors.newUnknown')
              : t('templates.threats.editTitle', { name: editing.actor.name })
          }
          level="exercise"
          initial={asFields(editing.actor, msel.attack_version)}
          modifiedAt={editing.isNew ? undefined : editing.actor.modified_at}
          readOnly={readOnly}
          onSubmit={async (fields) => {
            save({ ...editing.actor, ...fields, origin: fields.origin ?? 'exercise' })
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
