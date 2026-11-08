import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { API_BASE, apiFetch, ApiError } from '../../lib/api'
import {
  badgeNeutral,
  btnPrimary,
  btnSecondary,
  inputBase,
  linkAccent,
  optionalSuffix,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import {
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  LegalDocumentAdminListResponse,
  LegalDocumentAdminRead,
  LegalDocumentKind,
  LegalTemplateListResponse,
  LegalVersionRead,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { FormattedText } from '../common/FormattedText'
import { FormattedTextArea } from '../common/FormattedTextArea'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'

const LANGUAGES = ['en', 'es'] as const
type Language = (typeof LANGUAGES)[number]

const LANGUAGE_LABEL_KEYS = {
  en: 'platform.legal.languages.en',
  es: 'platform.legal.languages.es',
} as const satisfies Record<Language, string>

const labelClass = 'block text-sm text-paper-ink dark:text-fg'

/** Platform -> Legal documents: the deployment's terms of service and
 * privacy policy. The operator drafts them (from the shipped templates or
 * from scratch), publishes numbered versions and decides whether a change
 * is substantial (every account accepts it again) or a minor correction.
 * While nothing is published, signup asks nothing. */
// Every acceptance, for an audit (asks for a recent sign-in: it names
// every account).
const RECORD_PATH = '/instance/legal/acceptances.csv'

export function PlatformLegalPanel() {
  const { t } = useTranslation()
  const documents = useApiResource<LegalDocumentAdminListResponse>('/instance/legal')
  const download = useApiDownload()
  const [templating, setTemplating] = useState(false)
  // Bumped when the templates replace the drafts, so each editor reloads.
  const [generation, setGeneration] = useState(0)
  // The list the templates replaced: the editors wait for the refetched
  // one, or they'd remount on the old drafts and save them back.
  const [staleList, setStaleList] = useState<LegalDocumentAdminListResponse | null>(null)
  const awaitingDrafts = staleList !== null && documents.data === staleList

  const items = documents.data?.items ?? []
  const nothingPublished = items.length > 0 && items.every((item) => item.versions.length === 0)
  // A fresh instance: nothing drafted yet, so the templates are the way in.
  const nothingWritten =
    nothingPublished && items.every((item) => !Object.values(item.draft.content).some(Boolean))

  return (
    <>
      <Panel
        title={t('platform.legal.title')}
        description={t('platform.legal.description')}
        aside={
          <button
            type="button"
            onClick={() => setTemplating(true)}
            className={nothingWritten ? btnPrimary : btnSecondary}
          >
            {t('platform.legal.fromTemplate')}
          </button>
        }
      >
        {documents.error && (
          <p className="text-sm text-danger-fg" role="alert">
            {documents.error.message}
          </p>
        )}
        {nothingPublished ? (
          <div className="space-y-1">
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.legal.nothingPublished')}
            </p>
            {nothingWritten && (
              <p className="text-sm text-pretty">{t('platform.legal.startHint')}</p>
            )}
          </div>
        ) : (
          items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('platform.legal.recordHint')}
              </p>
              <a
                href={`${API_BASE}${RECORD_PATH}`}
                download
                onClick={download(RECORD_PATH)}
                className={btnSecondary}
              >
                {t('platform.legal.record')}
              </a>
            </div>
          )
        )}
      </Panel>
      {!awaitingDrafts &&
        items.map((item) => (
          <LegalDocumentEditor
            key={`${item.kind}-${generation}`}
            document={item}
            onChanged={documents.refetch}
          />
        ))}
      {templating && (
        <TemplateModal
          replacesDrafts={items.some((item) => Object.values(item.draft.content).some(Boolean))}
          onClose={() => setTemplating(false)}
          onApplied={() => {
            setTemplating(false)
            setStaleList(documents.data)
            setGeneration((value) => value + 1)
            documents.refetch()
          }}
        />
      )}
    </>
  )
}

function LegalDocumentEditor({
  document,
  onChanged,
}: {
  document: LegalDocumentAdminRead
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const [language, setLanguage] = useState<Language>(
    (LANGUAGES as readonly string[]).includes(i18n.language) ? (i18n.language as Language) : 'en',
  )
  const [content, setContent] = useState<Record<string, string>>(document.draft.content)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const [error, setError] = useState('')

  const dirty = LANGUAGES.some(
    (lang) => (content[lang] ?? '') !== (document.draft.content[lang] ?? ''),
  )
  useUnsavedChangesWarning(dirty)
  const latest = document.versions[0] ?? null
  const title = t(LEGAL_TITLE_KEYS[document.kind])
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const id = `legal-${document.kind}`

  async function save() {
    setSaving(true)
    setError('')
    try {
      await apiFetch(`/instance/legal/${document.kind}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })
      showToast(t('platform.legal.saved', { title }))
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={title}
      meta={
        <span className="flex flex-wrap items-center gap-2">
          <span className={badgeNeutral}>
            {latest
              ? t('platform.legal.publishedVersion', {
                  version: latest.version,
                  date: dateFormat.format(new Date(latest.published_at)),
                })
              : t('platform.legal.notPublished')}
          </span>
          {(dirty || document.has_unpublished_changes) && (
            <span className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {dirty ? t('platform.legal.unsaved') : t('platform.legal.unpublished')}
            </span>
          )}
        </span>
      }
      footer={
        <div className={panelFormActions}>
          <button type="button" onClick={save} disabled={!dirty || saving} className={btnSecondary}>
            {saving ? <ButtonSpinner /> : t('platform.legal.saveDraft')}
          </button>
          <button
            type="button"
            onClick={() => setPublishing(true)}
            disabled={dirty || !document.has_unpublished_changes}
            aria-describedby={dirty ? `${id}-save-first` : undefined}
            className={btnPrimary}
          >
            {t('platform.legal.publish')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label={t('platform.legal.language')}
          className={segmentedControl}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={language === lang}
              onClick={() => setLanguage(lang)}
              className={language === lang ? segmentedOptionActive : segmentedOptionIdle}
            >
              {t(LANGUAGE_LABEL_KEYS[lang])}
            </button>
          ))}
        </div>
        <label htmlFor={`${id}-${language}`} className="sr-only">
          {t('platform.legal.textLabel', { title, language: t(LANGUAGE_LABEL_KEYS[language]) })}
        </label>
        <FormattedTextArea
          key={language}
          id={`${id}-${language}`}
          value={content[language] ?? ''}
          onChange={(value) => setContent((previous) => ({ ...previous, [language]: value }))}
          rows={16}
          maxLength={100_000}
          headings
        />
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {t('platform.legal.formatHint')}
        </p>
        {dirty && (
          <p id={`${id}-save-first`} className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('platform.legal.saveFirst')}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        {document.versions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="pb-2 text-left text-sm font-semibold">
                {t('platform.legal.history')}
              </caption>
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('platform.legal.columns.version')}</th>
                  <th className={panelTh}>{t('platform.legal.columns.published')}</th>
                  <th className={panelTh}>{t('platform.legal.columns.by')}</th>
                  <th className={panelTh}>{t('platform.legal.columns.kind')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {document.versions.map((version) => (
                  <tr key={version.version} className={panelTr}>
                    <td className={panelTd}>
                      <button
                        type="button"
                        onClick={() => setViewing(version.version)}
                        className={`tabular-nums underline-offset-2 hover:underline ${linkAccent}`}
                        aria-label={t('platform.legal.viewVersion', {
                          title,
                          version: version.version,
                        })}
                      >
                        v{version.version}
                      </button>
                    </td>
                    <td className={panelTd}>{dateFormat.format(new Date(version.published_at))}</td>
                    <td className={panelTd}>{version.published_by ?? '—'}</td>
                    <td className={panelTd}>
                      {version.requires_acceptance
                        ? t('platform.legal.substantial')
                        : t('platform.legal.minor')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {publishing && (
        <PublishModal
          document={document}
          title={title}
          onClose={() => setPublishing(false)}
          onPublished={(version) => {
            setPublishing(false)
            showToast(t('platform.legal.publishedToast', { title, version }))
            onChanged()
          }}
        />
      )}
      {viewing !== null && (
        <VersionModal
          kind={document.kind}
          title={title}
          version={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Panel>
  )
}

function PublishModal({
  document,
  title,
  onClose,
  onPublished,
}: {
  document: LegalDocumentAdminRead
  title: string
  onClose: () => void
  onPublished: (version: number) => void
}) {
  const { t } = useTranslation()
  const first = document.versions.length === 0
  const [substantial, setSubstantial] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const next = (document.versions[0]?.version ?? 0) + 1

  async function publish() {
    setSubmitting(true)
    setError('')
    try {
      await apiFetch(`/instance/legal/${document.kind}/publish`, {
        method: 'POST',
        body: JSON.stringify({ requires_acceptance: first || substantial }),
      })
      onPublished(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  return (
    <Modal titleId="legal-publish-title" onClose={onClose}>
      <h2 id="legal-publish-title" className="text-balance text-lg font-semibold tracking-tight">
        {t('platform.legal.publishTitle', { title, version: next })}
      </h2>
      {first ? (
        <p className="text-sm text-pretty">{t('platform.legal.firstVersion')}</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('platform.legal.changeKind')}</legend>
          {[true, false].map((value) => (
            <label key={String(value)} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="legal-change-kind"
                checked={substantial === value}
                onChange={() => setSubstantial(value)}
                className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
              />
              <span>
                <span className="font-medium">
                  {value ? t('platform.legal.substantial') : t('platform.legal.minor')}
                </span>
                <span className="block text-paper-ink/70 dark:text-fg-muted">
                  {value ? t('platform.legal.substantialHint') : t('platform.legal.minorHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <div className={panelFormActions}>
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('platform.legal.cancel')}
        </button>
        <button type="button" onClick={publish} disabled={submitting} className={btnPrimary}>
          {submitting ? <ButtonSpinner /> : t('platform.legal.publishConfirm')}
        </button>
      </div>
    </Modal>
  )
}

function VersionModal({
  kind,
  title,
  version,
  onClose,
}: {
  kind: LegalDocumentKind
  title: string
  version: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { data, error } = useApiResource<LegalVersionRead>(
    `/instance/legal/${kind}/versions/${version}`,
  )
  const languages = LANGUAGES.filter((lang) => data?.content[lang]?.trim())
  const [picked, setPicked] = useState<Language | null>(null)
  const language = picked && languages.includes(picked) ? picked : languages[0]

  return (
    <Modal titleId="legal-version-title" onClose={onClose} size="lg" align="top">
      <h2 id="legal-version-title" className="text-balance text-lg font-semibold tracking-tight">
        {t('platform.legal.versionTitle', { title, version })}
      </h2>
      {error && <p className="text-sm text-danger-fg">{error.message}</p>}
      {languages.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t('platform.legal.language')}
          className={segmentedControl}
        >
          {languages.map((lang) => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={language === lang}
              onClick={() => setPicked(lang)}
              className={language === lang ? segmentedOptionActive : segmentedOptionIdle}
            >
              {t(LANGUAGE_LABEL_KEYS[lang])}
            </button>
          ))}
        </div>
      )}
      {data && language && (
        <div lang={language} className="max-h-[60vh] overflow-y-auto pr-2 text-sm">
          <FormattedText text={data.content[language]} headings />
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('platform.legal.close')}
        </button>
      </div>
    </Modal>
  )
}

function TemplateModal({
  replacesDrafts,
  onClose,
  onApplied,
}: {
  replacesDrafts: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [operatorName, setOperatorName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [postalAddress, setPostalAddress] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const rendered = await apiFetch<LegalTemplateListResponse>('/instance/legal/templates', {
        method: 'POST',
        body: JSON.stringify({
          operator_name: operatorName,
          contact_email: contactEmail,
          postal_address: postalAddress,
          jurisdiction,
        }),
      })
      for (const item of rendered.items) {
        await apiFetch(`/instance/legal/${item.kind}/draft`, {
          method: 'PUT',
          body: JSON.stringify({ content: item.content }),
        })
      }
      showToast(t('platform.legal.templateApplied'))
      onApplied()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  return (
    <Modal titleId="legal-template-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 id="legal-template-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('platform.legal.templateTitle')}
        </h2>
        <p className="text-sm text-pretty">{t('platform.legal.templateIntro')}</p>
        {replacesDrafts && (
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('platform.legal.templateReplaces')}
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="legal-operator-name" className={labelClass}>
            {t('platform.legal.operatorName')}
          </label>
          <input
            id="legal-operator-name"
            name="organization"
            autoComplete="organization"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            className={inputBase}
            required
          />
          <label htmlFor="legal-contact-email" className={labelClass}>
            {t('platform.legal.contactEmail')}
          </label>
          <input
            id="legal-contact-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t('platform.legal.contactEmailPlaceholder')}
            className={inputBase}
            required
          />
          <label htmlFor="legal-postal-address" className={labelClass}>
            {t('platform.legal.postalAddress')}{' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </label>
          <input
            id="legal-postal-address"
            name="street-address"
            autoComplete="street-address"
            value={postalAddress}
            onChange={(e) => setPostalAddress(e.target.value)}
            className={inputBase}
          />
          <label htmlFor="legal-jurisdiction" className={labelClass}>
            {t('platform.legal.jurisdiction')}
          </label>
          <input
            id="legal-jurisdiction"
            name="jurisdiction"
            autoComplete="country-name"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder={t('platform.legal.jurisdictionPlaceholder')}
            className={inputBase}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className={panelFormActions}>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('platform.legal.cancel')}
          </button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? <ButtonSpinner /> : t('platform.legal.templateSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
