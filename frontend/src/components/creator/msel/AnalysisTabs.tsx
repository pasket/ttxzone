import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { codeRefText } from '../../../lib/codeRef'
import { linkAccent } from '../../../lib/buttonStyles'
import {
  emptyInjectDraft,
  mselFieldId,
  injectDialogPatch,
  type InjectDraft,
} from '../../../lib/msel'
import { panelTableHeadRow, panelTbody, panelTd, panelTh } from '../../../lib/panelStyles'
import { CodeRef } from '../../common/CodeRef'
import { InjectDialog } from './InjectDialog'
import type { TabProps } from './tabProps'
import { objectiveName } from '../../../lib/needsForm'

const mutedClass = 'text-sm text-paper-ink/70 dark:text-fg-muted'

/** Tab 5 -- coverage: objectives × phases, with the injects and expected
 * actions that evaluate each objective. An objective no mandatory inject
 * covers is red (M03), with a way to fix it right here: a new mandatory
 * inject already linked to it (the validation summary focuses that
 * button); one with a single expected action, amber (M04). A real table,
 * so it's its own accessible fallback. */
export function CoverageTab({
  msel,
  draft,
  update,
  removeRow,
  catalog,
  readOnly,
  saveStatus,
}: TabProps) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState<InjectDraft | null>(null)
  const objectives = msel.needs.objectives
  // In the first phase that works on the objective, else the first one.
  const newInjectFor = (objectiveId: string) =>
    emptyInjectDraft(draft, {
      kind: 'mandatory',
      objective_ids: [objectiveId],
      phase_key:
        draft.phases.find((phase) => phase.objective_ids.includes(objectiveId))?.key ??
        draft.phases[0]?.key ??
        '',
    })
  const cell = (objectiveId: string, phaseKey: string | null) => {
    const injects = draft.injects.filter(
      (i) =>
        i.objective_ids.includes(objectiveId) && (phaseKey === null || i.phase_key === phaseKey),
    )
    return {
      injects: injects.length,
      // Only the actions that evidence it: those its EEG lists.
      actions: injects.reduce(
        (n, i) =>
          n + i.expected_actions.filter((a) => a.objective_ids.includes(objectiveId)).length,
        0,
      ),
    }
  }
  return (
    <div className="space-y-8">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('creator.msel.coverage.objective')}</th>
              {draft.phases.map((phase) => (
                <th key={phase.key} className={`${panelTh} font-normal`}>
                  <CodeRef
                    variant="stacked"
                    code={phase.code}
                    title={phase.name}
                    pending={t('creator.msel.table.pendingCode')}
                  />
                </th>
              ))}
              <th className={panelTh}>{t('creator.msel.coverage.total')}</th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {objectives.map((objective) => {
              const total = cell(objective.id, null)
              const covered = draft.injects.some(
                (i) => i.kind === 'mandatory' && i.objective_ids.includes(objective.id),
              )
              const state = !covered ? 'none' : total.actions < 2 ? 'few' : 'ok'
              const tone =
                state === 'none'
                  ? 'bg-danger/5 text-danger-fg'
                  : state === 'few'
                    ? 'bg-inactive-1/10'
                    : ''
              return (
                <tr key={objective.id} className={tone}>
                  <th scope="row" className={`${panelTd} text-left text-sm font-normal`}>
                    <CodeRef
                      variant="stacked"
                      code={objective.code}
                      title={objectiveName(objective)}
                      invalid={state === 'none'}
                    />
                    {state !== 'ok' && (
                      <span className="block text-xs">
                        {state === 'none'
                          ? t('creator.msel.coverage.notCovered')
                          : t('creator.msel.coverage.oneAction')}
                      </span>
                    )}
                    {state === 'none' && !readOnly && (
                      <span className="mt-1.5 block space-y-0.5">
                        <button
                          type="button"
                          id={mselFieldId('coverage', objective.id)}
                          onClick={() => setCreating(newInjectFor(objective.id))}
                          aria-label={t('creator.msel.coverage.addInjectLabel', {
                            objective: codeRefText(objective.code, objectiveName(objective)),
                          })}
                          className={`${linkAccent} text-xs font-medium`}
                        >
                          <span aria-hidden="true">+ </span>
                          {t('creator.msel.coverage.addInject')}
                        </button>
                        <span className="block text-xs text-paper-ink/70 dark:text-fg-muted">
                          {t('creator.msel.coverage.linkHint')}
                        </span>
                      </span>
                    )}
                  </th>
                  {draft.phases.map((phase) => {
                    const counts = cell(objective.id, phase.key)
                    return (
                      <td
                        key={phase.key}
                        className={`${panelTd} whitespace-nowrap font-mono text-xs tabular-nums`}
                        aria-label={t('creator.msel.coverage.cellLabel', {
                          objective: codeRefText(objective.code, objectiveName(objective)),
                          phase: codeRefText(phase.code, phase.name),
                          ...counts,
                        })}
                      >
                        {counts.injects ? t('creator.msel.coverage.cell', counts) : '—'}
                      </td>
                    )
                  })}
                  <td className={`${panelTd} whitespace-nowrap font-mono text-xs tabular-nums`}>
                    {t('creator.msel.coverage.cell', total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {creating && (
          <InjectDialog
            rooms={msel.uses_rooms ? (msel.rooms ?? []) : []}
            ttxId={msel.ttx_id}
            initial={creating}
            draft={draft}
            needs={msel.needs}
            catalog={catalog}
            readOnly={readOnly}
            isNew
            initialFocusId={null}
            saveStatus={saveStatus}
            onChange={(inject, newActors) => update(injectDialogPatch(draft, inject, newActors))}
            onDraftPatch={update}
            onClose={() => setCreating(null)}
            onDiscard={(inject) =>
              removeRow('injects', inject.key, t('creator.msel.wizard.discarded'))
            }
          />
        )}
      </div>
    </div>
  )
}

/** Section 6 -- load, in the Review tab: injects each recipient receives
 * per phase, to check before submitting that no area is swamped while
 * others wait. Nothing is edited here (injects are); an area the backend
 * flags (more than 3 injects within 10 minutes) is highlighted. */
export function LoadTable({ draft, report }: TabProps) {
  const { t } = useTranslation()
  const recipients = [...new Set(draft.injects.flatMap((i) => i.recipients))]
  if (recipients.length === 0) {
    return <p className={`py-8 text-center ${mutedClass}`}>{t('creator.msel.load.empty')}</p>
  }
  const overloaded = new Set(
    report.warnings.filter((i) => i.code === 'RECIPIENT_OVERLOAD').map((i) => i.item_id),
  )
  const count = (recipient: string, phaseKey: string | null) =>
    draft.injects.filter(
      (i) => i.recipients.includes(recipient) && (phaseKey === null || i.phase_key === phaseKey),
    ).length
  return (
    <div className="-mx-4 -mb-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={panelTableHeadRow}>
            <th className={panelTh}>{t('creator.msel.load.recipient')}</th>
            {draft.phases.map((phase) => (
              <th key={phase.key} className={`${panelTh} font-normal`}>
                <CodeRef
                  variant="stacked"
                  code={phase.code}
                  title={phase.name}
                  pending={t('creator.msel.table.pendingCode')}
                />
              </th>
            ))}
            <th className={panelTh}>{t('creator.msel.load.total')}</th>
          </tr>
        </thead>
        <tbody className={panelTbody}>
          {recipients.map((recipient) => (
            <tr key={recipient} className={overloaded.has(recipient) ? 'bg-inactive-1/10' : ''}>
              <th scope="row" className={`${panelTd} text-left text-sm font-normal`}>
                {recipient}
                {overloaded.has(recipient) && (
                  <span className="block text-xs">{t('creator.msel.load.overloaded')}</span>
                )}
              </th>
              {draft.phases.map((phase) => (
                <td key={phase.key} className={`${panelTd} font-mono text-sm tabular-nums`}>
                  {count(recipient, phase.key)}
                </td>
              ))}
              <td className={`${panelTd} font-mono text-sm tabular-nums`}>
                {count(recipient, null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
