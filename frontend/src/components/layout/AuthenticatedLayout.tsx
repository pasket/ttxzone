import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'

import { RouteBoundary } from '../common/RouteBoundary'

import { useAuth } from '../../hooks/useAuth'
import { useNavCollapsed } from '../../hooks/useNavCollapsed'
import { rememberWorkspace } from '../../lib/lastWorkspace'
import { isModuleRoute } from '../../lib/moduleAccess'

import { EmailReconfirmBanner } from '../common/EmailReconfirmBanner'
import { RoleInvitationsNotice } from '../common/RoleInvitationsNotice'
import { Header } from './Header'
import { MobileBottomNav, PrimaryNav } from './PrimaryNav'

export function AuthenticatedLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  const nav = useNavCollapsed()

  // The page being worked on, for coming back to it from Preferences.
  useEffect(() => {
    if (user && isModuleRoute(pathname)) rememberWorkspace(user.id, pathname + search)
  }, [user, pathname, search])

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
      <RoleInvitationsNotice />
      <div className="flex flex-1 flex-col lg:flex-row">
        <PrimaryNav collapsed={nav.collapsed} onToggle={nav.toggle} />
        {/* min-w-0: a flex item defaults to its min-content width, so a wide
         * row (the phase strip, the storyline) would push the page past the
         * viewport instead of scrolling inside its own panel. */}
        <main id="main-content" className="min-w-0 flex-1 pb-16 lg:pb-0">
          {/* Single point of control for content width across every module
           * screen (Admin/Creator/Execution all render through this one
           * Outlet) -- left-aligned against the sidebar, not centered,
           * matching the dashboard convention this app already follows
           * (Splunk/Linear-style). Without this, a list with no width cap
           * of its own (e.g. CreatorExercisesSection's <ul>) stretches
           * edge to edge on an ultra-wide monitor, pushing justify-between
           * row content thousands of pixels apart. The cap is 1584px
           * (99rem, the usual fluid-grid maximum): below it the page fills
           * the space beside the menu, above it eye travel stays bounded.
           * Folding the menu into its icon rail hands the content the
           * width it gave back (216px -> 64px, +152px), so menu + content
           * keep the same right edge folded or not. Long text caps itself
           * (form fields, max-w-prose), never its panel. */}
          <div className={nav.collapsed ? 'max-w-[1736px]' : 'max-w-[1584px]'}>
            <RouteBoundary>
              <Outlet />
            </RouteBoundary>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
