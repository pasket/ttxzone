import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'

import { RouteBoundary } from '../common/RouteBoundary'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useNavCollapsed } from '../../hooks/useNavCollapsed'
import { hasContextChoices } from '../../lib/moduleAccess'
import { ACCOUNT_SECTIONS, type SectionDef } from '../../lib/navSections'
import type { InstancePolicy } from '../../lib/types'
import { Header } from './Header'
import { MobileSectionNav, SectionNav } from './PrimaryNav'

const linkTo = (s: SectionDef) => `/account/settings/${s.path}`

/** Preferences isn't a real module (admin/creator/control/playground) -- it's
 * only reachable via the avatar dropdown, never listed in the Primary Menu.
 * It has the same section menu as a module or Platform (icons, folding into
 * a rail, the bottom bar on a phone), then the page. Must stay outside
 * RequireFullAccess/AuthenticatedLayout -- a `needs-mfa-enrollment` user has
 * to be able to reach Security here to complete the mandatory TOTP gate
 * before any real module unlocks. */
export function AccountSettingsLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const nav = useNavCollapsed()
  const section = pathname.split('/').pop()
  const { organizations, allTtxList } = useAuth()
  // Workspace: only when there's a default to choose (hasContextChoices).
  const showDefaults = hasContextChoices(organizations, allTtxList)
  // AI assistant: only while the deployment has it on.
  const policy = useApiResource<InstancePolicy>('/instance/policy')
  const showAssistant = policy.data?.assistant_enabled === true || section === 'assistant'
  const sections = ACCOUNT_SECTIONS.filter(
    (s) => (s.path !== 'defaults' || showDefaults) && (s.path !== 'assistant' || showAssistant),
  )
  const activeSection = sections.find((s) => s.path === section)

  return (
    <div className="flex min-h-screen flex-col bg-paper text-paper-ink dark:bg-ink dark:text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        {t('common.skipToContent')}
      </a>
      <Header />
      <div className="flex flex-1 flex-col lg:flex-row">
        <SectionNav
          collapsed={nav.collapsed}
          onToggle={nav.toggle}
          sections={sections}
          activeSection={section}
          linkTo={linkTo}
        />
        <main id="main-content" className="min-w-0 flex-1 p-6 pb-22 lg:pb-6">
          {/* Panels below are h2s; the menu already shows the page name
              visually, so the page's h1 is for assistive tech only. */}
          {activeSection && <h1 className="sr-only">{t(activeSection.titleKey)}</h1>}
          <RouteBoundary>
            <Outlet />
          </RouteBoundary>
        </main>
      </div>
      <MobileSectionNav sections={sections} activeSection={section} linkTo={linkTo} />
    </div>
  )
}
