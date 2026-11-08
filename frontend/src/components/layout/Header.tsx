import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import logoIsotopoDark from '../../assets/logos/logo-isotopo-dark.svg'
import logoIsotopoLight from '../../assets/logos/logo-isotopo-light.svg'
import logoModoDark from '../../assets/logos/logo-modo-dark.svg'
import logoModoLight from '../../assets/logos/logo-modo-light.svg'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useConfirmDiscardChanges } from '../../hooks/useUnsavedChangesWarning'
import { findAvatarPreset } from '../../lib/avatarPresets'
import { isGlossaryTerm } from '../../lib/glossary'
import { GlossaryPanel } from '../common/GlossaryPanel'
import { AssistantPendingMenu } from './AssistantPendingMenu'
import { AboutDialog } from './AboutDialog'
import { ContextBar } from './ContextBar'

function HelpIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </svg>
  )
}

/** True when a key press is typing, not a shortcut. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

const menuItemClass =
  'block px-3 py-2 text-sm text-paper-ink hover:bg-hover focus-visible:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-fg dark:text-fg'

export function Header() {
  const { t } = useTranslation()
  const { user, logout, organizations } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const confirmDiscard = useConfirmDiscardChanges()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  // The glossary serves every role from every screen. Open state is local
  // (the header outlives navigation inside a layout, so the panel stays
  // open while the user moves between sections); `?glossary=EEG` only
  // deep-links a term on first render.
  const [glossaryHighlight] = useState(() => {
    const term = new URLSearchParams(location.search).get('glossary')
    return term !== null && isGlossaryTerm(term) ? term : null
  })
  const [glossaryOpen, setGlossaryOpen] = useState(() =>
    new URLSearchParams(location.search).has('glossary'),
  )
  const glossaryTriggerRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // WAI-ARIA menu button: focus moves into the menu on open, and a click
  // anywhere outside the trigger + menu closes it.
  useEffect(() => {
    if (!avatarOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [avatarOpen])

  // "?" anywhere outside a text field toggles the glossary.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      event.preventDefault()
      setGlossaryOpen((open) => !open)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function closeGlossary() {
    setGlossaryOpen(false)
    glossaryTriggerRef.current?.focus()
  }

  function closeMenu() {
    setAvatarOpen(false)
    triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setAvatarOpen(true)
    }
  }

  // Arrow/Home/End roving focus across the items, Escape returns focus to
  // the trigger, Tab closes the menu and lets focus move on naturally.
  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    } else if (event.key === 'Tab') {
      setAvatarOpen(false)
      return
    }
    if (next !== null) {
      event.preventDefault()
      items[next]?.focus()
    }
  }

  // The menu item that opened the dialog is gone by the time it closes, so
  // focus goes back to the menu's trigger.
  function closeAbout() {
    setAboutOpen(false)
    triggerRef.current?.focus()
  }

  async function handleLogout() {
    setAvatarOpen(false)
    if (!confirmDiscard()) return
    await logout()
    navigate('/login')
  }

  return (
    <header className="flex shrink-0 flex-col border-b border-paper-line dark:border-line">
      <div className="flex h-20 items-center justify-between px-4">
        {/* "/" lets Home() resolve the landing route -- the one place
            that logic lives: mid-session, the page last worked on (back
            from Preferences); otherwise the saved default context, else
            the first available. */}
        <Link
          to="/"
          className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          <img
            src={theme === 'dark' ? logoModoDark : logoModoLight}
            alt={t('common.app.name')}
            width={640}
            height={240}
            className="hidden h-16 w-auto lg:block"
          />
          <img
            src={theme === 'dark' ? logoIsotopoDark : logoIsotopoLight}
            alt={t('common.app.name')}
            width={240}
            height={240}
            className="h-10 w-10 lg:hidden"
          />
        </Link>
        <div className="flex items-center gap-3">
          <AssistantPendingMenu />
          <button
            ref={glossaryTriggerRef}
            type="button"
            onClick={() => setGlossaryOpen((open) => !open)}
            aria-expanded={glossaryOpen}
            aria-controls={glossaryOpen ? 'glossary-panel' : undefined}
            aria-keyshortcuts="?"
            aria-label={t('glossary.open')}
            title={`${t('glossary.open')} (?)`}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-paper-ink/70 hover:bg-hover hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg aria-expanded:text-accent-fg dark:text-fg-muted dark:hover:text-fg dark:aria-expanded:text-accent-fg"
          >
            <HelpIcon />
          </button>
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setAvatarOpen((open) => !open)}
              onKeyDown={handleTriggerKeyDown}
              aria-haspopup="menu"
              aria-expanded={avatarOpen}
              aria-controls={avatarOpen ? 'account-menu' : undefined}
              aria-label={t('nav.accountMenu')}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:ring-offset-2 focus-visible:ring-offset-paper dark:focus-visible:ring-offset-ink"
            >
              {user?.avatar_kind === 'preset' &&
              user.avatar_value &&
              findAvatarPreset(user.avatar_value) ? (
                <img
                  width={32}
                  height={32}
                  src={findAvatarPreset(user.avatar_value)!.src}
                  alt=""
                  className="h-full w-full"
                />
              ) : user?.avatar_kind === 'upload' && user.avatar_value ? (
                <img
                  width={32}
                  height={32}
                  src={user.avatar_value}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.full_name.charAt(0).toUpperCase()
              )}
            </button>
            {avatarOpen && (
              <div
                ref={menuRef}
                id="account-menu"
                role="menu"
                aria-label={t('nav.accountMenu')}
                onKeyDown={handleMenuKeyDown}
                className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-paper-line bg-paper-surface-raised py-1 shadow-lg shadow-black/10 dark:border-line dark:bg-surface-raised dark:shadow-none"
              >
                <Link
                  to="/account/settings/general"
                  onClick={() => setAvatarOpen(false)}
                  role="menuitem"
                  tabIndex={-1}
                  className={menuItemClass}
                >
                  {t('nav.settings')}
                </Link>
                {user?.can_found_organization !== false && (
                  <Link
                    to="/account/organizations/new"
                    onClick={() => setAvatarOpen(false)}
                    role="menuitem"
                    tabIndex={-1}
                    className={menuItemClass}
                  >
                    {t(
                      organizations.length > 0
                        ? 'nav.createNewOrganization'
                        : 'nav.createOrganization',
                    )}
                  </Link>
                )}
                {user?.is_instance_admin && (
                  <Link
                    to="/platform"
                    onClick={() => setAvatarOpen(false)}
                    role="menuitem"
                    tabIndex={-1}
                    className={menuItemClass}
                  >
                    {t('nav.platform')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAvatarOpen(false)
                    setAboutOpen(true)
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  className={`w-full text-left ${menuItemClass}`}
                >
                  {t('nav.about', { name: t('common.app.name') })}
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  role="menuitem"
                  tabIndex={-1}
                  className={`w-full text-left ${menuItemClass}`}
                >
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ContextBar />
      {aboutOpen && <AboutDialog onClose={closeAbout} />}
      {glossaryOpen && (
        <GlossaryPanel id="glossary-panel" highlight={glossaryHighlight} onClose={closeGlossary} />
      )}
    </header>
  )
}
