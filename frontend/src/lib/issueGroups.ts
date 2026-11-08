import type { ValidationIssue } from './types'

/** An issue as a sentence; `item` names the row it's about ("PH-15 |
 * Detection"), so several issues about one row can be grouped under it. */
export type IssueMessage = ((issue: ValidationIssue) => string) & {
  item?: (issue: ValidationIssue) => string
}

interface IssueGroup {
  /** The row's name; null for an issue about no row. */
  label: string | null
  issues: ValidationIssue[]
}

/** Issues about the same row together, in the order the first of each
 * comes -- "PH-15 | Detection (2)" instead of two lines that both start
 * with it. */
export function groupIssues(issues: ValidationIssue[], message: IssueMessage): IssueGroup[] {
  const groups: IssueGroup[] = []
  const byItem = new Map<string, IssueGroup>()
  for (const issue of issues) {
    const label = issue.item_id && message.item ? message.item(issue) : ''
    if (!issue.item_id || !label) {
      groups.push({ label: null, issues: [issue] })
      continue
    }
    const group = byItem.get(issue.item_id)
    if (group) {
      group.issues.push(issue)
    } else {
      const created = { label, issues: [issue] }
      byItem.set(issue.item_id, created)
      groups.push(created)
    }
  }
  return groups
}

/** A grouped issue's line: its sentence without the row's name in front
 * (the group's heading says it). */
export function withoutItem(text: string, label: string | null): string {
  if (!label || !text.startsWith(label)) return text
  const rest = text.slice(label.length).replace(/^[\s:,]+/, '')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
