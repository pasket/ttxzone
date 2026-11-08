import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { btnPrimary, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import type { LibraryLevel } from '../../lib/libraryLevels'
import { attackUrl } from '../../lib/msel'
import { hasFinePointer } from '../../lib/pointer'
import {
  asPickerRefs,
  groupUrl,
  MAX_THREAT_ACTOR_TECHNIQUES,
  techniqueKey,
  techniquesByTactic,
  type ThreatActorFields,
} from '../../lib/threatActors'
import type { AttackCatalog, SystemThreatActorCatalog, ThreatActorTechnique } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'
import { AttackPicker } from '../creator/msel/AttackPicker'
import { Field, ListInput, TextArea } from '../creator/needs/fields'
import { CopiedFrom } from './ActorFormModal'
import { ContainerNameInput } from './ContainerNameInput'

/** A threat actor's techniques, grouped by tactic in matrix order, each
 * linking to its page in the actor's release; those in `exercised` (an
 * inject uses them) are marked. */
export function ThreatActorTechniques({
  fields,
  catalog,
  exercised,
}: {
  fields: Pick<ThreatActorFields, 'techniques' | 'attack_version'>
  catalog: AttackCatalog | null
  /** "domain|technique id" of the techniques injects use. */
  exercised?: Set<string>
}) {
  const { t } = useTranslation()
  if (fields.techniques.length === 0) {
    return (
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('templates.threats.noTechniques')}
      </p>
    )
  }
  if (!catalog) return null
  return (
    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
      {techniquesByTactic(fields.techniques, catalog).map((group) => (
        <div key={group.key} className="border-l-2 border-panel-line pl-2.5">
          <p className="text-xs font-medium tracking-wide text-paper-ink/60 uppercase dark:text-fg-faint">
            {group.tacticName}
            {catalog.domains.length > 1 && ` · ${group.domainName}`}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {group.techniques.map((technique) => {
              const used = exercised?.has(`${group.domain}|${technique.id}`) ?? false
              return (
                <li key={technique.id}>
                  <a
                    href={attackUrl(fields.attack_version, technique.id)}
                    target="_blank"
                    rel="noreferrer"
                    title={
                      used
                        ? `${technique.name} · ${t('templates.threats.exercised')}`
                        : technique.name
                    }
                    className={`inline-flex max-w-72 items-center gap-1 rounded-xs border px-1.5 py-0.5 text-xs hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                      used ? 'border-accent/60 bg-accent/10' : 'border-paper-line dark:border-line'
                    }`}
                  >
                    {used && (
                      <>
                        <span aria-hidden="true" className="text-accent-fg">
                          ✓
                        </span>
                        <span className="sr-only">{t('templates.threats.exercised')}: </span>
                      </>
                    )}
                    <span translate="no" className="font-mono">
                      {technique.id}
                    </span>
                    <span className="truncate">{technique.name}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** The ATT&CK picker on a threat actor's techniques: a MITRE group's
 * documented ones are its filters, the actor's own are what is ticked (a
 * fresh copy: none). An unknown actor gets the whole matrix, no filters. */
export function ThreatActorTechniquesPicker({
  name,
  mitreGroupId,
  techniques,
  catalog,
  onApply,
  onClose,
}: {
  name: string
  mitreGroupId: string | null
  techniques: ThreatActorTechnique[]
  catalog: AttackCatalog
  onApply: (techniques: ThreatActorTechnique[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const groups = useApiResource<SystemThreatActorCatalog>(
    mitreGroupId ? '/threat-actor-catalog' : null,
  )
  // The picker sets its filters up on mount: wait for MITRE's list.
  if (groups.loading) return null
  const documented = groups.data?.items.find((group) => group.id === mitreGroupId)?.techniques
  return (
    <AttackPicker
      catalog={catalog}
      selected={asPickerRefs(techniques, catalog)}
      keyOf={techniqueKey}
      max={MAX_THREAT_ACTOR_TECHNIQUES}
      title={t('templates.threats.pickerTitle', { name })}
      profile={documented ? { name, techniques: new Set(documented.map(techniqueKey)) } : undefined}
      profileHelp={t('templates.threats.pickerProfileHelp', { name })}
      onApply={(refs) =>
        onApply([
          ...new Map(
            refs.map((ref) => [
              techniqueKey(ref),
              { domain: ref.domain, technique_id: ref.technique_id },
            ]),
          ).values(),
        ])
      }
      onClose={onClose}
    />
  )
}

/** A threat actor of the library: read-only for a TTX-Zone (MITRE) group,
 * a form for an organization's -- name, associated groups, notes and the
 * techniques (from the ATT&CK picker, filtered on the MITRE group's
 * documented ones but none ticked for it; an unknown actor may have none).
 * The MITRE group it is stays fixed. */
export function ThreatActorFormModal({
  title,
  level,
  initial,
  readOnly = false,
  modifiedAt,
  onSubmit,
  onClose,
}: {
  title: string
  /** Where the actor lives (shown in front of its name). */
  level: LibraryLevel
  initial: ThreatActorFields
  readOnly?: boolean
  /** For a copy: when it last changed (null: never) -- said under "Copied
   * from". Left out, nothing is said. */
  modifiedAt?: string | null
  onSubmit?: (values: ThreatActorFields) => Promise<void>
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const catalog = useApiResource<AttackCatalog>(`/attack/${values.attack_version}`).data
  const set = (patch: Partial<ThreatActorFields>) => setValues({ ...values, ...patch })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!onSubmit) return
    setBusy(true)
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="threat-actor-form-title" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <h2
          id="threat-actor-form-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        {/* Only a copy says what it was copied from. */}
        {!readOnly && values.origin && values.origin_id && (
          <div className="space-y-1">
            <CopiedFrom origin={values.origin} name={values.origin_name} />
            {modifiedAt !== undefined && (
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {modifiedAt
                  ? t('templates.threats.lastModified', {
                      date: new Date(modifiedAt).toLocaleString(i18n.language, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })
                  : t('templates.threats.notModified')}
              </p>
            )}
          </div>
        )}
        {values.mitre_group_id && (
          <p className="text-sm">
            <span className="font-medium">{t('templates.threats.fields.mitreGroup')}: </span>
            <a
              href={groupUrl(values.attack_version, values.mitre_group_id)}
              target="_blank"
              rel="noreferrer"
              className={linkAccent}
            >
              <span translate="no" className="font-mono">
                {values.mitre_group_id}
              </span>{' '}
              {t('templates.threats.onMitre', { version: values.attack_version })}
            </a>
          </p>
        )}
        {readOnly ? (
          values.aliases.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">{t('templates.threats.fields.aliases')}: </span>
              {values.aliases.join(', ')}
            </p>
          )
        ) : (
          <>
            <Field id="threat-actor-name" label={t('creator.msel.fields.name')}>
              <ContainerNameInput
                id="threat-actor-name"
                level={level}
                value={values.name}
                maxLength={255}
                autoFocus={hasFinePointer()}
                onChange={(name) => set({ name })}
              />
            </Field>
            <ListInput
              id="threat-actor-aliases"
              label={t('templates.threats.fields.aliases')}
              hint={t('templates.threats.aliasesHint')}
              values={values.aliases}
              onChange={(aliases) => set({ aliases })}
              optional
            />
            <Field
              id="threat-actor-description"
              label={t('templates.threats.fields.description')}
              optional
            >
              <TextArea
                id="threat-actor-description"
                value={values.description}
                rows={3}
                placeholder={t('templates.threats.descriptionPlaceholder')}
                onChange={(description) => set({ description })}
              />
            </Field>
          </>
        )}

        <section aria-labelledby="threat-actor-techniques" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="threat-actor-techniques" className="text-balance text-sm font-medium">
              {level === 'exercise'
                ? t('creator.msel.threatActors.formTechniques', { count: values.techniques.length })
                : t('templates.threats.fields.techniques', { count: values.techniques.length })}
            </h3>
            {!readOnly && (
              <button
                type="button"
                disabled={!catalog}
                onClick={() => setPicking(true)}
                className={btnSecondary}
              >
                {t('templates.threats.chooseTechniques')}
              </button>
            )}
          </div>
          <ThreatActorTechniques fields={values} catalog={catalog} />
          {catalog && (
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{catalog.copyright}</p>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {readOnly ? t('templates.threats.close') : t('common.confirmButton.cancel')}
          </button>
          {!readOnly && (
            <button type="submit" disabled={busy || !values.name.trim()} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
          )}
        </div>
      </form>
      {picking && catalog && (
        <ThreatActorTechniquesPicker
          name={values.name}
          mitreGroupId={values.mitre_group_id}
          techniques={values.techniques}
          catalog={catalog}
          onApply={(techniques) => set({ techniques })}
          onClose={() => setPicking(false)}
        />
      )}
    </Modal>
  )
}
