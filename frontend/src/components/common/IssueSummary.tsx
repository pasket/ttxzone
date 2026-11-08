import { groupIssues, withoutItem, type IssueMessage } from '../../lib/issueGroups'
import type { ValidationIssue, ValidationReport } from '../../lib/types'
import { CodeText } from './CodeRef'
import { ScrollArea } from './ScrollArea'

export type { IssueMessage }

/** Several issues as a list, the ones about one row under its name and
 * count; `entry` renders one issue (with the text to show). */
function GroupedIssues({
  issues,
  message,
  listClass,
  headingClass,
  entry,
}: {
  issues: ValidationIssue[]
  message: IssueMessage
  listClass: string
  headingClass: string
  entry: (issue: ValidationIssue, text: string, index: number) => React.ReactNode
}) {
  return (
    <ul className={listClass}>
      {groupIssues(issues, message).map((group, index) =>
        group.issues.length === 1 ? (
          entry(group.issues[0], message(group.issues[0]), index)
        ) : (
          <li key={`${group.label}-${index}`}>
            <span className={headingClass}>
              <CodeText text={group.label ?? ''} /> ({group.issues.length})
            </span>
            <ul className="mt-0.5 space-y-0.5 pl-3">
              {group.issues.map((issue, inner) =>
                entry(issue, withoutItem(message(issue), group.label), inner),
              )}
            </ul>
          </li>
        ),
      )}
    </ul>
  )
}

export interface IssueTarget {
  section: number
  field: string | null
  itemId: string | null
  /** The issue's code, for pages that route some codes specially. */
  code?: string
}

export interface IssueSummaryLabels {
  title: string
  allClear: string
  /** Group titles: what `ready` and `approved` block, and warnings. */
  ready: string
  approved: string
  warnings: string
}

/** A validation report grouped by what it blocks -- live: while there are
 * unsaved changes it is the backend's dry run of the draft. Each entry is
 * a button that takes the user to the field (or opens the row) concerned.
 * Announced politely when it changes. Shared by the needs analysis and the
 * MSEL, which bring their own messages and group titles. */
export function IssueSummary({
  id,
  report,
  message,
  labels,
  onSelect,
}: {
  id: string
  report: ValidationReport
  message: IssueMessage
  labels: IssueSummaryLabels
  onSelect: (target: IssueTarget) => void
}) {
  const groups = [
    { key: 'ready', title: labels.ready, issues: report.ready },
    { key: 'approved', title: labels.approved, issues: report.approved },
    { key: 'warnings', title: labels.warnings, issues: report.warnings },
  ].filter((group) => group.issues.length > 0)

  return (
    <section aria-labelledby={id} className="rounded-sm border border-panel-line bg-panel p-4">
      <h2 id={id} className="text-balance text-sm font-semibold">
        {labels.title}
      </h2>
      {/* The aside is sticky: past a share of the screen, the list scrolls. */}
      <ScrollArea label={labels.title} maxClass="max-h-[45vh]" className="mt-2">
        <div aria-live="polite" className="space-y-3">
          {groups.length === 0 && (
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{labels.allClear}</p>
          )}
          {groups.map((group) => (
            <div key={group.key} className="space-y-1">
              <h3 className="text-balance text-xs font-medium text-paper-ink/60 dark:text-fg-faint">
                {group.title}
              </h3>
              <GroupedIssues
                issues={group.issues}
                message={message}
                listClass="space-y-1"
                headingClass="block text-xs font-medium text-paper-ink/80 dark:text-fg-muted"
                entry={(issue, text, index) => (
                  <li key={`${issue.code}-${issue.field}-${issue.item_id}-${index}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          section: issue.section,
                          field: issue.field,
                          itemId: issue.item_id,
                          code: issue.code,
                        })
                      }
                      className="flex w-full gap-1.5 rounded-xs text-left text-xs text-pretty text-paper-ink/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted"
                    >
                      <span
                        aria-hidden="true"
                        className={`shrink-0 ${
                          group.key === 'warnings' ? 'text-inactive-1' : 'text-danger-fg'
                        }`}
                      >
                        •
                      </span>
                      <span>
                        <CodeText text={text} />
                      </span>
                    </button>
                  </li>
                )}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}

/** A one-click way out of an issue, offered under it. */
export interface IssueFix {
  label: string
  onSelect: () => void
}

export interface SectionIssueTitles {
  /** The red box's heading, given the number of blocking issues. */
  blocking: (count: number) => string
  /** Warnings: worth reviewing, nothing blocks. */
  review: string
}

/** What the report says about the section on screen, at its top -- a
 * section count must explain itself where the user is looking. Two
 * boxes, by what they ask of the user: red, what blocks the next step;
 * amber, warnings worth reviewing. A page shows each warning in the
 * section where it can be fixed (never a note with nothing to do). Each
 * entry leads to its field or row, and may offer fixes. */
export function SectionIssueList({
  idPrefix,
  report,
  section,
  message,
  titles,
  fixes = () => [],
  onSelect,
}: {
  idPrefix: string
  report: ValidationReport
  section: number
  message: IssueMessage
  titles: SectionIssueTitles
  /** Ways to fix it right here (nothing changes until one is picked). */
  fixes?: (issue: ValidationIssue) => IssueFix[]
  onSelect: (target: IssueTarget) => void
}) {
  const blocking = [...report.ready, ...report.approved].filter(
    (issue) => issue.section === section,
  )
  const review = report.warnings.filter((issue) => issue.section === section)
  if (blocking.length === 0 && review.length === 0) return null

  const entry = (issue: ValidationIssue, text: string, index: number, tone: string) => {
    const ways = fixes(issue)
    return (
      <li key={`${issue.code}-${issue.field}-${issue.item_id}-${index}`}>
        <button
          type="button"
          onClick={() =>
            onSelect({ section, field: issue.field, itemId: issue.item_id, code: issue.code })
          }
          className={`text-left text-sm text-pretty hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${tone}`}
        >
          <CodeText text={text} />
        </button>
        {ways.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {ways.map((way) => (
              <button
                key={way.label}
                type="button"
                onClick={way.onSelect}
                className="rounded-xs text-left text-sm font-medium text-accent-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              >
                <CodeText text={way.label} />
              </button>
            ))}
          </span>
        )}
      </li>
    )
  }

  const box = (
    tier: 'blocking' | 'review',
    title: string,
    issues: ValidationIssue[],
    boxClass: string,
    markerClass: string,
    tone: string,
  ) => {
    if (issues.length === 0) return null
    const headingId = `${idPrefix}-section-issues-${section}-${tier}`
    return (
      <div
        role="status"
        aria-labelledby={headingId}
        className={`space-y-2 rounded-sm border p-4 ${boxClass}`}
      >
        <h3 id={headingId} className="text-balance text-sm font-semibold">
          {title}
        </h3>
        {/* Long lists scroll under the title (about four entries with
            their fixes in view), instead of pushing the section down. */}
        <ScrollArea label={title} maxClass="max-h-52">
          <GroupedIssues
            issues={issues}
            message={message}
            listClass={`list-disc space-y-1 pl-5 ${markerClass}`}
            headingClass={`text-sm font-medium ${tone}`}
            entry={(issue, text, index) => entry(issue, text, index, tone)}
          />
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-3">
      {box(
        'blocking',
        titles.blocking(blocking.length),
        blocking,
        'border-danger/40 bg-danger/5',
        'marker:text-danger-fg',
        'text-danger-fg',
      )}
      {box(
        'review',
        titles.review,
        review,
        'border-inactive-1/50 bg-inactive-1/5',
        'marker:text-inactive-1',
        'text-paper-ink dark:text-fg',
      )}
    </div>
  )
}
