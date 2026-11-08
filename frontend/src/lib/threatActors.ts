import type {
  ActorOrigin,
  AttackCatalog,
  AttackDomain,
  AttackRef,
  MselThreatActor,
  OrganizationThreatActor,
  SystemThreatActor,
  ThreatActorTechnique,
} from './types'

/** Techniques a threat actor may hold (the backend's
 * MAX_THREAT_ACTOR_TECHNIQUES). */
export const MAX_THREAT_ACTOR_TECHNIQUES = 400

/** What a threat actor is, at any level of the library: what the form
 * edits and what a copy carries over (plus where it came from). */
export interface ThreatActorFields {
  name: string
  /** The MITRE ATT&CK group it is ("G0007"), or null for an unknown actor. */
  mitre_group_id: string | null
  aliases: string[]
  description: string
  /** The ATT&CK release `techniques` belong to. */
  attack_version: string
  techniques: ThreatActorTechnique[]
  origin: ActorOrigin | null
  origin_id: string | null
  origin_name: string | null
}

export function emptyThreatActor(attackVersion: string): ThreatActorFields {
  return {
    name: '',
    mitre_group_id: null,
    aliases: [],
    description: '',
    attack_version: attackVersion,
    techniques: [],
    origin: null,
    origin_id: null,
    origin_name: null,
  }
}

/** A copy of a MITRE group from TTX-Zone's catalog. */
export function fromSystem(group: SystemThreatActor, attackVersion: string): ThreatActorFields {
  return {
    name: group.name,
    mitre_group_id: group.id,
    aliases: group.aliases,
    description: '',
    attack_version: attackVersion,
    techniques: group.techniques,
    origin: 'system',
    origin_id: group.id,
    origin_name: group.name,
  }
}

/** What copying a MITRE group into the library or a scenario starts from:
 * the group without its techniques. MITRE's documented ones are the
 * picker's filter, and the Planner ticks those the scenario uses. */
export function copyOfSystem(group: SystemThreatActor, attackVersion: string): ThreatActorFields {
  return { ...fromSystem(group, attackVersion), techniques: [] }
}

export function fromOrganization(actor: OrganizationThreatActor): ThreatActorFields {
  return {
    ...editValues(actor),
    origin: 'organization',
    origin_id: actor.id,
    origin_name: actor.name,
  }
}

/** An organization threat actor as its form edits it. */
export function editValues(actor: OrganizationThreatActor): ThreatActorFields {
  return {
    name: actor.name,
    mitre_group_id: actor.mitre_group_id,
    aliases: actor.aliases,
    description: actor.description,
    attack_version: actor.attack_version,
    techniques: actor.techniques.map(({ domain, technique_id }) => ({ domain, technique_id })),
    origin: actor.origin,
    origin_id: actor.origin_id,
    origin_name: actor.origin_name,
  }
}

/** A scenario's threat actor saved to the organization's library as it is
 * (no `_copy`), pinned to the MSEL's ATT&CK release. */
export function fromExerciseThreatActor(
  actor: MselThreatActor,
  attackVersion: string,
): ThreatActorFields {
  return {
    name: actor.name,
    mitre_group_id: actor.mitre_group_id,
    aliases: actor.aliases,
    description: actor.description,
    attack_version: attackVersion,
    techniques: actor.techniques.map(({ domain, technique_id }) => ({ domain, technique_id })),
    origin: 'exercise',
    origin_id: actor.id,
    origin_name: actor.name,
  }
}

/** A duplicate: `_copy` suffixed, so it never reads as the original. */
export function asDuplicate(fields: ThreatActorFields): ThreatActorFields {
  return { ...fields, name: `${fields.name}_copy` }
}

/** attack.mitre.org's permanent page for a group in that release. */
export function groupUrl(version: string, groupId: string): string {
  return `https://attack.mitre.org/versions/v${version.split('.')[0]}/groups/${groupId}/`
}

/** Two picks of a threat actor's profile are the same technique whatever
 * the tactic. */
export function techniqueKey(ref: Pick<AttackRef, 'domain' | 'technique_id'>): string {
  return `${ref.domain}|${ref.technique_id}`
}

/** Whether a group matches a search: its id, name or associated groups. */
export function matchesGroup(group: SystemThreatActor, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [group.id, group.name, ...group.aliases].some((text) => text.toLowerCase().includes(q))
}

export interface TacticGroup {
  key: string
  domain: AttackDomain
  domainName: string
  tacticName: string
  techniques: { id: string; name: string }[]
}

/** A profile's techniques under each tactic they serve, matrix by matrix
 * in matrix order (a technique serving two tactics shows under both). */
export function techniquesByTactic(
  techniques: ThreatActorTechnique[],
  catalog: AttackCatalog,
): TacticGroup[] {
  const wanted = new Set(techniques.map(techniqueKey))
  return catalog.domains.flatMap((domain) => {
    const byId = new Map(domain.techniques.map((technique) => [technique.id, technique]))
    const name = (id: string) => {
      const technique = byId.get(id)
      const parent = technique?.parent ? byId.get(technique.parent) : undefined
      return parent ? `${parent.name}: ${technique!.name}` : (technique?.name ?? id)
    }
    return domain.tactics
      .map((tactic) => ({
        key: `${domain.domain}|${tactic.id}`,
        domain: domain.domain,
        domainName: domain.name,
        tacticName: tactic.name,
        techniques: domain.techniques
          .filter(
            (technique) =>
              technique.tactics.includes(tactic.id) &&
              wanted.has(techniqueKey({ domain: domain.domain, technique_id: technique.id })),
          )
          .map((technique) => ({ id: technique.id, name: name(technique.id) })),
      }))
      .filter((group) => group.techniques.length > 0)
  })
}

/** A profile as picker refs: each technique under its first tactic (the
 * picker keys them by technique, so the tactic doesn't matter). */
export function asPickerRefs(
  techniques: ThreatActorTechnique[],
  catalog: AttackCatalog,
): AttackRef[] {
  return techniques.flatMap((t) => {
    const domain = catalog.domains.find((d) => d.domain === t.domain)
    const technique = domain?.techniques.find((x) => x.id === t.technique_id)
    const tactic = technique?.tactics[0]
    if (!domain || !technique || !tactic) return []
    return [
      {
        domain: t.domain,
        tactic_id: tactic,
        technique_id: t.technique_id,
        tactic_name: domain.tactics.find((x) => x.id === tactic)?.name ?? tactic,
        technique_name: technique.name,
      },
    ]
  })
}
