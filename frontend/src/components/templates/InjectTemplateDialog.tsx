import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { API_BASE } from '../../lib/api'
import { localized } from '../../lib/injectLibrary'
import { attackUrl, formatSpan } from '../../lib/msel'
import { frameworkLabel } from '../../lib/needsForm'
import { panelTableHeadRow, panelTbody, panelTd, panelTh } from '../../lib/panelStyles'
import type { RegulatoryCatalog, SystemInject } from '../../lib/types'
import { Modal } from '../common/Modal'
import { VariableText } from './VariableText'

const chipClass =
  'inline-flex items-center rounded-xs border border-panel-line px-1.5 py-0.5 text-xs text-paper-ink/80 dark:text-fg-nav'
const labelClass =
  'text-xs font-medium tracking-wide text-paper-ink/60 uppercase dark:text-fg-faint'

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className={`text-balance ${labelClass}`}>{label}</h3>
      {children}
    </div>
  )
}

/** One TTX-Zone inject in full, read-only: what players receive, from
 * whom, what's expected of them and what the facilitator needs to know. */
export function InjectTemplateDialog({
  inject,
  attackVersion,
  actorName,
  onClose,
}: {
  inject: SystemInject
  attackVersion: string
  actorName: (id: string) => string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const l = (text: { es: string; en: string }) => localized(text, spanish)
  const regulations = useApiResource<RegulatoryCatalog>(
    inject.frameworks.length ? '/regulatory-requirements' : null,
  ).data
  const scenarioVariables = new Set(Object.keys(inject.variable_defaults))

  return (
    <Modal titleId="inject-template-title" onClose={onClose} size="lg">
      <div className="space-y-2">
        <p translate="no" className="font-mono text-xs text-paper-ink/60 dark:text-fg-faint">
          {inject.id}
        </p>
        <h2
          id="inject-template-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {l(inject.title)}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <span className={chipClass}>{t(`creator.msel.kinds.${inject.kind}`)}</span>
          <span className={chipClass}>{t(`templates.injects.stages.${inject.stage}`)}</span>
          <span className={chipClass}>{t(`templates.injects.audiences.${inject.audience}`)}</span>
          {inject.families.map((family) => (
            <span key={family} className={chipClass}>
              {t(`templates.injects.families.${family}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-paper-ink/60 dark:text-fg-faint">
            {t('templates.injects.detail.from')}
          </dt>
          <dd>{actorName(inject.actor)}</dd>
          <dt className="text-paper-ink/60 dark:text-fg-faint">
            {t('templates.injects.detail.channel')}
          </dt>
          <dd>{t(`creator.msel.deliveryMethods.${inject.delivery_method}`)}</dd>
          <dt className="text-paper-ink/60 dark:text-fg-faint">
            {t('templates.injects.detail.to')}
          </dt>
          <dd>{inject.recipients.map(l).join(', ')}</dd>
        </dl>

        <Block label={t('templates.injects.detail.message')}>
          <p className="rounded-sm border border-panel-line bg-field px-3 py-2 text-sm text-pretty">
            <VariableText text={l(inject.content)} />
          </p>
        </Block>

        {(inject.images ?? []).length > 0 && (
          <Block label={t('templates.injects.detail.images')}>
            {/* What a copy brings along, in the reader's language. */}
            <div className="flex flex-wrap gap-3">
              {(inject.images ?? []).map((image) => {
                const src = `${API_BASE}/inject-catalog/${inject.id}/images/${image.index}?lang=${spanish ? 'es' : 'en'}`
                return (
                  <figure key={image.index} className="max-w-full">
                    <a href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        width={image.width}
                        height={image.height}
                        loading="lazy"
                        alt={l(image.caption)}
                        className="h-auto max-h-64 w-auto max-w-full rounded-sm border border-panel-line"
                      />
                    </a>
                    <figcaption className="mt-1 text-xs text-paper-ink/60 dark:text-fg-muted">
                      {l(image.caption)}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('templates.injects.detail.imagesHint')}
            </p>
          </Block>
        )}

        {inject.kind === 'contingent' && inject.trigger && inject.purpose && (
          <Block label={t('templates.injects.detail.contingent')}>
            <dl className="space-y-1 text-sm">
              <dd>
                {t('templates.injects.detail.contingentFor', { code: inject.contingent_for })}
              </dd>
              <dt className="text-paper-ink/60 dark:text-fg-faint">
                {t('templates.injects.detail.trigger')}
              </dt>
              <dd>
                <VariableText text={l(inject.trigger)} />
              </dd>
              <dt className="text-paper-ink/60 dark:text-fg-faint">
                {t('templates.injects.detail.purpose')}
              </dt>
              <dd>{l(inject.purpose)}</dd>
            </dl>
          </Block>
        )}

        {inject.key_question && (
          <Block label={t('templates.injects.detail.keyQuestion')}>
            <p className="border-l-2 border-accent pl-3 text-sm font-medium text-pretty">
              <VariableText text={l(inject.key_question)} />
            </p>
          </Block>
        )}

        <Block label={t('templates.injects.detail.expectedActions')}>
          <div className="overflow-x-auto rounded-sm border border-panel-line">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('templates.injects.detail.action')}</th>
                  <th className={panelTh}>{t('templates.injects.detail.role')}</th>
                  <th className={`${panelTh} text-right`}>
                    {t('templates.injects.detail.within')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {inject.expected_actions.map((action, index) => (
                  <tr key={index}>
                    <td className={`${panelTd} text-sm`}>
                      <VariableText text={l(action.description)} />
                    </td>
                    <td className={`${panelTd} text-sm`}>{l(action.responsible_role)}</td>
                    <td className={`${panelTd} text-right text-sm whitespace-nowrap tabular-nums`}>
                      {action.within_minutes === null ? '—' : formatSpan(action.within_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>

        {inject.attachments.length > 0 && (
          <Block label={t('templates.injects.detail.attachments')}>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {inject.attachments.map((attachment, index) => (
                <li key={index}>{l(attachment)}</li>
              ))}
            </ul>
          </Block>
        )}

        {inject.facilitator_notes && (
          <Block label={t('templates.injects.detail.notes')}>
            <p className="text-sm text-pretty text-paper-ink/80 dark:text-fg-muted">
              <VariableText text={l(inject.facilitator_notes)} />
            </p>
          </Block>
        )}

        <Block label={t('templates.injects.detail.capabilities')}>
          <div className="flex flex-wrap gap-1.5">
            {inject.capabilities.map((capability) => (
              <span key={capability} className={chipClass}>
                {t(`creator.needs.capabilities.${capability}`)}
              </span>
            ))}
          </div>
        </Block>

        {inject.attack.length > 0 && (
          <Block label={t('templates.injects.detail.attack', { version: attackVersion })}>
            <ul className="space-y-0.5 text-sm">
              {inject.attack.map((ref) => (
                <li key={`${ref.tactic_id}-${ref.technique_id}`}>
                  <span className="text-paper-ink/60 dark:text-fg-faint">{ref.tactic_name} · </span>
                  <a
                    href={attackUrl(attackVersion, ref.technique_id)}
                    target="_blank"
                    rel="noreferrer"
                    className={linkAccent}
                  >
                    <span translate="no" className="font-mono">
                      {ref.technique_id}
                    </span>{' '}
                    {ref.technique_name}
                  </a>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {inject.frameworks.length > 0 && (
          <Block label={t('templates.injects.detail.frameworks')}>
            <div className="flex flex-wrap gap-1.5">
              {inject.frameworks.map((framework) => (
                <span key={framework} className={chipClass}>
                  {frameworkLabel(regulations, framework, spanish)}
                </span>
              ))}
            </div>
          </Block>
        )}

        {inject.variables.length > 0 && (
          <Block label={t('templates.injects.detail.variables')}>
            <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
              {t('templates.injects.detail.variablesHint')}
            </p>
            <ul className="space-y-0.5 text-sm">
              {inject.variables.map((name) => (
                <li key={name} className="flex flex-wrap items-baseline gap-2">
                  <VariableText text={`{${name}}`} />
                  <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
                    {scenarioVariables.has(name)
                      ? t('templates.injects.detail.defaultValue', {
                          value: l(inject.variable_defaults[name]),
                        })
                      : t('templates.injects.detail.systemVariable')}
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('templates.injects.detail.close')}
        </button>
      </div>
    </Modal>
  )
}
