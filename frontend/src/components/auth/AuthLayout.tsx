import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import logoModoDark from '../../assets/logos/logo-modo-dark.svg'
import logoModoLight from '../../assets/logos/logo-modo-light.svg'
import { useTheme } from '../../hooks/useTheme'

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { theme } = useTheme()

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-ink p-12 text-fg lg:flex">
        <img
          src={logoModoDark}
          alt={t('common.app.name')}
          width={640}
          height={240}
          fetchPriority="high"
          className="h-auto w-80"
        />
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {t('common.app.tagline')}
          </h2>
          <p className="mt-4 text-base text-fg-muted">{t('common.app.description')}</p>
          <div className="mt-8 h-px w-24 bg-line" />
        </div>
        <span className="text-sm text-fg-faint">
          {t('common.app.name')} &copy; {new Date().getFullYear()}
        </span>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-paper px-6 py-12 text-paper-ink dark:bg-ink dark:text-fg lg:w-1/2">
        <img
          src={theme === 'dark' ? logoModoDark : logoModoLight}
          alt={t('common.app.name')}
          width={640}
          height={240}
          className="mb-8 h-auto w-64 lg:hidden"
        />
        <main className="w-full max-w-sm">{children}</main>
      </div>
    </div>
  )
}
