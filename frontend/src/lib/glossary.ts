/** Acronyms the app's copy uses. Expansions and explanations live in
 * i18n (`glossary.terms.<TERM>`); this list drives both the inline
 * <abbr> marking (AcronymText) and the header's glossary panel. Matched
 * case-sensitively as whole words, so "it" or "ens" in prose never match. */
export const GLOSSARY_TERMS = [
  'TTX',
  'TLP',
  'AAR',
  'EEG',
  'EPM',
  'EPT',
  'SMART',
  'NIS2',
  'NCCS',
  'DORA',
  'GDPR',
  'RGPD',
  'CER',
  'FCA',
  'PRA',
  'SEC',
  'NYDFS',
  'HIPAA',
  'PCI DSS',
  'ENS',
  'IRP',
  'BCP',
  'IT',
  'OT',
  'CSIRT',
  'MSEL',
  'SitMan',
  'ATT&CK',
  'TTP',
] as const

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]

export function isGlossaryTerm(value: string): value is GlossaryTerm {
  return (GLOSSARY_TERMS as readonly string[]).includes(value)
}

// Longest first, so a longer term wins over a shorter one it contains.
// The product's name, TTX-Zone, is a brand, never the acronym TTX.
const PATTERN = new RegExp(
  `(?<![\\w])(${[...GLOSSARY_TERMS].sort((a, b) => b.length - a.length).join('|')})(?![\\w]|-Zone)`,
  'g',
)

/** Splits text into plain chunks and glossary terms, in order. */
export function splitAcronyms(text: string): (string | { term: GlossaryTerm })[] {
  const parts: (string | { term: GlossaryTerm })[] = []
  let last = 0
  for (const match of text.matchAll(PATTERN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push({ term: match[1] as GlossaryTerm })
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
