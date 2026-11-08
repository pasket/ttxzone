import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnPrimary,
  btnNeutralIconBare,
  btnSecondary,
  inputBase,
  inputDisabled,
  optionalSuffix,
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
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CollapsibleFormSection } from '../common/CollapsibleFormSection'
import { DuplicateIcon } from '../common/DuplicateIcon'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'
import { TagAssignmentField } from '../common/TagAssignmentField'
import { TagChip } from '../common/TagChip'
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type {
  InstancePolicy,
  InvitationTokenAuditRead,
  InvitationTokenAuditListResponse,
  InvitationTokenCreateResponse,
  InvitationTokenRevokeResponse,
  SortBy,
  SortDir,
  TTXTag,
  TTXTagListResponse,
} from '../../lib/types'
import { EmailInvitationsSection } from './EmailInvitationsSection'
import { PlayersTabs } from './PlayersTabs'

// Roles an existing token can carry (older tokens may be Planner ones,
// now revoked). New tokens are always for players: Planners join
// an exercise as planningTeam (Creator -> Settings -> Exercise
// planningTeam), not through a shared join code.
type TokenRole = 'planner' | 'player'

const MAX_EXPIRY_DAYS = 365
const PAGE_SIZE = 10

function maxExpiryLocalValue(): string {
  const max = new Date(Date.now() + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  max.setSeconds(0, 0)
  return new Date(max.getTime() - max.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function CreatorInvitationsSection() {
  const { t } = useTranslation()
  const { activeTtxId, refresh } = useAuth()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()
  // Personal invitations by email, only while the deployment sends email.
  const policy = useApiResource<InstancePolicy>('/instance/policy')

  const [tokens, setTokens] = useState<InvitationTokenAuditRead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState()
  usePageFallback({ total, pageSize: PAGE_SIZE, ready: !loading })
  const [refreshTick, setRefreshTick] = useState(0)
  const [open, setOpen] = useState(false)

  const [description, setDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxUses, setMaxUses] = useState('1')
  const [unlimited, setUnlimited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  const [availableTags, setAvailableTags] = useState<TTXTag[]>([])
  const [editingTagsFor, setEditingTagsFor] = useState<InvitationTokenAuditRead | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [tagSubmitting, setTagSubmitting] = useState(false)
  const editTagsTriggerRef = useRef<Map<string, HTMLButtonElement>>(new Map())

  const createTriggerRef = useRef<HTMLButtonElement>(null)
  const descriptionInputRef = useRef<HTMLInputElement>(null)
  // The trigger button unmounts while the form is open (CollapsibleFormSection
  // hides it), so a synchronous `.focus()` call right after `setOpen(false)`
  // would run before React remounts it -- `.current` would still be null at
  // that point. Returning focus has to happen in an effect instead, which
  // runs after the post-close render has committed and the button actually
  // exists again. wasOpenRef guards against firing on initial mount (open
  // starts false, nothing to return focus to yet).
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open) {
      descriptionInputRef.current?.focus()
    } else if (wasOpenRef.current) {
      createTriggerRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  useEffect(() => {
    if (!activeTtxId) return
    let cancelled = false
    async function loadTokens() {
      setLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        const data = await apiFetch<InvitationTokenAuditListResponse>(
          `/ttx/${activeTtxId}/invitation-tokens?limit=${PAGE_SIZE}&offset=${offset}&sort_dir=${sortDir}&sort_by=${sortBy}&q=${encodeURIComponent(search)}`,
        )
        if (!cancelled) {
          setTokens(data.items)
          setTotal(data.total)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadTokens()
    return () => {
      cancelled = true
    }
  }, [activeTtxId, page, sortDir, sortBy, search, refreshTick])

  useEffect(() => {
    if (!activeTtxId) return
    let cancelled = false
    async function loadTags() {
      try {
        const data = await apiFetch<TTXTagListResponse>(
          `/ttx/${activeTtxId}/tags?limit=200&offset=0&sort_by=name&sort_dir=asc`,
        )
        if (!cancelled) setAvailableTags(data.items)
      } catch {
        // Degrade silently (no tag picker) rather than crash, same as
        // AdminOrganizationProfileSection's own tags fetch.
        if (!cancelled) setAvailableTags([])
      }
    }
    void loadTags()
    return () => {
      cancelled = true
    }
  }, [activeTtxId])

  function handleSortDirChange(newSortDir: SortDir) {
    setSortDir(newSortDir)
  }

  function handleSortByChange(newSortBy: SortBy) {
    setSortBy(newSortBy)
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!activeTtxId) return
    setError(null)

    setSubmitting(true)
    try {
      const created = await apiFetch<InvitationTokenCreateResponse>(
        `/ttx/${activeTtxId}/invitation-tokens`,
        {
          method: 'POST',
          body: JSON.stringify({
            role: 'player',
            description: description.trim() || null,
            expires_at: new Date(expiresAt).toISOString(),
            max_uses: unlimited ? null : Number(maxUses),
          }),
        },
      )
      setRevealedToken(created.token)
      setDescription('')
      setExpiresAt('')
      setMaxUses('1')
      setUnlimited(false)
      setOpen(false)
      // A new token is always newest -- reset to page 1 / newest-first so
      // it's guaranteed visible, and bump refreshTick to force a refetch
      // even if we were already there.
      // Only one of the two: the URL change lands in a transition, so a
      // tick bump alongside it would first refetch with the old page/sort.
      if (page === 1 && sortDir === 'desc') setRefreshTick((tick) => tick + 1)
      else setSortDir('desc')
      void refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleRevoke(item: InvitationTokenAuditRead) {
    function setRevokedAt(value: string | null) {
      setTokens((prev) => prev.map((t) => (t.id === item.id ? { ...t, revoked_at: value } : t)))
    }
    runUndoable({
      message: t('creator.invitations.revokedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setRevokedAt(new Date().toISOString()),
      onRestore: () => setRevokedAt(null),
      onCommit: async () => {
        try {
          const revoked = await apiFetch<InvitationTokenRevokeResponse>(
            `/invitation-tokens/${item.id}`,
            { method: 'DELETE' },
          )
          setRevokedAt(revoked.revoked_at)
        } catch (err) {
          setRevokedAt(null)
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  function openTagModal(item: InvitationTokenAuditRead) {
    setEditingTagsFor(item)
    setSelectedTagIds(new Set(item.tags.map((tag) => tag.id)))
  }

  function closeTagModal() {
    setEditingTagsFor(null)
    editTagsTriggerRef.current.get(editingTagsFor?.id ?? '')?.focus()
  }

  async function handleSaveTags() {
    if (!editingTagsFor) return
    setTagSubmitting(true)
    try {
      const updated = await apiFetch<InvitationTokenAuditRead>(
        `/invitation-tokens/${editingTagsFor.id}/tags`,
        { method: 'PUT', body: JSON.stringify({ tag_ids: Array.from(selectedTagIds) }) },
      )
      setTokens((prev) =>
        prev.map((tok) => (tok.id === updated.id ? { ...tok, tags: updated.tags } : tok)),
      )
      showToast(t('common.toast.savedSuccess'))
      setEditingTagsFor(null)
      editTagsTriggerRef.current.get(updated.id)?.focus()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setTagSubmitting(false)
    }
  }

  async function handleCopy(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      showToast(t('creator.invitations.copiedToast'))
    } catch {
      // Clipboard access can be denied by the browser; the token stays
      // visible either way (in the reveal callout, and persistently in
      // the list below), so the user can still copy it by hand.
      showToast(t('creator.invitations.copyFailedToast'), { variant: 'error' })
    }
  }

  if (activeTtxId === null) {
    return (
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('creator.invitations.noTtxMessage')}
      </p>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PlayersTabs />
      <CollapsibleFormSection
        open={open}
        onOpenChange={setOpen}
        triggerLabel={t('creator.invitations.createButtonShort')}
        triggerTooltip={t('creator.invitations.createTitle')}
        sectionTitle={t('creator.invitations.listTitle')}
        triggerRef={createTriggerRef}
      >
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <Panel
            title={t('creator.invitations.createTitle')}
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
                <button type="submit" disabled={submitting} className={btnPrimary}>
                  {submitting ? <ButtonSpinner /> : t('creator.invitations.createSubmit')}
                </button>
              </div>
            }
          >
            <div className="max-w-sm space-y-2">
              <label className="block text-sm" htmlFor="invitations-description">
                {t('creator.invitations.descriptionLabel')}{' '}
                <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
              </label>
              <input
                ref={descriptionInputRef}
                name="description"
                autoComplete="off"
                id="invitations-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('creator.invitations.descriptionPlaceholder')}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
              />
              <label className="block text-sm" htmlFor="invitations-expires">
                {t('creator.invitations.expiresLabel')}
              </label>
              <input
                name="expires_at"
                autoComplete="off"
                id="invitations-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                max={maxExpiryLocalValue()}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
                required
              />
              <label className="block text-sm" htmlFor="invitations-max-uses">
                {t('creator.invitations.maxUsesLabel')}
              </label>
              <input
                name="max_uses"
                autoComplete="off"
                id="invitations-max-uses"
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                disabled={unlimited || submitting}
                className={unlimited || submitting ? inputDisabled : inputBase}
                required={!unlimited}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="unlimited"
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  disabled={submitting}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                />
                {t('creator.invitations.unlimitedLabel')}
              </label>
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
          label={t('creator.invitations.listTitle')}
          meta={loading ? undefined : t('creator.invitations.count', { count: total })}
          aside={
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={handleSortDirChange}
              onSortByChange={handleSortByChange}
              search={search}
              onSearchChange={handleSearchChange}
              sortLabels={{ name: t('creator.invitations.descriptionLabel') }}
            />
          }
          footer={
            totalPages > 1 ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : undefined
          }
          flush
        >
          {revealedToken && (
            <div className="space-y-2 border-b border-l-4 border-panel-line border-l-accent bg-accent/5 px-5 py-4">
              <p className="text-sm font-semibold text-paper-ink dark:text-fg">
                {t('creator.invitations.tokenRevealTitle')}
              </p>
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('creator.invitations.tokenRevealWarning')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  translate="no"
                  className="min-w-0 flex-1 break-all rounded-sm border border-paper-line bg-field px-3 py-2 font-mono text-xs dark:border-line"
                >
                  {revealedToken}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopy(revealedToken)}
                  className={btnPrimary}
                >
                  {t('creator.invitations.copyButton')}
                </button>
              </div>
            </div>
          )}
          {!loading && tokens.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
              {search
                ? t('common.toolbar.noSearchResults', { query: search })
                : t('creator.invitations.noTokensMessage')}
            </p>
          )}
          {tokens.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th className={panelTh}>{t('creator.invitations.roleLabel')}</th>
                    <th className={panelTh}>{t('creator.invitations.descriptionLabel')}</th>
                    <th className={panelTh}>{t('creator.invitations.columnUsage')}</th>
                    <th className={panelTh}>{t('creator.invitations.columnToken')}</th>
                    <th className={panelTh}>{t('creator.invitations.columnTags')}</th>
                    <th className={panelActionsTh}>{t('common.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {tokens.map((item) => (
                    <tr key={item.id} className={panelTr}>
                      <td className={panelTd}>
                        <span className="font-semibold text-paper-ink dark:text-fg">
                          {t(ROLE_LABEL_KEYS[item.role as TokenRole])}
                        </span>
                      </td>
                      <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                        {item.description}
                      </td>
                      <td
                        className={`${panelTd} text-sm tabular-nums text-paper-ink/70 dark:text-fg-muted`}
                      >
                        {item.max_uses === null
                          ? t('creator.invitations.usageLabelUnlimited', {
                              count: item.redemption_count,
                            })
                          : t('creator.invitations.usageLabel', {
                              count: item.redemption_count,
                              max: item.max_uses,
                            })}
                        {' · '}
                        {item.revoked_at
                          ? t('creator.invitations.statusRevoked')
                          : t('creator.invitations.statusActive')}
                      </td>
                      <td className={panelTd}>
                        <div className="flex items-center gap-2">
                          <code
                            translate="no"
                            className="break-all rounded-sm border border-paper-line bg-field px-2 py-1 font-mono text-xs dark:border-line"
                          >
                            {item.token}
                          </code>
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.token)}
                            aria-label={t('creator.invitations.copyTokenLabel')}
                            title={t('creator.invitations.copyTokenLabel')}
                            className={btnNeutralIconBare}
                          >
                            <DuplicateIcon />
                          </button>
                        </div>
                      </td>
                      <td className={panelTd}>
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <TagChip
                              key={tag.id}
                              name={tag.name}
                              color={tag.color}
                              customHex={tag.custom_hex}
                            />
                          ))}
                        </div>
                      </td>
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          <EditButton
                            ref={(node) => {
                              if (node) editTagsTriggerRef.current.set(item.id, node)
                              else editTagsTriggerRef.current.delete(item.id)
                            }}
                            onClick={() => openTagModal(item)}
                            label={t('creator.invitations.editTagsTitle')}
                          />
                          {!item.revoked_at && (
                            <IconButton
                              onClick={() => handleRevoke(item)}
                              label={t('creator.invitations.revokeButton')}
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

      {policy.data?.email_invitations_available && <EmailInvitationsSection ttxId={activeTtxId} />}

      {editingTagsFor && (
        <Modal titleId="invitation-tags-title" onClose={closeTagModal}>
          <h2
            id="invitation-tags-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('creator.invitations.editTagsTitle')}
          </h2>
          <TagAssignmentField
            availableTags={availableTags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSaveTags()}
              disabled={tagSubmitting}
              className={`flex-1 ${btnPrimary}`}
            >
              {tagSubmitting ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
            <button type="button" onClick={closeTagModal} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
