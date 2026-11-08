import { panelClass, skeletonClass, textFaint, textPrimary, textSecondary } from './styles'

export interface KpiItem {
  id: string
  label: string
  /** Already formatted for display (locale-aware). */
  value: string
  /** One line that gives the number its meaning ("3 created in the last
   * 30 days"), not a restatement of the label. */
  context?: string
}

/** The headline figures as ONE hairline-divided panel rather than a row
 * of identical cards. 2 columns on mobile, one per item from `lg:`. */
export function KpiStrip({ items, loading = false }: { items: KpiItem[]; loading?: boolean }) {
  return (
    <dl
      className={`${panelClass} grid grid-cols-2 divide-paper-line dark:divide-line lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:divide-x`}
      aria-busy={loading}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`flex flex-col gap-1 p-5 ${index % 2 === 1 ? 'border-l border-paper-line dark:border-line lg:border-l-0' : ''} ${index >= 2 ? 'border-t border-paper-line dark:border-line lg:border-t-0' : ''}`}
        >
          <dt className={`text-sm ${textSecondary}`}>{item.label}</dt>
          <dd className={`text-3xl font-semibold tabular-nums tracking-tight ${textPrimary}`}>
            {loading ? <span className={`${skeletonClass} block h-9 w-16`} /> : item.value}
          </dd>
          <dd className={`min-h-5 text-sm ${textFaint}`}>
            {loading ? <span className={`${skeletonClass} block h-4 w-32`} /> : item.context}
          </dd>
        </div>
      ))}
    </dl>
  )
}
