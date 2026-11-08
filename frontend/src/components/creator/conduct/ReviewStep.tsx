import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary } from '../../../lib/buttonStyles'
import { CONDUCT_STEPS, stepIssues } from '../../../lib/conductPrep'
import type { ConductPrep, ConductPrepStatus } from '../../../lib/types'
import { FieldGroup } from '../../common/FieldGroup'

/** The last step: where the plan stands, what each step still needs, and
 * the transition. Acts on the saved plan, so it waits for autosave. */
export function ReviewStep({
  prep,
  dirty,
  busy,
  readOnly,
  onTransition,
}: {
  prep: ConductPrep
  dirty: boolean
  busy: boolean
  readOnly: boolean
  onTransition: (to: ConductPrepStatus) => void
}) {
  const { t, i18n } = useTranslation()
  const blocking = prep.validation.ready
  const disabled = busy || dirty || readOnly
  const reason = readOnly
    ? t('creator.msel.review.readOnly')
    : dirty
      ? t('creator.msel.review.waitForSave')
      : null
  const muted = 'text-xs text-paper-ink/60 dark:text-fg-faint'

  return (
    <div className="space-y-5">
      <FieldGroup
        id="cp-review-steps-title"
        title={t('creator.conductPrep.review.stepsTitle')}
        hint={t('creator.conductPrep.review.stepsHint')}
      >
        <ul className="space-y-1.5 text-sm">
          {CONDUCT_STEPS.filter((s) => s.key !== 'review').map((s) => {
            const count = stepIssues(prep.validation, s.index).length
            return (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <span>
                  <span className="mr-1.5 tabular-nums text-paper-ink/60 dark:text-fg-faint">
                    {s.index}
                  </span>
                  {t(`creator.conductPrep.steps.${s.key}`)}
                </span>
                {count > 0 ? (
                  <span className="text-xs text-danger-fg">
                    {t('creator.msel.tabStatus.issues', { count })}
                  </span>
                ) : (
                  <span className="text-xs text-success-fg">
                    <span aria-hidden="true">✓ </span>
                    {t('creator.msel.tabStatus.complete')}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </FieldGroup>
      <FieldGroup
        id="cp-review-status-title"
        title={t('creator.msel.review.statusTitle')}
        hint={t('creator.conductPrep.review.statusHint')}
      >
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{t('creator.msel.review.status')}: </span>
            {t(`creator.conductPrep.status.${prep.status}`)} ·{' '}
            {t('creator.msel.version', { version: prep.version })}
          </p>
          {reason && <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{reason}</p>}
          <div className="flex flex-wrap gap-2">
            {prep.status === 'draft' ? (
              <button
                type="button"
                disabled={disabled || blocking.length > 0}
                onClick={() => onTransition('ready')}
                className={btnPrimary}
              >
                {t('creator.conductPrep.actions.markReady')}
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onTransition('draft')}
                className={btnSecondary}
              >
                {t('creator.msel.actions.backToDraft')}
              </button>
            )}
          </div>
          {prep.status === 'ready' && prep.ready_at ? (
            <p className={muted}>
              {t('creator.msel.review.readyBy', {
                name: prep.ready_by || t('creator.msel.validatedByUnknown'),
                date: new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(prep.ready_at)),
              })}
            </p>
          ) : prep.status === 'draft' && blocking.length > 0 ? (
            <p className={muted}>{t('creator.conductPrep.review.readyHint')}</p>
          ) : prep.status === 'draft' && !reason ? (
            <p className="text-xs text-success-fg" role="status">
              <span aria-hidden="true">✓ </span>
              {t('creator.conductPrep.review.readyOk')}
            </p>
          ) : null}
        </div>
      </FieldGroup>
    </div>
  )
}
