/** What an action on several rows answered: the rows it was applied to,
 * and the ones it wasn't, each with the error it would have given on its
 * own, already in the reader's language. */
export interface BulkResult {
  done: string[]
  failed: { id: string; code: string; message: string }[]
}

/** The people an action is about, by name, for its confirmation: the
 * first few, then how many more. */
export function nameList(
  people: { full_name: string }[],
  t: (key: 'common.bulk.andMore', options: { count: number }) => string,
  shown = 6,
): string {
  const names = people.slice(0, shown).map((person) => person.full_name)
  const more = people.length - names.length
  return more > 0
    ? `${names.join(', ')} ${t('common.bulk.andMore', { count: more })}`
    : names.join(', ')
}
