import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { inputDisabled } from '../../lib/buttonStyles'
import { LocaleSwitcher } from '../layout/LocaleSwitcher'
import { Panel } from '../common/Panel'
import { AvatarPicker } from './AvatarPicker'

const rowClass = 'flex items-center justify-between gap-4'
const themeOptionFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-fg'

export function AccountSettingsGeneral() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <div className="w-full max-w-xl space-y-6">
      <Panel title={t('account.settings.profileTitle')}>
        <div className={rowClass}>
          <label htmlFor="settings-email" className="text-sm text-paper-ink dark:text-fg">
            {t('auth.login.emailLabel')}
          </label>
          <input
            name="email"
            id="settings-email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={user?.email ?? ''}
            disabled
            className={`${inputDisabled} max-w-[16rem]`}
          />
        </div>
        <AvatarPicker />
      </Panel>
      <Panel title={t('account.settings.appearanceTitle')}>
        <div className={rowClass}>
          <span className="text-sm text-paper-ink dark:text-fg">{t('nav.language')}</span>
          <LocaleSwitcher />
        </div>
        <div className={rowClass}>
          <span id="settings-theme-label" className="text-sm text-paper-ink dark:text-fg">
            {t('account.settings.theme')}
          </span>
          <div
            role="group"
            aria-labelledby="settings-theme-label"
            className="inline-flex rounded-sm border border-paper-line dark:border-line"
          >
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`rounded-l-sm px-3 py-1.5 text-sm ${themeOptionFocus} ${
                theme === 'light'
                  ? 'bg-accent/10 font-semibold text-accent-fg'
                  : 'text-paper-ink/70 hover:bg-hover dark:text-fg-nav'
              }`}
            >
              {t('account.settings.themeLight')}
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`rounded-r-sm px-3 py-1.5 text-sm ${themeOptionFocus} ${
                theme === 'dark'
                  ? 'bg-accent/10 font-semibold text-accent-fg'
                  : 'text-paper-ink/70 hover:bg-hover dark:text-fg-nav'
              }`}
            >
              {t('account.settings.themeDark')}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
