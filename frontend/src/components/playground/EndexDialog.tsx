import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { FormattedTextArea } from '../common/FormattedTextArea'
import { Modal } from '../common/Modal'

/** The closing message to the table (ENDEX), worded by default in the
 * exercise's content language (else the Controller's) and edited before
 * it goes out, with the same formatting as an inject's text. */
export function EndexDialog({
  language,
  pending,
  onClose,
  onSend,
}: {
  language?: string | null
  pending: boolean
  onClose: () => void
  onSend: (title: string, content: string) => void
}) {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  // The table reads it: in the language of the exercise's content.
  const forTable = i18n.getFixedT(language || i18n.language)
  const [title, setTitle] = useState(() => forTable('playground.control.endex.defaultTitle'))
  const [content, setContent] = useState(() => forTable('playground.control.endex.defaultContent'))
  return (
    <Modal titleId={titleId} onClose={onClose} size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSend(title.trim(), content.trim())
        }}
        className="space-y-3 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.control.endex.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.control.endex.description')}
        </p>
        <label htmlFor={`${titleId}-title`} className="block text-sm">
          {t('playground.control.endex.titleLabel')}
        </label>
        <input
          name={`${titleId}-title`}
          autoComplete="off"
          id={`${titleId}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          className={inputBase}
        />
        <label htmlFor={`${titleId}-content`} className="block text-sm">
          {t('playground.control.endex.contentLabel')}
        </label>
        <FormattedTextArea
          id={`${titleId}-content`}
          value={content}
          onChange={setContent}
          maxLength={4000}
          rows={8}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || !title.trim() || !content.trim()}
            className={btnPrimary}
          >
            {pending ? <ButtonSpinner /> : t('playground.control.endex.send')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
