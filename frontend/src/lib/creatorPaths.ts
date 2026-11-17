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
