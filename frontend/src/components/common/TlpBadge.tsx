import { useTranslation } from 'react-i18next'

import type { Tlp } from '../../lib/types'

const TEXT_CLASS: Record<Tlp, string> = {
  clear: 'text-tlp-clear',
  green: 'text-tlp-green',
  amber: 'text-tlp-amber',
  amber_strict: 'text-tlp-amber',
  red: 'text-tlp-red',
}

const LABEL_KEYS = {
  clear: 'creator.needs.tlp.clear',
  green: 'creator.needs.tlp.green',
  amber: 'creator.needs.tlp.amber',
  amber_strict: 'creator.needs.tlp.amber_strict',
  red: 'creator.needs.tlp.red',
} as const

/** A document's TLP classification label, drawn the way the FIRST TLP 2.0
 * standard prescribes: coloured monospace text on black. The label text
 * (TLP:AMBER) carries the meaning, so it reads without colour too. */
export function TlpBadge({ tlp }: { tlp: Tlp }) {
  const { t } = useTranslation()
  return (
    <span
      translate="no"
      className={`inline-flex h-6 shrink-0 items-center rounded-xs border border-paper-line bg-black px-2 font-mono text-xs font-semibold tracking-wide dark:border-line ${TEXT_CLASS[tlp]}`}
    >
      {t(LABEL_KEYS[tlp])}
    </span>
  )
}
