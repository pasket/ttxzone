import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary, inputBase } from '../../../lib/buttonStyles'
import { attackKey, MAX_INJECT_TECHNIQUES } from '../../../lib/msel'
import type { AttackCatalog, AttackDomain, AttackRef, AttackTechnique } from '../../../lib/types'
import { lazyRow } from '../../../lib/panelStyles'
import { Modal } from '../../common/Modal'

const tacticButton =
  'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** Pick the scenario's ATT&CK techniques the way the matrix reads: first
 * the matrix (Enterprise / ICS), then a tactic, then its techniques and
 * sub-techniques. A search looks across every tactic of the matrix. Picks
 * are staged and applied together; a technique serving several tactics is
 * chosen per tactic, since for the report it matters which one it served.
 * A threat actor's profile holds techniques whatever the tactic: it passes
 * `keyOf` without the tactic, so a technique is picked once: a search
 * shows it once, with every tactic it serves. An inject
 * attributed to a threat actor passes its `profile`: two filters, both on
 * at first, then show only that actor's tactics (those its techniques
 * serve) and only its techniques -- MITRE only records documented uses,
 * so the user can widen either to the whole matrix. The Library's editor
 * of a threat actor passes the actor's own techniques as `profile` too, with
 * its `profileHelp`, so 40-odd picks aren't lost in the whole matrix. */
export function AttackPicker({
  catalog,
  selected,
  onApply,
  onClose,
  keyOf = attackKey,
  max = MAX_INJECT_TECHNIQUES,
  title,
  profile,
  profileHelp,
}: {
  catalog: AttackCatalog
  selected: AttackRef[]
  onApply: (next: AttackRef[]) => void
  onClose: () => void
  /** What makes two picks the same (default: domain, tactic, technique). */
  keyOf?: (ref: Pick<AttackRef, 'domain' | 'tactic_id' | 'technique_id'>) => string
  max?: number
  title?: string
  /** A threat actor's techniques ("domain|technique id") and its name. */
  profile?: { name: string; techniques: Set<string> }
  /** Replaces the help under the filters (default: the inject's). */
  profileHelp?: string
}) {
  const { t } = useTranslation()
  const [domain, setDomain] = useState<AttackDomain>(selected[0]?.domain ?? 'enterprise')
  const current = catalog.domains.find((d) => d.domain === domain) ?? catalog.domains[0]
  const [tacticId, setTacticId] = useState(() => {
    const chosen = selected.find((ref) => ref.domain === domain)?.tactic_id
    if (chosen) return chosen
    // Opened on an actor's profile: its first tactic with something in it.
    const inProfile = (id: string) => Boolean(profile?.techniques.has(`${current.domain}|${id}`))
    const withProfile = profile?.techniques.size
      ? current.tactics.find((tactic) =>
          current.techniques.some(
            (technique) =>
              technique.tactics.includes(tactic.id) &&
              (inProfile(technique.id) || (technique.parent ? inProfile(technique.parent) : false)),
          ),
        )
      : undefined
    return withProfile?.id ?? current.tactics[0]?.id ?? ''
  })
  const [query, setQuery] = useState('')
  const [staged, setStaged] = useState<AttackRef[]>(selected)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const hasProfile = Boolean(profile?.techniques.size)
  const [onlyTactics, setOnlyTactics] = useState(hasProfile)
  const [onlyTechniques, setOnlyTechniques] = useState(hasProfile)

  // A threat actor's profile picks a technique once, whatever the tactic.
  const byTechnique =
    keyOf({ domain, tactic_id: 'a', technique_id: 'x' }) ===
    keyOf({ domain, tactic_id: 'b', technique_id: 'x' })
  const stagedKeys = useMemo(() => new Set(staged.map(keyOf)), [staged, keyOf])
  const full = staged.length >= max
  const tacticNames = useMemo(
    () => new Map(current.tactics.map((tactic) => [tactic.id, tactic.name])),
    [current],
  )
  const byId = useMemo(
    () => new Map(current.techniques.map((technique) => [technique.id, technique])),
    [current],
  )
  const children = useMemo(() => {
    const map = new Map<string, AttackTechnique[]>()
    for (const technique of current.techniques) {
      if (technique.parent)
        map.set(technique.parent, [...(map.get(technique.parent) ?? []), technique])
    }
    return map
  }, [current])

  function refFor(technique: AttackTechnique, tactic: string): AttackRef {
    const parent = technique.parent ? byId.get(technique.parent) : undefined
    return {
      domain: current.domain,
      tactic_id: tactic,
      technique_id: technique.id,
      tactic_name: tacticNames.get(tactic) ?? tactic,
      technique_name: parent ? `${parent.name}: ${technique.name}` : technique.name,
    }
  }

  function toggle(ref: AttackRef) {
    const key = keyOf(ref)
    setStaged((previous) =>
      previous.some((item) => keyOf(item) === key)
        ? previous.filter((item) => keyOf(item) !== key)
        : [...previous, ref],
    )
  }

  function switchDomain(next: AttackDomain) {
    setDomain(next)
    setTacticId(catalog.domains.find((d) => d.domain === next)?.tactics[0]?.id ?? '')
    setQuery('')
  }

  const countFor = (tactic: string) =>
    staged.filter(
      (ref) =>
        ref.domain === current.domain &&
        (byTechnique
          ? Boolean(byId.get(ref.technique_id)?.tactics.includes(tactic))
          : ref.tactic_id === tactic),
    ).length

  const normalized = query.trim().toLowerCase()
  const inActor = (technique: AttackTechnique) =>
    Boolean(profile?.techniques.has(`${current.domain}|${technique.id}`))
  const techniqueShown = (technique: AttackTechnique, techniquesOnly = onlyTechniques) =>
    !techniquesOnly || !hasProfile || inActor(technique)
  // A tactic is the actor's when one of its techniques serves it.
  const actorTactic = (tactic: string) =>
    current.techniques.some((technique) => technique.tactics.includes(tactic) && inActor(technique))
  const tacticsShown = (tacticsOnly = onlyTactics) =>
    tacticsOnly && hasProfile
      ? current.tactics.filter((tactic) => actorTactic(tactic.id))
      : current.tactics

  // A tactic's rows while browsing: its top-level techniques, with their
  // sub-techniques under them. With only the actor's techniques, a
  // sub-technique of the actor's whose parent isn't stands on its own row.
  const browseRows = (tactic: string, techniquesOnly = onlyTechniques) =>
    current.techniques
      .filter(
        (technique) =>
          technique.tactics.includes(tactic) &&
          techniqueShown(technique, techniquesOnly) &&
          (!technique.parent ||
            (techniquesOnly && hasProfile && !inActor(byId.get(technique.parent) ?? technique))),
      )
      .sort((a, b) =>
        refFor(a, tactic).technique_name.localeCompare(refFor(b, tactic).technique_name),
      )
      .map((technique) => ({ technique, tactic }))

  // Keeps the open tactic one that has something to show.
  function setFilters(tacticsOnly: boolean, techniquesOnly: boolean) {
    setOnlyTactics(tacticsOnly)
    setOnlyTechniques(techniquesOnly)
    const shown = tacticsShown(tacticsOnly)
    const usable = (id: string) => browseRows(id, techniquesOnly).length > 0
    if (!shown.some((tactic) => tactic.id === tacticId) || !usable(tacticId)) {
      const first = shown.find((tactic) => usable(tactic.id))
      if (first) setTacticId(first.id)
    }
  }

  // Rows to show: (technique, tactic) pairs. Browsing: the open tactic's.
  // Searching: every match among the tactics shown, once per tactic -- or
  // once, under its first tactic, when picks are per technique.
  const searchRows = normalized
    ? tacticsShown().flatMap((tactic) =>
        current.techniques
          .filter(
            (technique) =>
              technique.tactics.includes(tactic.id) &&
              techniqueShown(technique) &&
              (technique.id.toLowerCase().includes(normalized) ||
                technique.name.toLowerCase().includes(normalized)),
          )
          .map((technique) => ({ technique, tactic: tactic.id })),
      )
    : []
  const seen = new Set<string>()
  const rows: { technique: AttackTechnique; tactic: string }[] = !normalized
    ? browseRows(tacticId)
    : byTechnique
      ? searchRows.filter(({ technique }) => !seen.has(technique.id) && seen.add(technique.id))
      : searchRows
  // The tactics a search result is listed under ("Initial Access · Persistence").
  const tacticsOf = (technique: AttackTechnique, tactic: string) =>
    byTechnique
      ? tacticsShown()
          .filter((tactic) => technique.tactics.includes(tactic.id))
          .map((tactic) => tactic.name)
          .join(' · ')
      : tacticNames.get(tactic)

  function checkbox(technique: AttackTechnique, tactic: string, nested = false) {
    const ref = refFor(technique, tactic)
    const checked = stagedKeys.has(keyOf(ref))
    const id = `attack-${current.domain}-${tactic}-${technique.id}`
    return (
      <label htmlFor={id} className={`flex items-start gap-2 py-1 text-sm ${nested ? 'pl-6' : ''}`}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={!checked && full}
          onChange={() => toggle(ref)}
          className="mt-0.5 accent-accent-fg"
        />
        <span>
          <span translate="no" className="font-mono text-xs text-paper-ink/60 dark:text-fg-faint">
            {technique.id}
          </span>{' '}
          {nested ? technique.name : ref.technique_name}
          {normalized && (
            <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
              {tacticsOf(technique, tactic)}
            </span>
          )}
        </span>
      </label>
    )
  }

  return (
    <Modal titleId="attack-picker-title" onClose={onClose} size="xl">
      <div className="space-y-1">
        <h2 id="attack-picker-title" className="text-balance text-lg font-semibold tracking-tight">
          {title ?? t('creator.msel.attack.picker.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.msel.attack.picker.intro', { version: catalog.version })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t('creator.msel.attack.picker.domain')}
          className="inline-flex rounded-sm border border-paper-line p-0.5 dark:border-line"
        >
          {catalog.domains.map((d) => (
            <button
              key={d.domain}
              type="button"
              aria-pressed={d.domain === current.domain}
              onClick={() => switchDomain(d.domain)}
              className={`rounded-xs px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                d.domain === current.domain
                  ? 'bg-paper-line font-medium dark:bg-line'
                  : 'text-paper-ink/60 hover:text-paper-ink dark:text-fg-muted dark:hover:text-fg'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
        <label htmlFor="attack-picker-search" className="sr-only">
          {t('creator.msel.attack.picker.search')}
        </label>
        <input
          id="attack-picker-search"
          name="attack-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('creator.msel.attack.picker.searchPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          className={`${inputBase} max-w-xs flex-1`}
        />
        {profile && hasProfile && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyTactics}
                onChange={(event) => setFilters(event.target.checked, onlyTechniques)}
                className="accent-accent-fg"
              />
              {t('creator.msel.attack.picker.onlyTactics', { name: profile.name })}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyTechniques}
                onChange={(event) => setFilters(onlyTactics, event.target.checked)}
                className="accent-accent-fg"
              />
              {t('creator.msel.attack.picker.onlyProfile', {
                name: profile.name,
                count: profile.techniques.size,
              })}
            </label>
          </div>
        )}
      </div>
      {profile && hasProfile && (
        <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
          {profileHelp ?? t('creator.msel.attack.picker.profileHelp', { name: profile.name })}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <nav aria-label={t('creator.msel.attack.picker.tactics')}>
          <ol className="max-h-[50vh] space-y-0.5 overflow-y-auto">
            {tacticsShown().map((tactic) => {
              const active = !normalized && tactic.id === tacticId
              const count = countFor(tactic.id)
              const available = browseRows(tactic.id).length
              return (
                <li key={tactic.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    // Nothing of the actor's to pick there.
                    disabled={available === 0}
                    onClick={() => {
                      setTacticId(tactic.id)
                      setQuery('')
                    }}
                    className={`${tacticButton} disabled:cursor-not-allowed disabled:text-paper-ink/35 dark:disabled:text-fg-disabled ${
                      active
                        ? 'bg-accent/10 font-semibold text-accent-fg'
                        : 'enabled:hover:bg-hover'
                    }`}
                  >
                    <span>
                      {tactic.name}
                      {onlyTechniques && hasProfile && (
                        <span className="ml-1 text-xs font-normal opacity-70">({available})</span>
                      )}
                    </span>
                    {count > 0 && (
                      <span className="rounded-xs bg-paper-line px-1.5 text-xs font-medium text-paper-ink dark:bg-line dark:text-fg">
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section
          aria-label={
            normalized ? t('creator.msel.attack.picker.results') : (tacticNames.get(tacticId) ?? '')
          }
          className="max-h-[50vh] overflow-y-auto rounded-sm border border-paper-line p-3 dark:border-line"
        >
          {rows.length === 0 ? (
            <p
              role="status"
              className="py-6 text-center text-sm text-paper-ink/70 dark:text-fg-muted"
            >
              {t('creator.msel.attack.picker.noResults', { query: query.trim() })}
            </p>
          ) : (
            <ul className="divide-y divide-paper-line dark:divide-line">
              {rows.map(({ technique, tactic }) => {
                const subs = normalized
                  ? []
                  : (children.get(technique.id) ?? []).filter(
                      (sub) => sub.tactics.includes(tactic) && techniqueShown(sub),
                    )
                const open =
                  expanded.has(technique.id) ||
                  subs.some((sub) => stagedKeys.has(keyOf(refFor(sub, tactic))))
                return (
                  <li key={`${tactic}-${technique.id}`} className={`py-1 ${lazyRow}`}>
                    <div className="flex items-start justify-between gap-2">
                      {checkbox(technique, tactic)}
                      {subs.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() =>
                            setExpanded((previous) => {
                              const next = new Set(previous)
                              if (next.has(technique.id)) next.delete(technique.id)
                              else next.add(technique.id)
                              return next
                            })
                          }
                          className="shrink-0 rounded-sm px-2 py-1 text-xs text-paper-ink/70 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted"
                        >
                          {t('creator.msel.attack.picker.subtechniques', { count: subs.length })}
                        </button>
                      )}
                    </div>
                    {open && subs.length > 0 && (
                      <div>
                        {subs.map((sub) => (
                          <div key={sub.id}>{checkbox(sub, tactic, true)}</div>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted" aria-live="polite">
          {t('creator.msel.attack.picker.selectedCount', { count: staged.length })}
          {full && ` · ${t('creator.msel.attack.picker.limit', { max })}`}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('creator.msel.attack.picker.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(staged)
              onClose()
            }}
            className={btnPrimary}
          >
            {t('creator.msel.attack.picker.apply')}
          </button>
        </div>
      </div>
      <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{catalog.copyright}</p>
    </Modal>
  )
}
