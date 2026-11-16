import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { API_BASE } from '../../lib/api'
import { btnSecondary } from '../../lib/buttonStyles'
import type { TTXRead } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'

// Export kinds (dashes) and their names in the Session plan (underscores).
const SESSION_KINDS = [
  ['sitman', 'sitman'],
  ['facilitator-guide', 'facilitator_guide'],
  ['inject-cards', 'inject_cards'],
  ['eeg', 'eeg'],
  ['evaluation-plan', 'evaluation_plan'],
  ['feedback-form', 'feedback_form'],
] as const

const itemClass =
  'block rounded-xs px-3 py-2 text-sm font-medium hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** An exercise's documents as PDFs, for the Program Manager who oversees
 * it without a seat on its team: reading is theirs on every exercise of
 * the organization. A document that doesn't exist yet answers so (a
 * toast, through `useApiDownload`). */
export function ExerciseDocumentsDialog({
  exercise,
  onClose,
}: {
  exercise: TTXRead
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.slice(0, 2)
  const download = useApiDownload()
  const kinds = t('creator.conductPrep.documents.kinds', { returnObjects: true }) as Record<
    string,
    string
  >
  const base = `/ttx/${exercise.id}`
  const documents: [string, string][] = [
    [t('admin.exercises.documents.needs'), `${base}/needs-form/pdf?lang=${lang}`],
    // The MSEL and what's built on it exist once it has been started.
    ...(exercise.msel_status
      ? ([
          [t('admin.exercises.documents.msel'), `${base}/msel/export/msel.pdf?lang=${lang}`],
          ...SESSION_KINDS.map(
            ([kind, key]) =>
              [kinds[key], `${base}/conduct-prep/export/${kind}.pdf?lang=${lang}`] as [
                string,
                string,
              ],
          ),
        ] as [string, string][])
      : []),
    [t('admin.exercises.documents.report'), `${base}/aar/export.pdf?lang=${lang}`],
  ]

  return (
    <Modal titleId="exercise-documents-title" onClose={onClose}>
      <div className="w-full max-w-sm space-y-3">
        <h2
          id="exercise-documents-title"
          className="text-lg font-semibold text-paper-ink dark:text-fg"
        >
          {t('admin.exercises.documents.title')}
        </h2>
        <p className="text-sm">
          <CodeRef code={exercise.code} title={exercise.name} />
        </p>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('admin.exercises.documents.hint')}
        </p>
        <ul className="space-y-0.5">
          {documents.map(([label, path]) => (
            <li key={path}>
              <a
                href={`${API_BASE}${path}`}
                download
                onClick={download(path)}
                className={itemClass}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('admin.usersAndRoles.deleteClose')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
