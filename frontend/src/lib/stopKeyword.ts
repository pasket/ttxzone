/** The stop keyword as it's compared, here and on the server
 * (`fold_stop_keyword`): without case, accents or spare spaces. It's
 * typed in an emergency, maybe on a phone: "pinzon de hierro" is
 * "PINZÓN DE HIERRO". */
export function foldStopKeyword(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}
