import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { btnSecondary, linkAccent, optionalSuffix } from '../../../lib/buttonStyles'
import {
  attackKey,
  attackUrl,
  MAX_INJECT_TECHNIQUES,
  type InjectDraft,
  type MselDraft,
} from '../../../lib/msel'
import { codeRefText } from '../../../lib/codeRef'
import { techniqueKey } from '../../../lib/threatActors'
import type { AttackAttribution, AttackCatalog, AttackRef } from '../../../lib/types'
import { RadioCards } from '../../common/RadioCards'
import { Field, Select } from '../needs/fields'
import { AttackPicker } from './AttackPicker'

type Choice = AttackAttribution | 'none'

/** An inject's ATT&CK: whose activity it is -- none (a regulator's call,
 * a business decision), a threat actor of the scenario, or noise
 * (unrelated activity, a false positive) -- and, unless none, its
 * techniques from the MSEL's release. For a threat actor with a profile
 * the picker opens on that actor's techniques; others stay reachable (a
 * warning then says so). */
export function InjectAttackField({
  inject,
  draft,
  catalog,
  attackVersion,
  set,
  id,
  onAddToProfile,
}: {
  /** Adds a technique to the inject's threat actor's profile (in the
   * scenario), when it isn't there. */
  onAddToProfile?: (ref: AttackRef) => void
  inject: InjectDraft
  draft: MselDraft
  catalog: AttackCatalog | null
  attackVersion: string
  set: (patch: Partial<InjectDraft>) => void
  id: (field: string) => string
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const choice: Choice = inject.attack_attribution ?? 'none'
  const actor = draft.threat_actors.find((a) => a.key === inject.threat_actor_key) ?? null

  function choose(next: Choice) {
    if (next === 'none') {
      set({ attack_attribution: null, threat_actor_key: null, attack_techniques: [] })
    } else if (next === 'noise') {
      set({ attack_attribution: 'noise', threat_actor_key: null })
    } else {
      set({
        attack_attribution: 'threat_actor',
        // The only one there is, when the scenario has a single actor.
        threat_actor_key:
          inject.threat_actor_key ??
          (draft.threat_actors.length === 1 ? draft.threat_actors[0].key : null),
      })
    }
  }

  // An attack first (a scenario's threat actor, or noise), then a
  // parallel event with none behind it.
  const choices: Choice[] = ['threat_actor', 'noise', 'none']
  return (
    <div className="space-y-3">
      {/* Whose activity it shows, the three answers in view. */}
      <RadioCards<Choice>
        id={id('attack_attribution')}
        name={id('attack_attribution')}
        legend={t('creator.msel.attribution.label')}
        hideLegend
        columns={3}
        value={choice}
        onChange={choose}
        options={choices.map((value) => ({
          value,
          label: t(`creator.msel.attribution.${value}`),
          hint: t(`creator.msel.attribution.hints.${value}`),
        }))}
      />

      {choice === 'threat_actor' && (
        <Field id={id('threat_actor_key')} label={t('creator.msel.fields.threat_actor_key')}>
          {draft.threat_actors.length === 0 ? (
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('creator.msel.attribution.noThreatActors')}{' '}
              {/* The inject is already saved: leaving for that tab loses
                  nothing. */}
              <Link to={{ search: '?tab=threats' }} className={linkAccent}>
                {t('creator.msel.attribution.goToThreatActors')}
              </Link>
            </p>
          ) : (
            <Select<string>
              id={id('threat_actor_key')}
              value={inject.threat_actor_key}
              placeholder={t('creator.msel.attribution.chooseActor')}
              onChange={(threat_actor_key) => set({ threat_actor_key })}
              options={draft.threat_actors.map((a) => ({
                value: a.key,
                label: codeRefText(
                  a.code,
                  `${a.name}${a.mitre_group_id ? ` (${a.mitre_group_id})` : ''}`,
                  t('creator.msel.table.pendingCode'),
                ),
              }))}
            />
          )}
        </Field>
      )}

      {choice !== 'none' && (
        <div className="space-y-2">
          {/* The attack's MITRE ATT&CK techniques: expected of a threat
              actor, optional for noise. */}
          <h4 className="text-balance text-sm font-medium">
            {t('creator.msel.attribution.techniquesHeading')}
            {choice === 'noise' && (
              <>
                {' '}
                <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
              </>
            )}
          </h4>
          {inject.attack_techniques.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {inject.attack_techniques.map((ref) => {
                const off =
                  actor !== null &&
                  actor.techniques.length > 0 &&
                  !actor.techniques.some((x) => techniqueKey(x) === techniqueKey(ref))
                return (
                  <li
                    key={attackKey(ref)}
                    className="inline-flex items-center gap-1 rounded-sm border border-paper-line py-0.5 pr-1 pl-2 text-sm dark:border-line"
                  >
                    <a
                      href={attackUrl(attackVersion, ref.technique_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${ref.tactic_name}: ${ref.technique_name}`}
                      className="hover:text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                    >
                      <span translate="no" className="font-mono text-xs">
                        {ref.technique_id}
                      </span>{' '}
                      {ref.technique_name}
                    </a>
                    {/* Not in the actor's documented techniques: allowed (MITRE
                        only records documented uses), said, and one click
                        from joining the profile. */}
                    {off && actor && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-inactive-1">
                        <span title={t('creator.msel.attribution.offProfileHelp')}>
                          {t('creator.msel.attribution.offProfileOf', { name: actor.name })}
                        </span>
                        {onAddToProfile && (
                          <button
                            type="button"
                            onClick={() => onAddToProfile(ref)}
                            className={`${linkAccent} text-xs font-medium`}
                          >
                            {t('creator.msel.attribution.addToProfile')}
                          </button>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={t('creator.msel.attack.remove', {
                        technique: `${ref.technique_id} ${ref.technique_name}`,
                      })}
                      onClick={() =>
                        set({
                          attack_techniques: inject.attack_techniques.filter(
                            (x) => attackKey(x) !== attackKey(ref),
                          ),
                        })
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-xs text-paper-ink/60 hover:bg-hover hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted dark:hover:text-fg"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button
            id={id('attack_techniques')}
            type="button"
            disabled={!catalog}
            onClick={() => setPicking(true)}
            className={btnSecondary}
          >
            {t('creator.msel.attack.choose')}
          </button>
        </div>
      )}

      {picking && catalog && (
        <AttackPicker
          catalog={catalog}
          selected={inject.attack_techniques}
          max={MAX_INJECT_TECHNIQUES}
          profile={
            actor && actor.techniques.length > 0
              ? { name: actor.name, techniques: new Set(actor.techniques.map(techniqueKey)) }
              : undefined
          }
          onApply={(attack_techniques) => set({ attack_techniques })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
