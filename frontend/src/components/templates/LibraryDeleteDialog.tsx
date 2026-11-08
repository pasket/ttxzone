import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnDanger, btnSecondary } from '../../lib/buttonStyles'
import type { LibraryDeleteResult, LibraryUsage } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

/** Delete confirmation for a library item. An organization item (`usage`
 * set) first asks what uses it: in use, the action disables it instead
 * and the dialog lists the impact; free, it's deleted for good (the server
 * asks for a recent sign-in). An exercise item keeps the plain warning. */
export function LibraryDeleteDialog({
  titleId,
  title,
  name,
  url,
  usage,
  warning,
  deletedMessage,
  confirmLabel,
  onClose,
  onDone,
}: {
  titleId: string
  title: string
  name: string
  /** The item's DELETE url; `${url}/usage` when `usage` is set. */
  url: string
  usage: boolean
  /** The plain warning: exercise items, or while usage loads. */
  warning: string
  deletedMessage: string
  /** The plain delete button's label (exercise items). */
  confirmLabel?: string
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const found = useApiResource<LibraryUsage>(usage ? `${url}/usage` : null)
  const inUse = (found.data?.total ?? 0) > 0

  async function confirm() {
    setBusy(true)
    try {
      const result = await apiFetch<LibraryDeleteResult | undefined>(url, { method: 'DELETE' })
      showToast(
        result?.result === 'disabled'
          ? t('templates.usage.disabledToast', { name })
          : deletedMessage,
      )
      onDone()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  let body = <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{warning}</p>
  if (usage && found.loading && !found.data) {
    body = (
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted" role="status">
        {t('templates.usage.checking')}
      </p>
    )
  } else if (usage && found.error) {
    body = (
      <p className="text-sm text-danger-fg" role="alert">
        {t('templates.usage.loadFailed')}
      </p>
    )
  } else if (usage && found.data) {
    body = inUse ? (
      <UsageImpact usage={found.data} />
    ) : (
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('templates.usage.freeIntro')}
      </p>
    )
  }
  const ready = !usage || (found.data !== null && !found.error)

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-balance text-lg font-semibold tracking-tight text-danger-fg">
        {title}
      </h2>
      {body}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('common.confirmButton.cancel')}
        </button>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={() => void confirm()}
          className={btnDanger}
        >
          {busy ? (
            <ButtonSpinner />
          ) : !usage ? (
            (confirmLabel ?? t('templates.actors.deleteConfirm'))
          ) : inUse ? (
            t('templates.usage.disable')
          ) : (
            t('templates.usage.deletePermanently')
          )}
        </button>
      </div>
    </Modal>
  )
}

function UsageImpact({ usage }: { usage: LibraryUsage }) {
  const { t } = useTranslation()
  const headingClass =
    'text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-faint'
  const listClass = 'mt-1 space-y-0.5 text-sm'
  return (
    <div className="space-y-3">
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('templates.usage.inUseIntro')}
      </p>
      {usage.exercises.length > 0 && (
        <div>
          <h3 className={headingClass}>{t('templates.usage.exercisesHeading')}</h3>
          <ul className={listClass}>
            {usage.exercises.map((exercise) => (
              <li key={exercise.ttx_id}>
                <span translate="no">{exercise.name}</span>
                <span className="text-paper-ink/60 dark:text-fg-faint">
                  {' · '}
                  {t('templates.usage.copies', { count: exercise.copies })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usage.injects.length > 0 && (
        <div>
          <h3 className={headingClass}>{t('templates.usage.injectsHeading')}</h3>
          <ul className={listClass}>
            {usage.injects.map((inject) => (
              <li key={inject.id}>{inject.title}</li>
            ))}
          </ul>
        </div>
      )}
      {(usage.applied_to_organization || usage.memberships > 0 || usage.allowed_domains > 0) && (
        <ul className={listClass}>
          {usage.applied_to_organization && <li>{t('templates.usage.appliedToOrganization')}</li>}
          {usage.memberships > 0 && (
            <li>{t('templates.usage.memberships', { count: usage.memberships })}</li>
          )}
          {usage.allowed_domains > 0 && (
            <li>{t('templates.usage.allowedDomains', { count: usage.allowed_domains })}</li>
          )}
        </ul>
      )}
    </div>
  )
}
