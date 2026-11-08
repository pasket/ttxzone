import { useTranslation } from 'react-i18next'

/** The evaluation plan step's guide, shown under its description while it
 * is open: what each of the step's three blocks is for -- what is
 * observed (the EEGs, where their points come from, the rating scale), who
 * observes it and how data is collected. Spans, since it sits inside the
 * description's text. */
export function EvaluationGuide() {
  const { t } = useTranslation()
  const section = (title: string, body: React.ReactNode) => (
    <span className="mt-3 block first:mt-0">
      <span className="block font-medium text-paper-ink dark:text-fg">{title}</span>
      {body}
    </span>
  )
  const sources = [
    ['sourceCriterion', t('creator.conductPrep.guide.evaluation.sourceCriterion')],
    ['sourceAction', t('creator.conductPrep.guide.evaluation.sourceAction')],
    ['sourceOwn', t('creator.conductPrep.guide.evaluation.sourceOwn')],
  ] as const
  const levels = [
    ['P', t('creator.conductPrep.guide.evaluation.levelP')],
    ['S', t('creator.conductPrep.guide.evaluation.levelS')],
    ['M', t('creator.conductPrep.guide.evaluation.levelM')],
    ['U', t('creator.conductPrep.guide.evaluation.levelU')],
  ] as const
  return (
    <span className="block border-l-2 border-panel-line pl-3">
      {section(
        t('creator.conductPrep.guide.evaluation.eegTitle'),
        <>
          <span className="mt-1 block">{t('creator.conductPrep.guide.evaluation.eegBody')}</span>
          <span className="mt-1 block">
            {t('creator.conductPrep.guide.evaluation.sourcesIntro')}
          </span>
          {sources.map(([key, text]) => (
            <span key={key} className="mt-0.5 flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{text}</span>
            </span>
          ))}
          <span className="mt-1 block">{t('creator.conductPrep.guide.evaluation.scaleIntro')}</span>
          {levels.map(([level, text]) => (
            <span key={level} className="mt-0.5 flex gap-2">
              <span className="w-3 shrink-0 font-mono font-semibold">{level}</span>
              <span>{text}</span>
            </span>
          ))}
          <span className="mt-1 block">
            {t('creator.conductPrep.guide.evaluation.scaleAdjust')}
          </span>
        </>,
      )}
      {section(
        t('creator.conductPrep.guide.evaluation.whoTitle'),
        <span className="mt-1 block">{t('creator.conductPrep.guide.evaluation.whoBody')}</span>,
      )}
      {section(
        t('creator.conductPrep.guide.evaluation.howTitle'),
        <span className="mt-1 block">{t('creator.conductPrep.guide.evaluation.howBody')}</span>,
      )}
      {section(
        t('creator.conductPrep.guide.evaluation.resultTitle'),
        <span className="mt-1 block">{t('creator.conductPrep.guide.evaluation.resultBody')}</span>,
      )}
    </span>
  )
}
