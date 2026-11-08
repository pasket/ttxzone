import { useTranslation } from 'react-i18next'

const muted = 'text-paper-ink/60 dark:text-fg-faint'

/** An objective's rating: the common scale's boxes to tick, each beside
 * what that outcome means for this objective -- P or S achieved (the rule
 * its conditions make, and a note), M partially, U not achieved. A level
 * left blank reads the common definition, muted. Shared by the EEG and
 * the objective dialog's evaluator view. */
export function RatingLevels({
  conditions,
  achieveAtLeast,
  achievedNote = '',
  partiallyAchieved = '',
  notAchieved = '',
}: {
  conditions: number
  achieveAtLeast?: number | null
  achievedNote?: string
  partiallyAchieved?: string
  notAchieved?: string
}) {
  const { t } = useTranslation()
  const rule =
    conditions === 0
      ? ''
      : achieveAtLeast && achieveAtLeast < conditions
        ? t('creator.needs.measure.atLeast', { k: achieveAtLeast, n: conditions })
        : conditions === 1
          ? t('creator.needs.measure.one')
          : t('creator.needs.measure.all', { n: conditions })
  const rows: { boxes: ('P' | 'S' | 'M' | 'U')[]; level: string; lines: string[] }[] = [
    {
      boxes: ['P', 'S'],
      level: t('creator.needs.measure.levels.achieved'),
      lines: [rule, achievedNote.trim()].filter(Boolean),
    },
    {
      boxes: ['M'],
      level: t('creator.needs.measure.levels.partial'),
      lines: [partiallyAchieved.trim()].filter(Boolean),
    },
    {
      boxes: ['U'],
      level: t('creator.needs.measure.levels.not'),
      lines: [notAchieved.trim()].filter(Boolean),
    },
  ]
  return (
    <div className="space-y-1.5">
      <h4 className="text-balance text-xs font-medium">{t('creator.needs.outputs.rating')}</h4>
      <ul className="divide-y divide-panel-line rounded-sm border border-panel-line text-sm">
        {rows.map((row) => (
          <li key={row.level} className="flex items-start gap-3 px-3 py-2">
            <span className="flex w-16 shrink-0 gap-1.5 pt-0.5">
              {row.boxes.map((box) => (
                <span
                  key={box}
                  translate="no"
                  title={t(`creator.needs.outputs.ratings.${box}`)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-xs border border-paper-line font-mono text-xs dark:border-line"
                >
                  {box}
                </span>
              ))}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block font-medium">{row.level}</span>
              {row.lines.length > 0 ? (
                row.lines.map((line, index) => (
                  <span key={index} className="block whitespace-pre-line text-pretty">
                    {line}
                  </span>
                ))
              ) : (
                <span className={`block text-xs ${muted}`}>
                  {t(`creator.needs.outputs.ratingDefinitions.${row.boxes[0]}`)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
