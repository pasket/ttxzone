import { useTranslation } from 'react-i18next'

import { useNeedsIssueMessage, type IssueRows } from '../../../hooks/useNeedsIssueMessage'
import type { NeedsFormStatus, ValidationReport } from '../../../lib/types'
import { IssueSummary, type IssueTarget } from '../../common/IssueSummary'

export type { IssueTarget }

/** The needs analysis's validation report, grouped by what it blocks (see
 * IssueSummary). */
export function ValidationSummary({
  report,
  rows,
  status,
  onSelect,
}: {
  report: ValidationReport
  /** No issues doesn't mean approved: say what's left. */
  status: NeedsFormStatus
  rows: IssueRows
  onSelect: (target: IssueTarget) => void
}) {
  const { t } = useTranslation()
  return (
    <IssueSummary
      id="needs-validation-title"
      report={report}
      message={useNeedsIssueMessage(rows)}
      labels={{
        title: t('creator.needs.summary.title'),
        allClear:
          status === 'approved'
            ? t('creator.needs.summary.allClearApproved')
            : status === 'ready_for_approval'
              ? t('creator.needs.summary.allClearReady')
              : t('creator.needs.summary.allClear'),
        ready: t('creator.needs.summary.toSubmit'),
        approved: t('creator.needs.summary.toApprove'),
        warnings: t('creator.needs.summary.warnings'),
      }}
      onSelect={onSelect}
    />
  )
}
