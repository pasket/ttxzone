import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'
import es from '../locales/es.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

// index.html's static lang="en" is only the pre-hydration default: screen
// readers pick their voice (and browsers their translate offer) from it.
const syncDocumentLang = (lng: string | undefined) => {
  if (lng) document.documentElement.lang = lng
}
syncDocumentLang(i18n.resolvedLanguage ?? i18n.language)
i18n.on('languageChanged', () => syncDocumentLang(i18n.resolvedLanguage ?? i18n.language))

export default i18n
