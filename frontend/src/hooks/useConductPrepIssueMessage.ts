import { useTranslation } from 'react-i18next'

import { codeRefText } from '../lib/codeRef'
import type { ConductPrepDraft } from '../lib/conductPrep'
import { rowId } from '../lib/conductPrep'
import type { IssueMessage } from '../lib/issueGroups'
import type { ConductPrep, ValidationIssue } from '../lib/types'
import { objectiveName } from '../lib/needsForm'

/** Turns a conduct prep validation issue into a sentence ("OBJ-02 | ...:
 * assign an evaluator."). Rows are found by the id the report names them
 * by; labels come from lookup maps, since `code`, `field` and `item_id`
 * are plain backend strings. */
export function useConductPrepIssueMessage(
  prep: ConductPrep,
  draft: ConductPrepDraft,
): IssueMessage {
  const { t } = useTranslation()
  const fieldLabels = t('creator.conductPrep.fields', { returnObjects: true }) as Record<
    string,
    string
  >
  const messages = t('creator.conductPrep.validation', { returnObjects: true }) as Record<
    string,
    string
  >

  function itemLabel(id: string | null): string {
    if (!id) return ''
    const eeg = prep.eeg.find((o) => o.id === id || o.objective_id === id)
    if (eeg) return codeRefText(eeg.code, objectiveName(eeg))
    for (const item of draft.eeg) {
      const index = item.points.findIndex((p) => rowId(p) === id)
      if (index >= 0) {
        const objective = prep.eeg.find((o) => o.id === item.id)
        const text = item.points[index].text.trim()
        return `${objective?.code ?? ''} · ${text.length > 60 ? `${text.slice(0, 57)}…` : text || t('creator.conductPrep.eeg.pointNumber', { number: index + 1 })}`
      }
    }
    const person = [...prep.context.exercise_evaluators, ...prep.context.exercise_controllers].find(
      (p) => p.user_id === id,
    )
    if (person) return person.full_name
    const attendee = draft.attendees.find((a) => rowId(a) === id)
    if (attendee) return attendee.name || t('creator.conductPrep.logistics.attendees.unnamed')
    const findingIndex = draft.findings.findIndex((f) => rowId(f) === id)
    if (findingIndex >= 0)
      return t('creator.conductPrep.validationStep.findingNumber', { number: findingIndex + 1 })
    return id
  }

  const message = (issue: ValidationIssue) => {
    const values: Record<string, string> = {
      field: issue.field ? (fieldLabels[issue.field] ?? issue.field) : '',
      item: itemLabel(issue.item_id),
      code: issue.code,
    }
    const template = messages[issue.code] ?? messages.unknown
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '')
  }
  return Object.assign(message, { item: (issue: ValidationIssue) => itemLabel(issue.item_id) })
}
