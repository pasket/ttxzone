import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** The browser tab's title, from the page's own `h1` (every page has one):
 * "{page} · {context} · TTX-Zone". Two tabs on two exercises, or the
 * Control center and the Playground, then tell themselves apart, and a
 * screen reader announces where a navigation landed. Called once, by each
 * layout; it follows the heading as the page loads or changes. */
export function usePageTitle(context?: string | null) {
  const { t } = useTranslation()
  const app = t('common.app.name')
  useEffect(() => {
    const apply = () => {
      const page = document.querySelector('h1')?.textContent?.trim()
      const next = [page, context, app].filter(Boolean).join(' · ')
      if (document.title !== next) document.title = next
    }
    apply()
    if (typeof MutationObserver !== 'function') return
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [context, app])
}
