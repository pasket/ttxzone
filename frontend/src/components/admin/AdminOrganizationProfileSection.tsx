import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { initials } from '../../lib/initials'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  linkAccent,
  optionalSuffix,
} from '../../lib/buttonStyles'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useEditModeParam } from '../../hooks/useEditModeParam'
import { useToast } from '../../hooks/useToast'
import { sameIds, useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import type {
  OrganizationProfile,
  OrganizationSummary,
  OrganizationTag,
  OrganizationTagListResponse,
  ProgramManagerListResponse,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { PencilIcon } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { ImageUploadField } from '../common/ImageUploadField'
import { Modal } from '../common/Modal'
import { SectionHeader } from '../common/SectionHeader'
import { TagAssignmentField } from '../common/TagAssignmentField'
import { TagChip } from '../common/TagChip'
import { panelClass, textFaint, textPrimary, textSecondary } from '../dashboard/styles'
import { panelFormFields } from '../../lib/panelStyles'
import { AdminOrganizationDashboard } from './AdminOrganizationDashboard'

/** The profile page's identity panel: who this organization is (logo,
 * name, alias, domain, Program Manager count, applied tags) plus the two
 * page-level actions.
 * The actions are omitted while the profile is being edited, so the band stays
 * as read-only context above the form. */
function OrganizationIdentityBand({
  organization,
  appliedTags,
  tagsLoading,
  programManagerCount,
  editButtonRef,
  onEdit,
  onDelete,
}: {
  organization: OrganizationSummary
  appliedTags: OrganizationTag[]
  tagsLoading: boolean
  /** null while loading or if the count couldn't be fetched. */
  programManagerCount: number | null
  editButtonRef?: React.Ref<HTMLButtonElement>
  onEdit?: () => void
  onDelete?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const { t } = useTranslation()
  const name = organization.organization_name
  return (
    <section
      aria-label={name}
      className={`${panelClass} flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-4">
        {organization.logo_url ? (
          <img
            width={48}
            height={48}
            src={organization.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md border border-paper-line object-cover dark:border-line"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-paper-line bg-hover text-sm font-semibold dark:border-line ${textSecondary}`}
          >
            {initials(name)}
          </span>
        )}
        <div className="min-w-0 space-y-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              translate="no"
              className={`min-w-0 text-xl font-semibold tracking-tight wrap-anywhere ${textPrimary}`}
            >
              {name}
            </span>
            {organization.alias && (
              <span translate="no" className={`min-w-0 text-base wrap-anywhere ${textSecondary}`}>
                {organization.alias}
              </span>
            )}
          </p>
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('admin.organization.domainLabel')}</dt>
              <dd className={`text-sm ${textPrimary}`}>{organization.domain ?? '—'}</dd>
            </div>
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>
                {t('admin.organization.programManagerCount')}
              </dt>
              <dd className={`text-sm tabular-nums ${textPrimary}`}>
                {programManagerCount ?? '—'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('admin.organization.tagsLabel')}</dt>
              <dd className="flex min-h-5 flex-wrap gap-1.5">
                {!tagsLoading && appliedTags.length === 0 && (
                  <span className={`text-sm ${textFaint}`}>{t('admin.organization.noTags')}</span>
                )}
                {appliedTags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    customHex={tag.custom_hex}
                  />
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      {onEdit && onDelete && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            ref={editButtonRef}
            type="button"
            onClick={onEdit}
            className={`${btnSecondary} inline-flex h-9 items-center gap-2 py-0`}
          >
            <PencilIcon />
            {t('admin.organization.editProfile')}
          </button>
          <IconButton
            label={t('admin.organization.deleteOrganizationLabel', { name })}
            onClick={onDelete}
          />
        </div>
      )}
    </section>
  )
}

/** Admin -> Organization: the profile of the organization selected in the
 * ContextBar (never a list -- the bar already picks the one org in play).
 * View mode is the identity band + the organization's dashboard; Edit
 * swaps the dashboard for one profile panel with a single commit point
 * (Save changes) -- the logo and which tags the organization carries too
 * are staged until Save -- followed by the organization's tag library,
 * whose changes apply immediately. Program Managers live in their own Admin
 * section (AdminProgramManagersSection). */
export function AdminOrganizationProfileSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh, activeOrganization } = useAuth()
  const navigate = useNavigate()
  const organization = activeOrganization?.is_program_manager ? activeOrganization : null
  const organizationId = organization?.organization_id ?? null

  const tagsResource = useApiResource<OrganizationTagListResponse>(
    organizationId ? `/organizations/${organizationId}/tags?limit=200&offset=0` : null,
  )
  // Only the count is shown here; managing them lives in Admin -> Program Managers.
  const programManagersResource = useApiResource<ProgramManagerListResponse>(
    organizationId ? `/organizations/${organizationId}/program-managers` : null,
  )
  const programManagerCount = programManagersResource.data?.items.length ?? null
  const orgTags = tagsResource.data?.items ?? []
  const appliedTags = orgTags.filter((tag) => tag.applied)
  const appliedTagIds = appliedTags.map((tag) => tag.id)

  const { editing, openEditing, closeEditing: closeEditParam } = useEditModeParam()
  const [profile, setProfile] = useState<OrganizationProfile | null>(null)
  // Edit mode lives in the URL (?edit=1); the form shows once its data is in.
  const open = editing && profile !== null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taxId, setTaxId] = useState('')
  const [alias, setAlias] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Logo changes are staged until Save: a picked file (previewed through an
  // object URL) or a pending removal of the current logo.
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrgTagIds, setSelectedOrgTagIds] = useState<Set<string>>(new Set())
  const editTriggerRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)

  // The Edit trigger unmounts while the form is open, so returning focus to
  // it must wait until `open` has actually flipped back to false.
  useEffect(() => {
    if (open) {
      nameInputRef.current?.focus()
    } else if (wasOpenRef.current) {
      editTriggerRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  // Entering edit mode (button, reload or deep link) loads the profile
  // fresh -- only after the org's tags are in, so the Tags checkboxes start
  // from what's really applied rather than an empty set Save would apply.
  const tagsReady = tagsResource.data !== null
  // The URL update that closes edit mode lands in a transition, after the
  // form state is cleared: without this, that in-between render (still
  // ?edit=1, no profile) would load the profile again and reopen the form.
  const closingRef = useRef(false)
  useEffect(() => {
    if (!editing) {
      closingRef.current = false
      return
    }
    if (closingRef.current || profile !== null || !tagsReady || !organizationId) return
    let cancelled = false
    async function loadProfile() {
      setError(null)
      try {
        const data = await apiFetch<OrganizationProfile>(`/organizations/${organizationId}`)
        if (cancelled) return
        setProfile(data)
        setName(data.name)
        setDescription(data.description ?? '')
        setTaxId(data.tax_id ?? '')
        setAlias(data.alias ?? '')
        setSelectedOrgTagIds(new Set(appliedTagIds))
        setLogoFile(null)
        setLogoObjectUrl(null)
        setLogoRemoved(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
        }
      }
    }
    void loadProfile()
    return () => {
      cancelled = true
    }
    // appliedTagIds is read once, when the edit session starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, profile, tagsReady, organizationId, t])

  // Revoke each staged preview URL once it's replaced, cleared or unmounted.
  useEffect(() => {
    if (!logoObjectUrl) return
    return () => URL.revokeObjectURL(logoObjectUrl)
  }, [logoObjectUrl])

  // Unsaved edits, compared against the profile fetched when editing began.
  const formDirty =
    open &&
    profile !== null &&
    (name !== profile.name ||
      description !== (profile.description ?? '') ||
      taxId !== (profile.tax_id ?? '') ||
      alias !== (profile.alias ?? '') ||
      logoFile !== null ||
      logoRemoved ||
      !sameIds(
        selectedOrgTagIds,
        appliedTags.map((tag) => tag.id),
      ))
  useUnsavedChangesWarning(formDirty)

  if (!organization || !organizationId) return null

  function closeEditing() {
    setProfile(null)
    setSelectedOrgTagIds(new Set())
    setLogoFile(null)
    setLogoObjectUrl(null)
    setLogoRemoved(false)
    setError(null)
    closingRef.current = true
    closeEditParam()
  }

  async function handleSaveDescription(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim().length === 0) {
      setError(t('admin.organization.nameRequiredError'))
      nameInputRef.current?.focus()
      return
    }
    setSubmitting(true)
    try {
      await apiFetch<OrganizationProfile>(`/organizations/${organizationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          tax_id: taxId.trim() || null,
          alias: alias.trim() || null,
        }),
      })
      await apiFetch<OrganizationTagListResponse>(`/organizations/${organizationId}/tags/apply`, {
        method: 'PUT',
        // A tag deleted from the library meanwhile is dropped, not sent.
        body: JSON.stringify({
          tag_ids: Array.from(selectedOrgTagIds).filter((id) =>
            orgTags.some((tag) => tag.id === id),
          ),
        }),
      })
      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        await apiFetch<OrganizationProfile>(`/organizations/${organizationId}/logo`, {
          method: 'POST',
          body: formData,
        })
      } else if (logoRemoved && profile?.logo_url) {
        await apiFetch<OrganizationProfile>(`/organizations/${organizationId}/logo`, {
          method: 'DELETE',
        })
      }
      closeEditing()
      tagsResource.refetch()
      // The band reads name/alias/domain/logo off the auth snapshot.
      void refresh()
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogoChange(file: File) {
    setLogoFile(file)
    setLogoObjectUrl(URL.createObjectURL(file))
    setLogoRemoved(false)
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoObjectUrl(null)
    setLogoRemoved(true)
  }

  function openDeleteModal(event: React.MouseEvent<HTMLButtonElement>) {
    deleteTriggerRef.current = event.currentTarget
    setDeleteOpen(true)
    setDeleteConfirmation('')
    setDeleteError(null)
  }

  function closeDeleteModal() {
    setDeleteOpen(false)
    setDeleteConfirmation('')
    deleteTriggerRef.current?.focus()
  }

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault()
    setDeleteError(null)
    setDeleting(true)
    try {
      await apiFetch(`/organizations/${organizationId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })
      setDeleteOpen(false)
      showToast(t('common.toast.savedSuccess'))
      // The active org is gone: reload the snapshot (reseeds the active
      // org) and let Home() pick the module for whatever org is left.
      await refresh()
      navigate('/')
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {!open && (
        <AdminOrganizationDashboard
          organizationId={organizationId}
          title={t('admin.organization.title')}
          summary={
            <>
              <OrganizationIdentityBand
                organization={organization}
                appliedTags={appliedTags}
                tagsLoading={tagsResource.loading}
                programManagerCount={programManagerCount}
                editButtonRef={editTriggerRef}
                onEdit={openEditing}
                onDelete={openDeleteModal}
              />
              {error && (
                <p className="text-sm text-danger-fg" aria-live="polite">
                  {error}
                </p>
              )}
            </>
          }
        />
      )}

      {open && profile && (
        <>
          <SectionHeader title={t('admin.organization.title')} />
          <OrganizationIdentityBand
            organization={organization}
            appliedTags={appliedTags}
            tagsLoading={tagsResource.loading}
            programManagerCount={programManagerCount}
          />
          <form
            onSubmit={handleSaveDescription}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeEditing()
            }}
            aria-labelledby="org-edit-title"
            className={panelClass}
          >
            {/* Full-width panel (see panelStyles' width rule); the short
                fields keep a readable column, the description takes the
                panel's width. */}
            <div className="space-y-6 p-5">
              <h2
                id="org-edit-title"
                className={`text-balance text-lg font-semibold tracking-tight ${textPrimary}`}
              >
                {t('admin.organization.editProfile')}
              </h2>
              <div className={`${panelFormFields} space-y-6`}>
                <ImageUploadField
                  label={t('admin.organization.logoLabel')}
                  previewUrl={logoRemoved ? null : (logoObjectUrl ?? profile.logo_url)}
                  fallback={initials(name.trim() || profile.name)}
                  onFileSelect={handleLogoChange}
                  onRemove={handleRemoveLogo}
                  uploadLabel={t('admin.organization.uploadLogo')}
                  removeLabel={t('admin.organization.removeLogo')}
                  size="h-16 w-16"
                  shape="square"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm text-paper-ink dark:text-fg" htmlFor="org-name">
                      {t('admin.organization.nameLabel')}
                    </label>
                    <input
                      name="name"
                      autoComplete="organization"
                      ref={nameInputRef}
                      id="org-name"
                      required
                      maxLength={255}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="block text-sm text-paper-ink dark:text-fg"
                      htmlFor="org-alias"
                    >
                      {t('admin.organization.aliasLabel')}{' '}
                      <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
                    </label>
                    <input
                      name="alias"
                      autoComplete="off"
                      id="org-alias"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="block text-sm text-paper-ink dark:text-fg"
                      htmlFor="org-tax-id"
                    >
                      {t('admin.organization.taxIdLabel')}{' '}
                      <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
                    </label>
                    <input
                      name="tax_id"
                      autoComplete="off"
                      id="org-tax-id"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-sm text-paper-ink dark:text-fg"
                  htmlFor="org-description"
                >
                  {t('admin.organization.descriptionLabel')}{' '}
                  <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
                </label>
                <textarea
                  name="description"
                  autoComplete="off"
                  id="org-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('admin.organization.descriptionPlaceholder')}
                  rows={6}
                  className={inputBase}
                />
              </div>
              <div className={`${panelFormFields} space-y-1.5`}>
                <span className="block text-sm text-paper-ink dark:text-fg">
                  {t('admin.organization.tagsLabel')}
                </span>
                {orgTags.length > 0 ? (
                  <TagAssignmentField
                    availableTags={orgTags}
                    selectedTagIds={selectedOrgTagIds}
                    onChange={setSelectedOrgTagIds}
                  />
                ) : (
                  <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                    {t('admin.organization.noTagsYet')}
                  </p>
                )}
                <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('admin.organization.tagsHint')}{' '}
                  <Link to="/admin/library/tags?tab=organization" className={linkAccent}>
                    {t('common.manageTags')}
                  </Link>
                </p>
              </div>
              {error && (
                <p className="text-sm text-danger-fg" aria-live="polite">
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-paper-line px-5 py-4 dark:border-line">
              <button type="button" onClick={closeEditing} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? <ButtonSpinner /> : t('admin.organization.saveProfile')}
              </button>
            </div>
          </form>
        </>
      )}

      {deleteOpen && (
        <Modal titleId="delete-org-title" onClose={closeDeleteModal}>
          <form onSubmit={handleDelete} className="w-full max-w-sm space-y-3">
            <h2
              id="delete-org-title"
              className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
            >
              {t('admin.organization.deleteTitle')}
            </h2>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('admin.organization.deleteWarning', { name: organization.organization_name })}
            </p>
            <label
              className="block text-sm text-paper-ink dark:text-fg"
              htmlFor="delete-org-confirm"
            >
              {t('admin.organization.deleteConfirmLabel', { name: organization.organization_name })}
            </label>
            <input
              name="confirmation"
              id="delete-org-confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className={inputBase}
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deleting || deleteConfirmation !== organization.organization_name}
                className={`flex-1 ${btnDanger}`}
              >
                {deleting ? <ButtonSpinner /> : t('admin.organization.deleteSubmit')}
              </button>
              <button type="button" onClick={closeDeleteModal} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
