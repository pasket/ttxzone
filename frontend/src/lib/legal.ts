import type { LegalDocumentKind, LegalDocumentSummary } from './types'

/** Document kind -> i18n key of its title. */
export const LEGAL_TITLE_KEYS = {
  terms: 'legal.titles.terms',
  privacy: 'legal.titles.privacy',
} as const satisfies Record<LegalDocumentKind, string>

/** The checkbox label for what's published: one document or both. */
export function consentLabelKey(documents: { kind: LegalDocumentKind }[]) {
  const kinds = new Set(documents.map((document) => document.kind))
  if (kinds.has('terms') && kinds.has('privacy')) return 'legal.consent.both' as const
  return kinds.has('terms') ? ('legal.consent.terms' as const) : ('legal.consent.privacy' as const)
}

/** What a signup sends: the version of every published document. */
export function acceptedLegal(documents: LegalDocumentSummary[]) {
  return documents.map(({ kind, version }) => ({ kind, version }))
}
