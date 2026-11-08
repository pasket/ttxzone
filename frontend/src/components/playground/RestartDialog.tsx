import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnDanger, btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

export type RestartMode = 'archive' | 'delete'

/** The control word typed to confirm (any case); the server checks it too. */
const CONTROL_WORD = 'restart'

/** Back to Not started once the session is over: keep this run as a
 * previous one and start a new run, or delete everything it recorded --
 * not offered once an after-action report was written from it. Typing the
 * control word confirms it (no step-up). */
export function RestartDialog({
  runNumber,
  canDelete,
  pending,
  onClose,
  onRestart,
}: {
  runNumber: number | null
  canDelete: boolean
  pending: boolean
  onClose: () => void
  onRestart: (mode: RestartMode, confirmation: string) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [mode, setMode] = useState<RestartMode>('archive')
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === CONTROL_WORD
  const options: { key: RestartMode; label: string; hint: string; disabled: boolean }[] = [
    {
      key: 'archive',
      label: t('playground.control.restartDialog.archive'),
      hint: t('playground.control.restartDialog.archiveHint', { number: runNumber ?? 1 }),
      disabled: false,
    },
    {
      key: 'delete',
      label: t('playground.control.restartDialog.delete'),
      hint: canDelete
        ? t('playground.control.restartDialog.deleteHint')
        : t('playground.control.restartDialog.deleteBlocked'),
      disabled: !canDelete,
    },
  ]
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (matches) onRestart(mode, typed)
        }}
        className="space-y-4 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.control.restartDialog.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.control.restartDialog.description')}
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('playground.control.restartDialog.title')}</legend>
          {options.map((option) => (
            <label
              key={option.key}
              className={`flex items-start gap-3 rounded-sm border p-3 text-sm ${
                mode === option.key ? 'border-accent' : 'border-panel-line'
              } ${option.disabled ? 'opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name={`${titleId}-mode`}
                value={option.key}
                checked={mode === option.key}
                disabled={option.disabled}
                onChange={() => setMode(option.key)}
                aria-describedby={`${titleId}-${option.key}`}
                className="mt-0.5 h-4 w-4 accent-accent-fg"
              />
              <span>
                <span className="font-semibold">{option.label}</span>
                <span
                  id={`${titleId}-${option.key}`}
                  className="block text-paper-ink/70 dark:text-fg-muted"
                >
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="space-y-1">
          <label htmlFor={`${titleId}-confirm`} className="block text-sm">
            {t('playground.control.restartDialog.typeToConfirm', { word: CONTROL_WORD })}
          </label>
          <input
            name={`${titleId}-confirm`}
            id={`${titleId}-confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`${CONTROL_WORD}…`}
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
            className={`${inputBase} font-mono`}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || !matches}
            className={mode === 'delete' ? btnDanger : btnPrimary}
          >
            {pending ? <ButtonSpinner /> : t('playground.control.restartDialog.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
