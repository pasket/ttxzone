import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'

import { RouteBoundary } from '../common/RouteBoundary'

import { useNavCollapsed } from '../../hooks/useNavCollapsed'
import { PLATFORM_SECTIONS, type SectionDef } from '../../lib/navSections'

import { EmailReconfirmBanner } from '../common/EmailReconfirmBanner'
import { Header } from './Header'
import { MobileSectionNav, SectionNav } from './PrimaryNav'

const linkTo = (s: SectionDef) => `/platform/${s.path}`

/** Platform, the instance administrator's workspace (avatar menu ->
 * Platform): the same shell as a module -- Header, section menu, content
 * cap -- but above every organization, so it isn't one of the modules
 * the ContextBar's Role selector switches between (the bar shows the
 * instance as its scope instead). It never becomes the remembered
 * workspace: the logo is the way back to the organization's work, so it
 * leads to the module page left before Platform (lib/lastWorkspace.ts). */
export function PlatformLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const nav = useNavCollapsed()
  const activeSection = pathname.split('/')[2]

  return (
    <div className="flex min-h-screen flex-col bg-paper text-paper-ink dark:bg-ink dark:text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        {t('common.skipToContent')}
      </a>
      <Header />
      <EmailReconfirmBanner />
      <div className="flex flex-1 flex-col lg:flex-row">
        <SectionNav
          collapsed={nav.collapsed}
          onToggle={nav.toggle}
          sections={PLATFORM_SECTIONS}
          activeSection={activeSection}
          linkTo={linkTo}
        />
        {/* Same content cap as AuthenticatedLayout, folded or not. */}
        <main id="main-content" className="min-w-0 flex-1 pb-16 lg:pb-0">
          <div className={`p-6 ${nav.collapsed ? 'max-w-[1736px]' : 'max-w-[1584px]'}`}>
            <RouteBoundary>
              <Outlet />
            </RouteBoundary>
          </div>
        </main>
      </div>
      <MobileSectionNav
        sections={PLATFORM_SECTIONS}
        activeSection={activeSection}
        linkTo={linkTo}
      />
    </div>
  )
}
