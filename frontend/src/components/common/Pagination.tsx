import { useTranslation } from 'react-i18next'

import { btnSecondary } from '../../lib/buttonStyles'

/** Prev/Next + "Page X of Y" for a server-paginated list. Renders nothing
 * once everything fits on one page -- no point showing dead controls. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={btnSecondary}
      >
        {t('common.pagination.previous')}
      </button>
      <span className="text-sm tabular-nums text-paper-ink/60 dark:text-fg-muted">
        {t('common.pagination.pageOf', { page, totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={btnSecondary}
      >
        {t('common.pagination.next')}
      </button>
    </div>
  )
}
