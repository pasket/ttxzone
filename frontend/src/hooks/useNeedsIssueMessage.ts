import { useTranslation } from 'react-i18next'

import { codeRefText } from '../lib/codeRef'
import { needName, objectiveName } from '../lib/needsForm'
import type { IssueMessage } from '../lib/issueGroups'
import type { ValidationIssue } from '../lib/types'

/** The rows an issue can point at, by the key the report uses (the id of
 * a saved row, the temporary key of an unsaved one). */
export interface IssueRows {
  needs: { key: string; code: string; title: string; finding: string }[]
  objectives: { key: string; code: string; title?: string; statement: string }[]
  risks: { key: string }[]
  /** Regulatory frameworks by id, in the user's language. */
  frameworkLabels?: Record<string, string>
}

/** Turns a needs-form validation issue into a sentence ("Contain the
 * ransomware… (OBJ-01): Evidence to collect is missing."). Labels come from lookup maps, not dynamic
 * keys: `code`, `field` and `item_id` arrive from the backend as plain
 * strings. Shared by the validation summary and each section's own list. */
export function useNeedsIssueMessage(rows: IssueRows): IssueMessage {
  const { t } = useTranslation()
  const pending = t('creator.needs.table.pendingCode')
  const fieldLabels = t('creator.needs.fields', { returnObjects: true }) as Record<string, string>
  const messages = t('creator.needs.validation', { returnObjects: true }) as Record<string, string>
  const capabilityLabels = t('creator.needs.capabilities', { returnObjects: true }) as Record<
    string,
    string
  >
  const approverLabels = t('creator.needs.approverKinds', { returnObjects: true }) as Record<
    string,
    string
  >

  function itemLabel(issue: ValidationIssue): string {
    const id = issue.item_id
    if (!id) return ''
    // Named as the user knows them: the finding or statement first, the
    // code in brackets ("Contain the ransomware… (OBJ-01)").
    const need = rows.needs.find((n) => n.key === id)
    const objective = rows.objectives.find((o) => o.key === id)
    return (
      (need ? codeRefText(need.code, needName(need), pending) : undefined) ??
      (objective ? codeRefText(objective.code, objectiveName(objective), pending) : undefined) ??
      (rows.risks.some((risk) => risk.key === id) ? fieldLabels.risk : undefined) ??
      capabilityLabels[id] ??
      approverLabels[id] ??
      rows.frameworkLabels?.[id] ??
      id
    )
  }

  const message = (issue: ValidationIssue) => {
    const values = {
      field: issue.field ? (fieldLabels[issue.field] ?? issue.field) : '',
      item: itemLabel(issue),
      code: issue.code,
    }
    const template =
      (issue.code === 'NEEDS_FORM_INCOMPLETE' && issue.item_id
        ? messages.NEEDS_FORM_INCOMPLETE_item
        : messages[issue.code]) ?? messages.unknown
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: keyof typeof values) => values[key] ?? '')
  }
  return Object.assign(message, { item: itemLabel })
}
