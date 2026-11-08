import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { actionsCellClass, btnSecondary } from '../../../lib/buttonStyles'
import { fieldDomId, newRowKey, type RiskDraft } from '../../../lib/needsForm'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../../lib/panelStyles'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { Field, TextArea, TextInput } from './fields'
import { RiskLibraryDialog } from './NeedsLibraryPicker'
import { RowDialog } from './RowDialog'
import type { StepProps } from './stepProps'

/** Section 8 -- risks to the exercise itself, and the stop-exercise
 * keyword the facilitator will use if a real incident starts. */
export function RisksStep({ draft, update, removeRow, isInvalid, focusRow }: StepProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<{ risk: RiskDraft; isNew: boolean } | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const [handledRow, setHandledRow] = useState<StepProps['focusRow']>(null)
  if (focusRow && focusRow !== handledRow) {
    setHandledRow(focusRow)
    const risk = draft.risks.find((r) => r.key === focusRow.itemId)
    if (risk) {
      setEditing({ risk, isNew: false })
      setFocusField(fieldDomId(risk.risk.trim() ? 'mitigation' : 'risk', risk.key))
    }
  }

  function save(risk: RiskDraft) {
    update({
      risks: draft.risks.some((r) => r.key === risk.key)
        ? // Keep the id (and code) a save may have given the row meanwhile.
          draft.risks.map((r) => (r.key === risk.key ? { ...risk, id: r.id ?? risk.id } : r))
        : [...draft.risks, risk],
    })
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Field
          id={fieldDomId('stop_exercise_keyword')}
          label={t('creator.needs.fields.stop_exercise_keyword')}
          hint={t('creator.needs.hints.stop_exercise_keyword')}
        >
          <TextInput
            id={fieldDomId('stop_exercise_keyword')}
            value={draft.stop_exercise_keyword}
            maxLength={64}
            hint
            spellCheck={false}
            placeholder={t('creator.needs.placeholders.stop_exercise_keyword')}
            invalid={isInvalid('stop_exercise_keyword')}
            onChange={(stop_exercise_keyword) => update({ stop_exercise_keyword })}
          />
        </Field>
      </div>
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setLibraryOpen(true)} className={btnSecondary}>
            {t('creator.needs.library.addFromLibrary')}
          </button>
          <button
            type="button"
            onClick={() => {
              setFocusField(null)
              setEditing({
                risk: { id: null, key: newRowKey(), risk: '', mitigation: '', owner: '' },
                isNew: true,
              })
            }}
            className={btnSecondary}
          >
            <span aria-hidden="true">+ </span>
            {t('creator.needs.actions.addRisk')}
          </button>
        </div>
        {draft.risks.length === 0 ? (
          <p className="py-8 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.needs.table.noRisks')}
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('creator.needs.fields.risk')}</th>
                  <th className={panelTh}>{t('creator.needs.fields.mitigation')}</th>
                  <th className={panelTh}>{t('creator.needs.fields.owner')}</th>
                  <th className={panelActionsTh}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {draft.risks.map((risk) => {
                  const invalid = isInvalid('risks', risk.key)
                  return (
                    <tr key={risk.key} className={panelTr}>
                      <td className={`${panelTd} text-sm ${invalid ? 'text-danger-fg' : ''}`}>
                        {risk.risk || '—'}
                      </td>
                      <td className={`${panelTd} text-sm`}>{risk.mitigation || '—'}</td>
                      <td className={`${panelTd} text-sm`}>{risk.owner || '—'}</td>
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          <EditButton
                            label={t('creator.needs.actions.editRisk')}
                            onClick={() => {
                              setFocusField(null)
                              setEditing({ risk, isNew: false })
                            }}
                          />
                          <IconButton
                            label={t('creator.needs.actions.removeRisk')}
                            onClick={() =>
                              removeRow('risks', risk.key, t('creator.needs.toast.riskRemoved'))
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {libraryOpen && (
        <RiskLibraryDialog
          existing={draft.risks.map((r) => r.risk)}
          onClose={() => setLibraryOpen(false)}
          onAdd={(rows) => {
            update({
              risks: [
                ...draft.risks,
                ...rows.map((row) => ({ id: null, key: newRowKey(), owner: '', ...row })),
              ],
            })
            setLibraryOpen(false)
          }}
        />
      )}
      {editing && (
        <RiskDialog
          initial={editing.risk}
          title={
            editing.isNew ? t('creator.needs.dialogs.newRisk') : t('creator.needs.dialogs.editRisk')
          }
          initialFocusId={focusField}
          // The dialog hands focus back to whatever opened it (the Add
          // button, a row, the storyline strip) without scrolling.
          onCancel={() => setEditing(null)}
          onDone={save}
        />
      )}
    </div>
  )
}

function RiskDialog({
  initial,
  title,
  initialFocusId,
  onCancel,
  onDone,
}: {
  initial: RiskDraft
  title: string
  initialFocusId: string | null
  onCancel: () => void
  onDone: (risk: RiskDraft) => void
}) {
  const { t } = useTranslation()
  const [risk, setRisk] = useState(initial)
  const id = (field: string) => fieldDomId(field, risk.key)
  return (
    <RowDialog
      titleId="needs-risk-dialog-title"
      title={title}
      initialFocusId={initialFocusId}
      onCancel={onCancel}
      onDone={() => onDone(risk)}
    >
      <Field id={id('risk')} label={t('creator.needs.fields.risk')}>
        <TextArea
          id={id('risk')}
          value={risk.risk}
          rows={2}
          onChange={(value) => setRisk({ ...risk, risk: value })}
        />
      </Field>
      <Field id={id('mitigation')} label={t('creator.needs.fields.mitigation')}>
        <TextArea
          id={id('mitigation')}
          value={risk.mitigation}
          rows={2}
          onChange={(mitigation) => setRisk({ ...risk, mitigation })}
        />
      </Field>
      <Field id={id('owner')} label={t('creator.needs.fields.owner')} optional>
        <TextInput
          id={id('owner')}
          value={risk.owner}
          maxLength={255}
          onChange={(owner) => setRisk({ ...risk, owner })}
        />
      </Field>
    </RowDialog>
  )
}
