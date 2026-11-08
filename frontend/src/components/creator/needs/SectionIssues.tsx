import { useTranslation } from 'react-i18next'

import { useNeedsIssueMessage, type IssueRows } from '../../../hooks/useNeedsIssueMessage'
import type { ValidationIssue, ValidationReport } from '../../../lib/types'
import { SectionIssueList, type IssueFix, type IssueTarget } from '../../common/IssueSummary'

/** The needs-analysis section's own issues, at its top (see
 * SectionIssueList). Live: the report covers the unsaved draft too. */
export function SectionIssues({
  report,
  rows,
  section,
  fixes,
  onSelect,
}: {
  report: ValidationReport
  rows: IssueRows
  section: number
  /** Ways out of an issue -- above all where it's fixed in another
   * section ("Fixed in Objectives: …"). */
  fixes?: (issue: ValidationIssue) => IssueFix[]
  onSelect: (target: IssueTarget) => void
}) {
  const { t } = useTranslation()
  return (
    <SectionIssueList
      idPrefix="needs"
      report={report}
      section={section}
      message={useNeedsIssueMessage(rows)}
      titles={{
        blocking: (count) => t('creator.needs.sectionIssues.title', { count }),
        review: t('creator.needs.sectionIssues.review'),
      }}
      fixes={fixes}
      onSelect={onSelect}
    />
  )
}
