import { apiFetch } from './api'
import type {
  ActorOrigin,
  ActorType,
  DeliveryMethod,
  MselActor,
  OrganizationActor,
  SystemActor,
} from './types'

/** What an actor is, at any level of the library: what the forms edit and
 * what a copy carries over (plus where it came from). */
export interface ActorFields {
  name: string
  type: ActorType
  description: string
  channel: DeliveryMethod | null
  origin: ActorOrigin | null
  origin_id: string | null
  /** The original's name at copy time ("Copied from"). */
  origin_name: string | null
}

export function emptyActorFields(): ActorFields {
  return {
    name: '',
    type: 'other',
    description: '',
    channel: null,
    origin: null,
    origin_id: null,
    origin_name: null,
  }
}

/** A copy of a TTX-Zone actor, in the UI language. */
export function fromSystem(actor: SystemActor, spanish: boolean): ActorFields {
  return {
    name: spanish ? actor.name_es : actor.name_en,
    type: actor.type,
    description: spanish ? actor.description_es : actor.description_en,
    channel: actor.channel,
    origin: 'system',
    origin_id: actor.id,
    origin_name: spanish ? actor.name_es : actor.name_en,
  }
}

export function fromOrganization(actor: OrganizationActor): ActorFields {
  return {
    name: actor.name,
    type: actor.type,
    description: actor.description,
    channel: actor.channel,
    origin: 'organization',
    origin_id: actor.id,
    origin_name: actor.name,
  }
}

export function fromExercise(actor: MselActor): ActorFields {
  return {
    name: actor.name,
    type: actor.type,
    description: actor.description,
    channel: actor.channel,
    origin: 'exercise',
    origin_id: actor.id,
    origin_name: actor.name,
  }
}

/** A duplicate: the same actor under the `_copy` suffix, so it never
 * reads as the original. */
export function asDuplicate(fields: ActorFields): ActorFields {
  return { ...fields, name: `${fields.name}_copy` }
}

/** What an exercise actor becomes in the organization's library: the same
 * actor, not a duplicate (no `_copy`), copied from the exercise -- once
 * the exercise has saved it. */
export function toOrganizationLibrary(
  actor: Pick<MselActor, 'name' | 'type' | 'description' | 'channel'> & { id: string | null },
): ActorFields {
  return {
    name: actor.name,
    type: actor.type,
    description: actor.description,
    channel: actor.channel,
    origin: actor.id ? 'exercise' : null,
    origin_id: actor.id,
    origin_name: actor.id ? actor.name : null,
  }
}

/** Saves an exercise actor to the organization's library (its Program
 * Managers only: the server refuses anyone else) and returns the origin
 * that makes the exercise actor a copy of the new library actor -- so it
 * counts as a use, and isn't offered for saving again. */
export async function saveActorToOrganization(
  organizationId: string,
  actor: Parameters<typeof toOrganizationLibrary>[0],
): Promise<Pick<MselActor, 'origin' | 'origin_id' | 'origin_name'>> {
  const created = await apiFetch<OrganizationActor>(`/organizations/${organizationId}/actors`, {
    method: 'POST',
    body: JSON.stringify(toOrganizationLibrary(actor)),
  })
  return { origin: 'organization', origin_id: created.id, origin_name: created.name }
}
