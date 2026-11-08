import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
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
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CollapsibleFormSection } from '../common/CollapsibleFormSection'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'
import { TagAssignmentField } from '../common/TagAssignmentField'
import { TagChip } from '../common/TagChip'
import type {
  OrganizationAllowedDomain,
  OrganizationAllowedDomainListResponse,
  OrganizationTag,
  OrganizationTagListResponse,
  SortBy,
  SortDir,
} from '../../lib/types'
import { HelpText } from '../common/HelpText'

const PAGE_SIZE = 10

interface DomainScopes {
  allows_program_manager: boolean
  allows_planner: boolean
}

/** The two "Applies to" checkboxes, shared by the add form and the edit
 * modal. Each grant checks only its own flag (see is_email_domain_allowed
 * backend-side), and at least one must stay on. */
function DomainScopeFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
}: {
  idPrefix: string
  value: DomainScopes
  onChange: (next: DomainScopes) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const options = [
    { key: 'allows_planner' as const, label: t('admin.domainAllowlist.scopePlanners') },
    {
      key: 'allows_program_manager' as const,
      label: t('admin.domainAllowlist.scopeProgramManagers'),
    },
  ]
  const none = !value.allows_program_manager && !value.allows_planner
  return (
    <fieldset
      className="space-y-1.5"
      aria-describedby={none ? `${idPrefix}-scope-error` : undefined}
    >
      <legend className="text-sm">{t('admin.domainAllowlist.appliesTo')}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map((option) => (
          <label key={option.key} className="inline-flex items-center gap-2 text-sm">
            <input
              name={option.key}
              type="checkbox"
              checked={value[option.key]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [option.key]: e.target.checked })}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
            />
            {option.label}
          </label>
        ))}
      </div>
      {none && (
        <p id={`${idPrefix}-scope-error`} className="text-xs text-danger-fg">
          {t('admin.domainAllowlist.scopeRequired')}
        </p>
      )}
    </fieldset>
  )
}

const NEW_DOMAIN_SCOPES: DomainScopes = { allows_program_manager: false, allows_planner: true }

const hasScope = (scopes: DomainScopes) => scopes.allows_program_manager || scopes.allows_planner

export function AdminDomainAllowlistSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  // Every request targets the organization selected in the context bar --
  // never a server-resolved "current" one, which can't know which org a
  // multi-org Program Manager is acting on.
  const { activeOrganizationId } = useAuth()
  const orgBase = `/organizations/${activeOrganizationId}`
  const runUndoable = useUndoableAction()

  const [items, setItems] = useState<OrganizationAllowedDomain[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState()
  usePageFallback({ total, pageSize: PAGE_SIZE, ready: !loading })
  const [refreshTick, setRefreshTick] = useState(0)

  const [open, setOpen] = useState(false)
  const [domain, setDomain] = useState('')
  // New domains default to Planners only -- Program Manager is opt-in.
  const [scopes, setScopes] = useState<DomainScopes>(NEW_DOMAIN_SCOPES)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [availableTags, setAvailableTags] = useState<OrganizationTag[]>([])
  const [editingTagsFor, setEditingTagsFor] = useState<OrganizationAllowedDomain | null>(null)
  const [editScopes, setEditScopes] = useState<DomainScopes>({
    allows_program_manager: true,
    allows_planner: true,
  })
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [tagSubmitting, setTagSubmitting] = useState(false)
  const editTagsTriggerRef = useRef<Map<number, HTMLButtonElement>>(new Map())

  const createTriggerRef = useRef<HTMLButtonElement>(null)
  const domainInputRef = useRef<HTMLInputElement>(null)
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
      domainInputRef.current?.focus()
    } else if (wasOpenRef.current) {
      createTriggerRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  function closeForm() {
    setOpen(false)
  }

  useEffect(() => {
    if (!activeOrganizationId) return
    let cancelled = false
    async function loadDomains() {
      setLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        const data = await apiFetch<OrganizationAllowedDomainListResponse>(
          `${orgBase}/allowed-domains?limit=${PAGE_SIZE}&offset=${offset}&sort_dir=${sortDir}&sort_by=${sortBy}&q=${encodeURIComponent(search)}`,
        )
        if (!cancelled) {
          setItems(data.items)
          setTotal(data.total)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadDomains()
    return () => {
      cancelled = true
    }
  }, [orgBase, activeOrganizationId, page, sortDir, sortBy, search, refreshTick])

  useEffect(() => {
    if (!activeOrganizationId) return
    let cancelled = false
    async function loadTags() {
      try {
        const data = await apiFetch<OrganizationTagListResponse>(
          `${orgBase}/tags?limit=200&offset=0`,
        )
        if (!cancelled) setAvailableTags(data.items)
      } catch {
        // Degrade silently (no tag picker) rather than crash -- same
        // reasoning as AdminOrganizationProfileSection's own tags fetch.
      }
    }
    void loadTags()
    return () => {
      cancelled = true
    }
  }, [orgBase, activeOrganizationId])

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
    setError(null)

    setSubmitting(true)
    try {
      await apiFetch<OrganizationAllowedDomain>(`${orgBase}/allowed-domains`, {
        method: 'POST',
        body: JSON.stringify({ domain, ...scopes }),
      })
      setDomain('')
      setScopes(NEW_DOMAIN_SCOPES)
      closeForm()
      // A new domain is always newest -- reset to page 1 / newest-first so
      // it's guaranteed visible, and bump refreshTick to force a refetch
      // even if we were already there.
      // Only one of the two: the URL change lands in a transition, so a
      // tick bump alongside it would first refetch with the old page/sort.
      if (page === 1 && sortDir === 'desc') setRefreshTick((tick) => tick + 1)
      else setSortDir('desc')
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleRemove(item: OrganizationAllowedDomain) {
    const index = items.findIndex((i) => i.id === item.id)
    function restore() {
      setItems((prev) => {
        const next = [...prev]
        next.splice(index, 0, item)
        return next
      })
      setTotal((prev) => prev + 1)
    }
    runUndoable({
      message: t('admin.domainAllowlist.removedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setTotal((prev) => prev - 1)
      },
      onRestore: restore,
      onCommit: async () => {
        try {
          await apiFetch(`${orgBase}/allowed-domains/${item.id}`, {
            method: 'DELETE',
          })
        } catch (err) {
          restore()
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  function openTagModal(item: OrganizationAllowedDomain) {
    setEditingTagsFor(item)
    setEditScopes({
      allows_program_manager: item.allows_program_manager,
      allows_planner: item.allows_planner,
    })
    setSelectedTagIds(new Set(item.tags.map((tag) => tag.id)))
  }

  function closeTagModal() {
    setEditingTagsFor(null)
    editTagsTriggerRef.current.get(editingTagsFor?.id ?? -1)?.focus()
  }

  async function handleSaveTags() {
    if (!editingTagsFor || !hasScope(editScopes)) return
    setTagSubmitting(true)
    try {
      // One Save for both parts of the domain: what it applies to, then
      // its tags (the tags response carries the final row).
      await apiFetch<OrganizationAllowedDomain>(`${orgBase}/allowed-domains/${editingTagsFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editScopes),
      })
      const updated = await apiFetch<OrganizationAllowedDomain>(
        `${orgBase}/allowed-domains/${editingTagsFor.id}/tags`,
        { method: 'PUT', body: JSON.stringify({ tag_ids: Array.from(selectedTagIds) }) },
      )
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
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

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <CollapsibleFormSection
        open={open}
        onOpenChange={setOpen}
        triggerLabel={t('admin.domainAllowlist.addButtonShort')}
        triggerTooltip={t('admin.domainAllowlist.addButton')}
        sectionTitle={t('admin.domainAllowlist.listTitle')}
        triggerRef={createTriggerRef}
      >
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeForm()
          }}
        >
          <Panel
            title={t('admin.domainAllowlist.title')}
            description={
              <HelpText
                id="admin.domainAllowlist.description"
                text={t('admin.domainAllowlist.description')}
              />
            }
            footer={
              <div className={panelFormActions}>
                <button type="button" onClick={closeForm} className={btnSecondary}>
                  {t('common.confirmButton.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !hasScope(scopes)}
                  className={btnPrimary}
                >
                  {submitting ? <ButtonSpinner /> : t('admin.domainAllowlist.addButton')}
                </button>
              </div>
            }
          >
            <div className="max-w-sm space-y-2">
              <label className="block text-sm" htmlFor="admin-domain-allowlist-domain">
                {t('admin.domainAllowlist.domainLabel')}
              </label>
              <input
                spellCheck={false}
                autoComplete="off"
                ref={domainInputRef}
                id="admin-domain-allowlist-domain"
                name="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder={t('admin.domainAllowlist.domainPlaceholder')}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
                required
              />
              <DomainScopeFields
                idPrefix="admin-domain-allowlist-new"
                value={scopes}
                onChange={setScopes}
                disabled={submitting}
              />
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
          label={t('admin.domainAllowlist.listTitle')}
          meta={loading ? undefined : t('admin.domainAllowlist.count', { count: total })}
          aside={
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={handleSortDirChange}
              onSortByChange={handleSortByChange}
              search={search}
              onSearchChange={handleSearchChange}
              sortLabels={{ name: t('admin.domainAllowlist.domainLabel') }}
            />
          }
          footer={
            totalPages > 1 ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : undefined
          }
          flush
        >
          {!loading && items.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
              {search
                ? t('common.toolbar.noSearchResults', { query: search })
                : t('admin.domainAllowlist.noneMessage')}
            </p>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th className={panelTh}>{t('admin.domainAllowlist.domainLabel')}</th>
                    <th className={panelTh}>{t('admin.domainAllowlist.appliesTo')}</th>
                    <th className={panelTh}>{t('admin.domainAllowlist.columnTags')}</th>
                    <th className={panelActionsTh}>{t('common.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {items.map((item) => (
                    <tr key={item.id} className={panelTr}>
                      <td className={`${panelTd} text-paper-ink dark:text-fg`}>{item.domain}</td>
                      <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                        {[
                          item.allows_planner && t('admin.domainAllowlist.scopePlanners'),
                          item.allows_program_manager &&
                            t('admin.domainAllowlist.scopeProgramManagers'),
                        ]
                          .filter(Boolean)
                          .join(', ')}
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
                            label={`${t('admin.domainAllowlist.editTitle')} ${item.domain}`}
                          />
                          <IconButton
                            onClick={() => handleRemove(item)}
                            label={t('admin.domainAllowlist.removeButton')}
                          />
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

      {editingTagsFor && (
        <Modal titleId="allowed-domain-tags-title" onClose={closeTagModal}>
          <h2
            id="allowed-domain-tags-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('admin.domainAllowlist.editTitle')}
          </h2>
          <p className="text-sm font-medium text-paper-ink dark:text-fg">{editingTagsFor.domain}</p>
          <DomainScopeFields
            idPrefix="admin-domain-allowlist-edit"
            value={editScopes}
            onChange={setEditScopes}
          />
          <div className="space-y-1.5">
            <span className="block text-sm">{t('admin.domainAllowlist.tagsLabel')}</span>
            <TagAssignmentField
              availableTags={availableTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSaveTags()}
              disabled={tagSubmitting || !hasScope(editScopes)}
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
