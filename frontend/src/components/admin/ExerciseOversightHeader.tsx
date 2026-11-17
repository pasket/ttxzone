import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { linkAccent } from '../../lib/buttonStyles'
import { OVERSIGHT_DOCUMENTS } from '../../lib/creatorPaths'
import type { TTXRead } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { PageTabs } from '../common/PageTabs'

/** Above each document of Admin's read-only view of an exercise: the way
 * back to the list, which exercise it is, why nothing can be changed and
 * how to change that, and the documents to read as tabs. The document
 * under it brings its own title. */
export function ExerciseOversightHeader({
  exercise,
  section,
}: {
  exercise: TTXRead
  section: string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4 p-6 pb-0">
      <Link to="/admin/exercises" className={`text-sm ${linkAccent}`}>
        <span aria-hidden="true">← </span>
        {t('admin.exerciseView.back')}
      </Link>
      <p className="text-sm">
        <CodeRef code={exercise.code} title={exercise.name} />
      </p>
      <p
        role="status"
        className="rounded-sm border border-paper-line bg-hover/40 p-3 text-sm text-pretty dark:border-line"
      >
        {t('admin.exerciseView.banner')}
      </p>
      <PageTabs
        label={t('admin.exerciseView.tabs')}
        items={OVERSIGHT_DOCUMENTS.map(([key, title]) => ({
          key,
          to: `/admin/exercises/${exercise.id}/${key}`,
          label: t(title),
          current: key === section,
        }))}
      />
    </div>
  )
}
