import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IMPROVEMENT_STATUSES } from '../../lib/aar'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { AarObjective, ImprovementAction } from '../../lib/types'
import { FormattedTextArea } from '../common/FormattedTextArea'
import { Modal } from '../common/Modal'

const labelClass = 'block text-sm'

/** One improvement action: the area for improvement it addresses, what
 * will be done, who owns it (free text: often someone without an account),
 * by when and how it's going. Applied to the report, which saves itself. */
export function ActionDialog({
  initial,
  objectives,
  onClose,
  onSave,
}: {
  initial: ImprovementAction
  objectives: AarObjective[]
  onClose: () => void
  onSave: (action: ImprovementAction) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [action, setAction] = useState(initial)
  const set = (change: Partial<ImprovementAction>) => setAction((a) => ({ ...a, ...change }))
  const id = (key: string) => `${titleId}-${key}`

  return (
    <Modal titleId={titleId} onClose={onClose} size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave(action)
        }}
        className="space-y-4 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {action.code ? t('aar.editAction', { code: action.code }) : t('aar.addAction')}
        </h2>
        <div className="space-y-1.5">
          <label htmlFor={id('objective')} className={labelClass}>
            {t('aar.actionFields.objective')}
          </label>
          <select
            id={id('objective')}
            value={action.objective_code ?? ''}
            onChange={(e) => set({ objective_code: e.target.value || null })}
            className={inputBase}
          >
            <option value="">{t('aar.actionFields.noObjective')}</option>
            {objectives.map((o) => (
              <option key={o.objective_code} value={o.objective_code}>
                {o.objective_code} | {o.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id('finding')} className={labelClass}>
            {t('aar.actionFields.finding')}
          </label>
          <FormattedTextArea
            id={id('finding')}
            value={action.finding}
            onChange={(finding) => set({ finding })}
            rows={3}
            maxLength={20000}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id('action')} className={labelClass}>
            {t('aar.actionFields.action')}
          </label>
          <FormattedTextArea
            id={id('action')}
            value={action.action}
            onChange={(value) => set({ action: value })}
            rows={3}
            maxLength={20000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={id('owner')} className={labelClass}>
              {t('aar.actionFields.owner')}
            </label>
            <input
              name={id('owner')}
              autoComplete="off"
              id={id('owner')}
              value={action.owner}
              maxLength={255}
              onChange={(e) => set({ owner: e.target.value })}
              className={inputBase}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id('area')} className={labelClass}>
              {t('aar.actionFields.area')}
            </label>
            <input
              name={id('area')}
              autoComplete="off"
              id={id('area')}
              value={action.owner_area}
              maxLength={255}
              onChange={(e) => set({ owner_area: e.target.value })}
              className={inputBase}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id('due')} className={labelClass}>
              {t('aar.actionFields.due')}
            </label>
            <input
              name={id('due')}
              autoComplete="off"
              id={id('due')}
              type="date"
              value={action.due_date ?? ''}
              onChange={(e) => set({ due_date: e.target.value || null })}
              className={inputBase}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={id('status')} className={labelClass}>
              {t('aar.actionFields.status')}
            </label>
            <select
              id={id('status')}
              value={action.status}
              onChange={(e) => set({ status: e.target.value as ImprovementAction['status'] })}
              className={inputBase}
            >
              {IMPROVEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`aar.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id('note')} className={labelClass}>
            {t('aar.actionFields.note')}
          </label>
          <input
            name={id('note')}
            autoComplete="off"
            id={id('note')}
            value={action.status_note}
            maxLength={1000}
            onChange={(e) => set({ status_note: e.target.value })}
            className={inputBase}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('aar.cancel')}
          </button>
          <button
            type="submit"
            disabled={!action.action.trim() && !action.finding.trim()}
            className={btnPrimary}
          >
            {t('aar.apply')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
