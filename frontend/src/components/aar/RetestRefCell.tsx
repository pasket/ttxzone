import { useTranslation } from 'react-i18next'

import type { RetestRef } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'

/** Where an improvement action is re-tested: the later exercise and, under
 * it, its objective (or "the whole exercise"); a dash when unlinked. */
export function RetestRefCell({ retest }: { retest: RetestRef | null | undefined }) {
  const { t } = useTranslation()
  if (!retest) return <span>—</span>
  return (
    <>
      <CodeRef code={retest.ttx_code} title={retest.ttx_name} wrap />
      <span className="block text-xs text-paper-ink/70 dark:text-fg-muted">
        {retest.objective_code ? (
          <CodeRef code={retest.objective_code} title={retest.objective_title ?? ''} wrap />
        ) : (
          t('aar.retest.wholeExercise')
        )}
      </span>
    </>
  )
}
