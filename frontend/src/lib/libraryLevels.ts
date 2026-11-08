/** The three levels of every library (simulated actors, injects,
 * tags): TTX-Zone's read-only catalog, the organization's own, and the
 * exercise in context. */
export type LibraryLevel = 'system' | 'organization' | 'exercise'

/** The levels a library page offers: the exercise only with one in
 * context (Creator), never in Admin. */
export function libraryLevels(withExercise: boolean): LibraryLevel[] {
  return withExercise ? ['system', 'organization', 'exercise'] : ['system', 'organization']
}

/** What a library page lets its reader do. The organization's library is
 * managed only by its Program Managers, in Admin: they create, edit,
 * delete and duplicate into it. Exercise Planners, in Creator, only use
 * it -- TTX-Zone and organization items are copied to the exercise in
 * context, never to the organization (nor an exercise into itself). */
export type LibraryPermissions = {
  /** New / Edit / Delete / Re-enable on the organization level. */
  manageOrganization: boolean
  /** Duplicate -> to my organization. */
  toOrganization: boolean
  /** Duplicate -> to this exercise (still needs an exercise in context). */
  toExercise: boolean
  /** Save an exercise's actor to the organization's library: in Creator,
   * for an Exercise Planner who is also a Program Manager of the
   * organization (the one way an exercise item goes back to it). */
  saveToOrganization: boolean
}

export function libraryPermissions(
  withExercise: boolean,
  programManager = false,
): LibraryPermissions {
  return withExercise
    ? {
        manageOrganization: false,
        toOrganization: false,
        toExercise: true,
        saveToOrganization: programManager,
      }
    : {
        manageOrganization: true,
        toOrganization: true,
        toExercise: false,
        saveToOrganization: false,
      }
}

/** What the Library holds, in tab order (tags last: they label the
 * rest); each kind has its own path under `library/` (the first none). */
export type LibraryKind = 'actors' | 'threats' | 'injects' | 'tags' | 'scenarios'
export const LIBRARY_KINDS: LibraryKind[] = ['actors', 'threats', 'injects', 'scenarios', 'tags']

/** The Library's sub-pages, each a route of its own under `library/` (the
 * first kind, actors, lives at the root). Derived, so a new kind gets its
 * route. */
export const LIBRARY_SUB_KINDS = LIBRARY_KINDS.slice(1)

/** A library table's empty or status row. */
export const libraryEmptyClass =
  'px-5 py-8 text-center text-sm text-paper-ink/70 dark:text-fg-muted'
