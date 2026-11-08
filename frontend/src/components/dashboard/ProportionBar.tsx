import { textPrimary, textSecondary } from './styles'

export interface ProportionSegment {
  key: string
  label: string
  value: number
  color: string
}

/** A single bar split by share of the whole, with every segment's count
 * and percentage spelled out underneath -- the number is always text,
 * the color only reinforces it. Caller renders an empty state for a zero
 * total. */
export function ProportionBar({
  segments,
  formatValue,
  formatShare,
  ariaLabel,
}: {
  segments: ProportionSegment[]
  formatValue: (value: number) => string
  formatShare: (share: number) => string
  ariaLabel: string
}) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0)
  return (
    <div className="flex flex-col gap-4">
      <div role="img" aria-label={ariaLabel} className="flex h-3 w-full gap-[2px]">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className="h-full first:rounded-l last:rounded-r"
              style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color }}
            />
          ))}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key} className="flex flex-col gap-0.5">
            <dt className={`flex items-center gap-1.5 text-xs ${textSecondary}`}>
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </dt>
            <dd className={`text-lg font-semibold tabular-nums ${textPrimary}`}>
              {formatValue(s.value)}
              <span className={`ml-1.5 text-xs font-normal ${textSecondary}`}>
                {formatShare(sum > 0 ? s.value / sum : 0)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
