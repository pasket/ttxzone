/** Creator -> Players and its tabs, on an exercise: the URL names the
 * exercise, so a link someone shares opens theirs, not whichever one the
 * reader had in context. Without an exercise, the short form, which
 * redirects to the one in context. */
export function playersPath(
  ttxId: string | null | undefined,
  tab?: 'pending' | 'invitations',
): string {
  const base = ttxId ? `/creator/${ttxId}/players` : '/creator/players'
  return tab ? `${base}/${tab}` : base
}

/** The documents an Exercise Program Manager reads of an exercise they
 * hold no seat on (Admin's read-only view), in the order they're written:
 * the section of the URL and its title. */
export const OVERSIGHT_DOCUMENTS = [
  ['exercise', 'creator.sections.exercise'],
  ['needs', 'creator.sections.needs'],
  ['msel', 'creator.sections.msel'],
  ['conduct-prep', 'creator.sections.conductPrep'],
  ['after-action', 'creator.sections.afterAction'],
] as const
