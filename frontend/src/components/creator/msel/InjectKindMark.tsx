import { useTranslation } from 'react-i18next'

import type { InjectKind } from '../../../lib/types'

/** An inject's kind as the storyline map draws it: a diamond, in the
 * accent for a mandatory inject (a stop on the storyline), in the branch
 * colour for a contingent one. The word on hover and for screen readers
 * unless `decorative` (when a label next to it says it, as in the map's
 * legend). */
export function InjectKindMark({
  kind,
  decorative = false,
}: {
  kind: InjectKind
  decorative?: boolean
}) {
  const { t } = useTranslation()
  const shape = `h-2 w-2 rotate-45 rounded-[2px] ${kind === 'mandatory' ? 'bg-accent' : 'bg-chart-2'}`
  if (decorative) return <span aria-hidden="true" className={`inline-block shrink-0 ${shape}`} />
  const label = t(`creator.msel.kinds.${kind}`)
  return (
    <span title={label} className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <span aria-hidden="true" className={`inline-block ${shape}`} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
