import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { LIBRARY_KINDS, libraryPermissions, type LibraryKind } from '../../lib/libraryLevels'
import { PageTabs } from '../common/PageTabs'
import { SectionHeader } from '../common/SectionHeader'
import { ActorLibrary } from './ActorLibrary'
import { InjectLibrary } from './InjectLibrary'
import { ScenarioLibrary } from './ScenarioLibrary'
import { TagLibrary } from './TagLibrary'
import { ThreatActorLibrary } from './ThreatActorLibrary'

/** Library -> Simulated actors / Threat actors / Injects / Scenarios / Tags: what the organization and
 * its exercises configure once and reuse. Creator (Exercise Planners, with
 * the exercise in context) and Admin (Program Managers, organization only).
 * Always the context bar's organization and exercise; tabs under the title
 * switch between the kinds (each its own URL). */
export function LibrarySection({
  withExercise,
  kind = 'actors',
}: {
  withExercise: boolean
  kind?: LibraryKind
}) {
  const { t } = useTranslation()
  const { activeOrganizationId, activeOrganization, activeTtxId } = useAuth()
  const { pathname, search } = useLocation()
  if (!activeOrganizationId) return null
  // The library's own URL (/admin/library, /creator/library,
  // /creator/{ttx}/library): each kind is a path under it.
  const segments = pathname.split('/')
  const base = segments.slice(0, segments.indexOf('library') + 1).join('/')
  const key = `${activeOrganizationId}:${withExercise ? activeTtxId : ''}`
  const ttxId = withExercise ? activeTtxId : null
  const props = {
    organizationId: activeOrganizationId,
    ttxId,
    permissions: libraryPermissions(withExercise, activeOrganization?.is_program_manager ?? false),
  }
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-paper-ink/60 dark:text-fg-faint">{t('templates.title')}</p>
        <SectionHeader title={t(`templates.${kind}.title`)} />
        <PageTabs
          label={t('templates.title')}
          items={LIBRARY_KINDS.map((k) => ({
            key: k,
            to: `${base}${k === 'actors' ? '' : `/${k}`}${search}`,
            label: t(`templates.${k}.title`),
            current: k === kind,
          }))}
        />
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t(`templates.${kind}.intro`)}
        </p>
      </div>
      {kind === 'actors' && <ActorLibrary key={key} {...props} />}
      {kind === 'threats' && <ThreatActorLibrary key={key} {...props} />}
      {kind === 'injects' && <InjectLibrary key={key} {...props} />}
      {kind === 'scenarios' && <ScenarioLibrary key={key} {...props} />}
      {kind === 'tags' && <TagLibrary key={key} {...props} />}
    </div>
  )
}
