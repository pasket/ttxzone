import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { apiFetch, ApiError } from '../../lib/api'
import { parseAddresses } from '../../lib/emailInvitations'
import {
  actionsCellClass,
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputDisabled,
} from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  EmailInvitationCreateResponse,
  EmailInvitationListResponse,
  EmailInvitationOutcomeKind,
  EmailInvitationRead,
  EmailInvitationStatus,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CollapsibleFormSection } from '../common/CollapsibleFormSection'
import { IconButton } from '../common/IconButton'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'

const PAGE_SIZE = 10
// Mirrors the backend's MAX_ADDRESSES_PER_REQUEST.
const MAX_ADDRESSES = 50
// Its own keys in the URL: the join codes' list shares the page.
const URL_PREFIX = 'email_'

const STATUS_KEYS = {
  pending: 'creator.emailInvitations.status.pending',
  accepted: 'creator.emailInvitations.status.accepted',
  expired: 'creator.emailInvitations.status.expired',
  revoked: 'creator.emailInvitations.status.revoked',
} as const satisfies Record<EmailInvitationStatus, string>

const OUTCOME_KEYS = {
  sent: 'creator.emailInvitations.outcome.sent',
  resent: 'creator.emailInvitations.outcome.resent',
  already_player: 'creator.emailInvitations.outcome.already_player',
  on_team: 'creator.emailInvitations.outcome.on_team',
  dropped: 'creator.emailInvitations.outcome.dropped',
} as const satisfies Record<EmailInvitationOutcomeKind, string>

function ResendIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="size-4"
    >
      <path
        d="M3 5.5h11.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V5.5Z"
        strokeLinejoin="round"
      />
      <path d="m3.5 6 6.5 5 6.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Creator -> Players -> Invitations, by email: personal links, one per
 * address, that let their holder in at once (no request to approve). Shown
 * only while the deployment sends email. */
export function EmailInvitationsSection({ ttxId }: { ttxId: string }) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()

  const [items, setItems] = useState<EmailInvitationRead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState(URL_PREFIX)
  usePageFallback({ prefix: URL_PREFIX, total, pageSize: PAGE_SIZE, ready: !loading })
  const [refreshTick, setRefreshTick] = useState(0)

  const [open, setOpen] = useState(false)
  const [addresses, setAddresses] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<EmailInvitationCreateResponse['results'] | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wasOpenRef = useRef(false)

  // Focus follows the form, as in the join codes' section: the trigger
  // only exists again after the post-close render.
  useEffect(() => {
    if (open) textareaRef.current?.focus()
    else if (wasOpenRef.current) triggerRef.current?.focus()
    wasOpenRef.current = open
  }, [open])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        const data = await apiFetch<EmailInvitationListResponse>(
          `/ttx/${ttxId}/email-invitations?limit=${PAGE_SIZE}&offset=${offset}&sort_dir=${sortDir}&sort_by=${sortBy}&q=${encodeURIComponent(search)}`,
        )
        if (!cancelled) {
          setItems(data.items)
          setTotal(data.total)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, page, sortDir, sortBy, search, refreshTick])

  const parsed = parseAddresses(addresses)
  const tooMany = parsed.length > MAX_ADDRESSES

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (parsed.length === 0 || tooMany) return
    setError(null)
    setSubmitting(true)
    try {
      const data = await apiFetch<EmailInvitationCreateResponse>(
        `/ttx/${ttxId}/email-invitations`,
        { method: 'POST', body: JSON.stringify({ emails: parsed }) },
      )
      setResults(data.results)
      setAddresses('')
      setOpen(false)
      if (page === 1 && sortDir === 'desc') setRefreshTick((tick) => tick + 1)
      else setSortDir('desc')
      showToast(t('creator.emailInvitations.sentToast'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend(item: EmailInvitationRead) {
    setResending(item.id)
    try {
      const updated = await apiFetch<EmailInvitationRead>(
        `/ttx/${ttxId}/email-invitations/${item.id}/resend`,
        { method: 'POST' },
      )
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      showToast(t('creator.emailInvitations.resentToast'))
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setResending(null)
    }
  }

  function handleRevoke(item: EmailInvitationRead) {
    function setRow(row: EmailInvitationRead) {
      setItems((prev) => prev.map((r) => (r.id === row.id ? row : r)))
    }
    runUndoable({
      message: t('creator.emailInvitations.revokedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setRow({ ...item, status: 'revoked', revoked_at: new Date().toISOString() }),
      onRestore: () => setRow(item),
      onCommit: async () => {
        try {
          setRow(
            await apiFetch<EmailInvitationRead>(`/ttx/${ttxId}/email-invitations/${item.id}`, {
              method: 'DELETE',
            }),
          )
        } catch (err) {
          setRow(item)
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <CollapsibleFormSection
        open={open}
        onOpenChange={setOpen}
        triggerLabel={t('creator.emailInvitations.sendButtonShort')}
        triggerTooltip={t('creator.emailInvitations.sendTitle')}
        sectionTitle={t('creator.emailInvitations.listTitle')}
        triggerRef={triggerRef}
      >
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <Panel
            title={t('creator.emailInvitations.sendTitle')}
            description={t('creator.emailInvitations.sendDescription')}
            footer={
              <div className={panelFormActions}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className={btnSecondary}
                >
                  {t('common.confirmButton.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || parsed.length === 0 || tooMany}
                  className={btnPrimary}
                >
                  {submitting ? (
                    <ButtonSpinner />
                  ) : (
                    t('creator.emailInvitations.sendSubmit', { count: parsed.length })
                  )}
                </button>
              </div>
            }
          >
            <div className="max-w-2xl space-y-2">
              <label className="block text-sm" htmlFor="email-invitations-addresses">
                {t('creator.emailInvitations.addressesLabel')}
              </label>
              <textarea
                ref={textareaRef}
                id="email-invitations-addresses"
                name="emails"
                rows={5}
                spellCheck={false}
                autoComplete="off"
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
                placeholder={t('creator.emailInvitations.addressesPlaceholder')}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
              />
              <p
                className={`text-sm ${tooMany ? 'text-danger-fg' : 'text-paper-ink/60 dark:text-fg-muted'}`}
                aria-live="polite"
              >
                {tooMany
                  ? t('creator.emailInvitations.tooMany', { max: MAX_ADDRESSES })
                  : t('creator.emailInvitations.addressCount', { count: parsed.length })}
              </p>
              {error && (
                <p className="text-sm text-danger-fg" aria-live="polite">
                  {error}
                </p>
              )}
            </div>
          </Panel>
        </form>
      </CollapsibleFormSection>

      {!open && (
        <Panel
          label={t('creator.emailInvitations.listTitle')}
          meta={loading ? undefined : t('creator.emailInvitations.count', { count: total })}
          aside={
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortLabels={{
                name: t('creator.emailInvitations.columnEmail'),
                created_at: t('creator.emailInvitations.columnSent'),
              }}
            />
          }
          footer={
            totalPages > 1 ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : undefined
          }
          flush
        >
          {results && (
            <div className="space-y-2 border-b border-panel-line px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-paper-ink dark:text-fg">
                  {t('creator.emailInvitations.resultsTitle')}
                </p>
                <button
                  type="button"
                  onClick={() => setResults(null)}
                  className={`text-sm ${btnSecondary}`}
                >
                  {t('creator.emailInvitations.resultsDismiss')}
                </button>
              </div>
              <ul className="space-y-1 text-sm">
                {results.map((result) => (
                  <li key={result.email} className="flex flex-wrap gap-x-2">
                    <span className="font-mono text-xs leading-5" translate="no">
                      {result.email}
                    </span>
                    <span
                      className={
                        result.outcome === 'dropped'
                          ? 'text-danger-fg'
                          : 'text-paper-ink/70 dark:text-fg-muted'
                      }
                    >
                      {t(OUTCOME_KEYS[result.outcome])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
              {search
                ? t('common.toolbar.noSearchResults', { query: search })
                : t('creator.emailInvitations.empty')}
            </p>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th scope="col" className={panelTh}>
                      {t('creator.emailInvitations.columnEmail')}
                    </th>
                    <th scope="col" className={panelTh}>
                      {t('creator.emailInvitations.columnStatus')}
                    </th>
                    <th scope="col" className={panelTh}>
                      {t('creator.emailInvitations.columnInvitedBy')}
                    </th>
                    <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                      {t('creator.emailInvitations.columnSent')}
                    </th>
                    <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                      {t('creator.emailInvitations.columnExpires')}
                    </th>
                    <th scope="col" className={panelActionsTh}>
                      {t('common.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {items.map((item) => (
                    <tr key={item.id} className={panelTr}>
                      <th scope="row" className={`${panelTd} text-left font-normal`}>
                        <span className="break-all text-sm" translate="no">
                          {item.email}
                        </span>
                      </th>
                      <td className={`${panelTd} text-sm`}>{t(STATUS_KEYS[item.status])}</td>
                      <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                        {item.invited_by_name}
                      </td>
                      <td
                        className={`${panelTd} whitespace-nowrap text-sm tabular-nums text-paper-ink/70 dark:text-fg-muted`}
                      >
                        {dateFmt.format(new Date(item.sent_at))}
                      </td>
                      <td
                        className={`${panelTd} whitespace-nowrap text-sm tabular-nums text-paper-ink/70 dark:text-fg-muted`}
                      >
                        {item.status === 'pending' || item.status === 'expired'
                          ? dateFmt.format(new Date(item.expires_at))
                          : ''}
                      </td>
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          {item.status !== 'accepted' && (
                            <button
                              type="button"
                              onClick={() => void handleResend(item)}
                              disabled={resending === item.id}
                              aria-label={t('creator.emailInvitations.resendButton', {
                                email: item.email,
                              })}
                              title={t('creator.emailInvitations.resendButton', {
                                email: item.email,
                              })}
                              className={btnNeutralIconGhost}
                            >
                              {resending === item.id ? <ButtonSpinner /> : <ResendIcon />}
                            </button>
                          )}
                          {item.status === 'pending' && (
                            <IconButton
                              onClick={() => handleRevoke(item)}
                              label={t('creator.emailInvitations.revokeButton', {
                                email: item.email,
                              })}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
