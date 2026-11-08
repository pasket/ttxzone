import { useTranslation } from 'react-i18next'

import { nativeOptionColors } from '../../lib/buttonStyles'

export function LocaleSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <select
      name="language"
      aria-label={t('nav.language')}
      value={i18n.resolvedLanguage}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      className={`rounded-sm border border-paper-line bg-field px-2 py-1 text-sm text-paper-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:border-line dark:text-fg ${nativeOptionColors}`}
    >
      <option value="en">{t('nav.languageEn')}</option>
      <option value="es">{t('nav.languageEs')}</option>
    </select>
  )
}
