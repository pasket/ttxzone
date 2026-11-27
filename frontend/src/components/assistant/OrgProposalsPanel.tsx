import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  optionalSuffix,
} from '../../lib/buttonStyles'
import type { AssistantOrgProposal, AssistantOrgProposalList } from '../../lib/types'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'

const DISCARD_REASONS = [
  { value: 'duplicate', label: 'assistant.discardReasons.duplicate' },
  { value: 'unrealistic', label: 'assistant.discardReasons.unrealistic' },
  { value: 'out_of_scope', label: 'assistant.discardReasons.outOfScope' },
  { value: 'tone', label: 'assistant.discardReasons.tone' },
  { value: 'incorrect', label: 'assistant.discardReasons.incorrect' },
  { value: 'other', label: 'assistant.discardReasons.other' },
] as const

const TITLES = {
  new_exercise: 'assistant.organization.newExerciseTitle',
  library_inject: 'assistant.organization.libraryInjectTitle',
} as const

/** The AI assistant's proposals to the organization that this page takes
 * (a new exercise, a Library inject): the person's own, waiting. Accepting
 * hands the proposal to the page, which fills its form; the form's save
 * creates the row and the page records it. Nothing shows with none
 * waiting. */
export function OrgProposalsPanel({
  organizationId,
  target,
  onAccept,
}: {
  organizationId: string
  target: AssistantOrgProposal['target']
  /** The page remounts the panel (a new `key`) once it recorded one as applied. */
  onAccept: (proposal: AssistantOrgProposal) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const list = useApiResource<AssistantOrgProposalList>(
    `/organizations/${organizationId}/assistant/proposals?target=${target}`,
  )
  const [discarding, setDiscarding] = useState<AssistantOrgProposal | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const items = list.data?.items ?? []
  if (items.length === 0) return null

  async function confirmDiscard() {
    if (!discarding) return
    try {
      await apiFetch(
        `/organizations/${organizationId}/assistant/proposals/${discarding.id}/discard`,
        { method: 'POST', body: JSON.stringify({ reason: reason || null, note }) },
      )
      setDiscarding(null)
      setReason('')
      setNote('')
      list.refetch()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    }
  }

  return (
    <Panel
      title={t(TITLES[target])}
      meta={t('assistant.organization.count', { count: items.length })}
      description={t('assistant.organization.description')}
    >
      <ul className="divide-y divide-panel-line">
        {items.map((proposal) => {
          const name = String(proposal.patch.title ?? proposal.patch.name ?? '')
          return (
            <li
              key={proposal.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-paper-ink dark:text-fg">{name}</p>
                {proposal.summary && (
                  <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{proposal.summary}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  aria-label={t('assistant.organization.reviewLabel', { name })}
                  onClick={() => onAccept(proposal)}
                >
                  {t('assistant.organization.review')}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  aria-label={t('assistant.organization.discardLabel', { name })}
                  onClick={() => setDiscarding(proposal)}
                >
                  {t('assistant.discard')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {discarding && (
        <Modal titleId="assistant-org-discard-title" onClose={() => setDiscarding(null)}>
          <h2 id="assistant-org-discard-title" className="text-lg font-semibold tracking-tight">
            {t('assistant.discardTitle', { count: 1 })}
          </h2>
          <label className="block space-y-1 text-sm">
            <span>
              {t('assistant.discardReasonLabel')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </span>
            <select
              className={inputBase}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">{t('assistant.discardReasons.none')}</option>
              {DISCARD_REASONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>
              {t('assistant.discardNoteLabel')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </span>
            <textarea
              className={inputBase}
              rows={2}
              maxLength={500}
              value={note}
              placeholder={t('assistant.discardNotePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="text-[13px] text-paper-ink/70 dark:text-fg-muted">
            {t('assistant.discardWhyHint')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btnDanger} flex-1`}
              onClick={() => void confirmDiscard()}
            >
              {t('assistant.discard')}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setDiscarding(null)}>
              {t('common.confirmButton.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </Panel>
  )
}
