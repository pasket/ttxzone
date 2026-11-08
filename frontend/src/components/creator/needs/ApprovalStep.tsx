import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../../hooks/useApiDownload'
import { formatSize } from '../../../lib/fileSize'
import { btnPrimary, btnSecondary, linkAccent } from '../../../lib/buttonStyles'
import { APPROVER_KINDS, fieldDomId } from '../../../lib/needsForm'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../../lib/panelStyles'
import { API_BASE } from '../../../lib/api'
import type {
  ApprovalRead,
  ApproverKind,
  EvidenceRead,
  NeedsForm,
  NeedsFormStatus,
} from '../../../lib/types'
import { ButtonSpinner } from '../../common/ButtonSpinner'
import { IconButton } from '../../common/IconButton'
import { Modal } from '../../common/Modal'
import { Field, Select, TextInput } from './fields'

export interface ApprovalInput {
  approver_kind: ApproverKind
  approver_name: string
  approver_role: string
  approved_on: string
}

/** What the backend accepts as evidence (it also checks the contents). */
export const EVIDENCE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.eml,.msg,.txt'

export interface EvidenceActions {
  /** Download URL of a file (a Planner-gated endpoint). */
  href: (approval: ApprovalRead, evidence: EvidenceRead) => string
  /** Present while files can be attached (the current version, past draft). */
  onAdd?: (approval: ApprovalRead, files: File[]) => Promise<void>
  /** Present while files can be removed (only before approval). */
  onRemove?: (approval: ApprovalRead, evidence: EvidenceRead) => void
}

const STATUS_TEXT_KEYS = {
  draft: 'creator.needs.approval.statusDraft',
  ready_for_approval: 'creator.needs.approval.statusReady',
  approved: 'creator.needs.approval.statusApproved',
} as const

/** Section 9 -- the form's lifecycle: submit, record approvals (on the
 * approvers' behalf), approve, or send it back to draft. Transitions act
 * on the saved form, so they wait for unsaved edits to be saved. */
export function ApprovalStep({
  form,
  dirty,
  busy,
  onTransition,
  onRecordApproval,
  onRemoveApproval,
  onAddEvidence,
  onRemoveEvidence,
}: {
  form: NeedsForm
  dirty: boolean
  busy: boolean
  onTransition: (to: NeedsFormStatus) => Promise<void>
  onRecordApproval: (input: ApprovalInput, files: File[]) => Promise<boolean>
  onRemoveApproval: (approval: ApprovalRead) => void
  onAddEvidence: (approval: ApprovalRead, files: File[]) => Promise<void>
  onRemoveEvidence: (approval: ApprovalRead, evidence: EvidenceRead) => void
}) {
  const { t, i18n } = useTranslation()
  const [confirmReopen, setConfirmReopen] = useState(false)
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  const current = form.approvals.filter((a) => a.version === form.version)
  // The file's API path (`apiDownload` adds the base, the link's href too).
  const href = (approval: ApprovalRead, evidence: EvidenceRead) =>
    `/ttx/${form.ttx_id}/needs-form/approvals/${approval.id}/evidence/${evidence.id}`
  // Attach while awaiting or granted approval (a signed copy often comes
  // later); remove only before approval, when it's not yet audit trail.
  const currentEvidence: EvidenceActions = {
    href,
    onAdd: busy ? undefined : onAddEvidence,
    onRemove: busy || form.status !== 'ready_for_approval' ? undefined : onRemoveEvidence,
  }
  const history = form.approvals.filter((a) => a.version !== form.version)
  const readyBlocked = form.validation.ready.length > 0
  const approveBlocked = readyBlocked || form.validation.approved.length > 0

  function blockedReason(blocked: boolean) {
    if (dirty) return t('creator.needs.approval.saveFirst')
    if (blocked) return t('creator.needs.approval.blockedBySummary')
    return null
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-pretty">{t(STATUS_TEXT_KEYS[form.status])}</p>

      {form.status === 'draft' && (
        <TransitionButton
          label={t('creator.needs.actions.submit')}
          reason={blockedReason(readyBlocked)}
          busy={busy}
          onClick={() => void onTransition('ready_for_approval')}
        />
      )}

      {form.status === 'ready_for_approval' && (
        <>
          <section aria-labelledby="needs-approvals-current" className="space-y-3">
            <h3 id="needs-approvals-current" className="text-balance text-sm font-semibold">
              {t('creator.needs.approval.current', { version: form.version })}
            </h3>
            <ApprovalTable
              approvals={current}
              emptyText={t('creator.needs.approval.noCurrent')}
              dateFmt={dateFmt}
              onRemove={busy ? undefined : onRemoveApproval}
              evidence={currentEvidence}
            />
          </section>
          <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
            {t('creator.needs.pdf.signHint')}
          </p>
          <RecordApprovalForm busy={busy} onRecord={onRecordApproval} />
          <div className="flex flex-wrap items-start gap-3">
            <TransitionButton
              label={t('creator.needs.actions.approve')}
              reason={blockedReason(approveBlocked)}
              busy={busy}
              onClick={() => void onTransition('approved')}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onTransition('draft')}
              className={btnSecondary}
            >
              {t('creator.needs.actions.backToDraft')}
            </button>
          </div>
        </>
      )}

      {form.status === 'approved' && (
        <>
          <ApprovalTable
            approvals={current}
            emptyText={t('creator.needs.approval.noCurrent')}
            dateFmt={dateFmt}
            evidence={currentEvidence}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmReopen(true)}
            className={btnSecondary}
          >
            {t('creator.needs.actions.reopen')}
          </button>
        </>
      )}

      {history.length > 0 && (
        <section aria-labelledby="needs-approvals-history" className="space-y-3">
          <h3 id="needs-approvals-history" className="text-balance text-sm font-semibold">
            {t('creator.needs.approval.history')}
          </h3>
          <ApprovalTable
            approvals={history}
            emptyText=""
            dateFmt={dateFmt}
            showVersion
            evidence={{ href }}
          />
        </section>
      )}

      {confirmReopen && (
        <Modal titleId="needs-reopen-title" onClose={() => setConfirmReopen(false)}>
          <h2 id="needs-reopen-title" className="text-balance text-lg font-semibold tracking-tight">
            {t('creator.needs.dialogs.reopenTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('creator.needs.dialogs.reopenBody', { version: form.version + 1 })}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmReopen(false)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmReopen(false)
                void onTransition('draft')
              }}
              className={btnPrimary}
            >
              {t('creator.needs.dialogs.reopenConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TransitionButton({
  label,
  reason,
  busy,
  onClick,
}: {
  label: string
  reason: string | null
  busy: boolean
  onClick: () => void
}) {
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={reason !== null || busy}
        aria-describedby={reason ? 'needs-transition-reason' : undefined}
        onClick={onClick}
        className={btnPrimary}
      >
        {busy ? <ButtonSpinner /> : label}
      </button>
      {reason && (
        <p id="needs-transition-reason" className="text-xs text-paper-ink/60 dark:text-fg-faint">
          {reason}
        </p>
      )}
    </div>
  )
}

function ApprovalTable({
  approvals,
  emptyText,
  dateFmt,
  onRemove,
  showVersion = false,
  evidence,
}: {
  approvals: ApprovalRead[]
  emptyText: string
  dateFmt: Intl.DateTimeFormat
  onRemove?: (approval: ApprovalRead) => void
  showVersion?: boolean
  evidence: EvidenceActions
}) {
  const { t } = useTranslation()
  if (approvals.length === 0) {
    return <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{emptyText}</p>
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={panelTableHeadRow}>
            {showVersion && (
              <th className={panelTh}>{t('creator.needs.approval.versionColumn')}</th>
            )}
            <th className={panelTh}>{t('creator.needs.fields.approver_kind')}</th>
            <th className={panelTh}>{t('creator.needs.fields.approver_name')}</th>
            <th className={panelTh}>{t('creator.needs.fields.approved_on')}</th>
            {onRemove && <th className={panelActionsTh}>{t('common.table.actions')}</th>}
          </tr>
        </thead>
        <tbody className={panelTbody}>
          {approvals.map((approval) => (
            <tr key={approval.id} className={panelTr}>
              {showVersion && (
                <td className={`${panelTd} font-mono text-sm`}>
                  {t('creator.needs.version', { version: approval.version })}
                </td>
              )}
              <td className={`${panelTd} text-sm`}>
                {t(`creator.needs.approverKinds.${approval.approver_kind}`)}
              </td>
              <td className={`${panelTd} text-sm`}>
                {approval.approver_name}
                {approval.approver_role && (
                  <span className="text-paper-ink/60 dark:text-fg-faint">
                    {' '}
                    · {approval.approver_role}
                  </span>
                )}
                <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('creator.needs.approval.recordedBy', {
                    name: approval.recorded_by_name,
                    date: dateFmt.format(new Date(approval.recorded_at)),
                  })}
                </span>
                <EvidenceList approval={approval} actions={evidence} />
              </td>
              <td className={`${panelTd} whitespace-nowrap text-sm tabular-nums`}>
                {dateFmt.format(new Date(`${approval.approved_on}T00:00:00`))}
              </td>
              {onRemove && (
                <td className={panelTd}>
                  <div className="flex justify-end">
                    <IconButton
                      label={t('creator.needs.actions.removeApproval', {
                        name: approval.approver_name,
                      })}
                      onClick={() => onRemove(approval)}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordApprovalForm({
  busy,
  onRecord,
}: {
  busy: boolean
  onRecord: (input: ApprovalInput, files: File[]) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [files, setFiles] = useState<File[]>([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [input, setInput] = useState<ApprovalInput>(() => ({
    approver_kind: 'sponsor',
    approver_name: '',
    approver_role: '',
    approved_on: new Date().toISOString().slice(0, 10),
  }))

  return (
    <form
      aria-labelledby="needs-record-approval-title"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await onRecord(input, files)) {
          setInput({ ...input, approver_name: '', approver_role: '' })
          setFiles([])
          setFileInputKey((key) => key + 1)
        }
      }}
      className="space-y-4 rounded-sm border border-paper-line p-4 dark:border-line"
    >
      <div className="space-y-1">
        <h3 id="needs-record-approval-title" className="text-balance text-sm font-semibold">
          {t('creator.needs.approval.recordTitle')}
        </h3>
        <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
          {t('creator.needs.approval.recordHint')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={fieldDomId('approver_kind')} label={t('creator.needs.fields.approver_kind')}>
          <Select<ApproverKind>
            id={fieldDomId('approver_kind')}
            value={input.approver_kind}
            onChange={(approver_kind) => setInput({ ...input, approver_kind })}
            options={APPROVER_KINDS.map((value) => ({
              value,
              label: t(`creator.needs.approverKinds.${value}`),
            }))}
          />
        </Field>
        <Field id={fieldDomId('approved_on')} label={t('creator.needs.fields.approved_on')}>
          <TextInput
            id={fieldDomId('approved_on')}
            type="date"
            required
            value={input.approved_on}
            onChange={(approved_on) => setInput({ ...input, approved_on })}
          />
        </Field>
        <Field id={fieldDomId('approver_name')} label={t('creator.needs.fields.approver_name')}>
          <TextInput
            id={fieldDomId('approver_name')}
            required
            maxLength={255}
            value={input.approver_name}
            onChange={(approver_name) => setInput({ ...input, approver_name })}
          />
        </Field>
        <Field
          id={fieldDomId('approver_role')}
          label={t('creator.needs.fields.approver_role')}
          optional
        >
          <TextInput
            id={fieldDomId('approver_role')}
            maxLength={255}
            value={input.approver_role}
            onChange={(approver_role) => setInput({ ...input, approver_role })}
          />
        </Field>
      </div>
      <Field
        id={fieldDomId('approval_evidence')}
        label={t('creator.needs.evidence.label')}
        optional
        hint={t('creator.needs.evidence.hint')}
      >
        <input
          key={fileInputKey}
          id={fieldDomId('approval_evidence')}
          type="file"
          multiple
          accept={EVIDENCE_ACCEPT}
          aria-describedby={`${fieldDomId('approval_evidence')}-hint`}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-paper-line file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-paper-ink dark:file:border-line dark:file:text-fg"
        />
      </Field>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={btnSecondary}>
          {t('creator.needs.actions.recordApproval')}
        </button>
      </div>
    </form>
  )
}

/** An approval's evidence files: download links, plus attach/remove while
 * the lifecycle allows it. */
function EvidenceList({ approval, actions }: { approval: ApprovalRead; actions: EvidenceActions }) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const inputId = `needs-evidence-add-${approval.id}`
  if (approval.evidence.length === 0 && !actions.onAdd) return null
  return (
    <div className="mt-2 space-y-1">
      {approval.evidence.length > 0 && (
        <ul
          aria-label={t('creator.needs.evidence.listLabel', { name: approval.approver_name })}
          className="space-y-1"
        >
          {approval.evidence.map((file) => (
            <li key={file.id} className="flex items-center gap-2 text-xs">
              <a
                href={`${API_BASE}${actions.href(approval, file)}`}
                download
                onClick={download(actions.href(approval, file))}
                className={`truncate ${linkAccent}`}
              >
                {file.filename}
              </a>
              <span className="shrink-0 tabular-nums text-paper-ink/60 dark:text-fg-faint">
                {formatSize(file.size_bytes, i18n.language)}
              </span>
              {actions.onRemove && (
                <button
                  type="button"
                  onClick={() => actions.onRemove?.(approval, file)}
                  aria-label={t('creator.needs.evidence.remove', { name: file.filename })}
                  className="shrink-0 rounded-xs px-1 text-paper-ink/60 hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {actions.onAdd && (
        <label
          htmlFor={inputId}
          className={`inline-block cursor-pointer text-xs ${linkAccent} focus-within:underline`}
        >
          <span aria-hidden="true">+ </span>
          {t('creator.needs.evidence.attach')}
          <input
            id={inputId}
            type="file"
            multiple
            accept={EVIDENCE_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (picked.length > 0) void actions.onAdd?.(approval, picked)
            }}
          />
        </label>
      )}
    </div>
  )
}
