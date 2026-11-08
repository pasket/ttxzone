/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const AXE_OPTIONS = {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  rules: {
    // Experimental, and it counts decorative glyphs marked aria-hidden (A−
    // A+, a list icon) as visible text; symbols are exempt from WCAG 2.5.3.
    'label-content-name-mismatch': { enabled: false },
    // Not WCAG rules, but what a screen reader moves around the page with.
    'landmark-no-duplicate-main': { enabled: true },
    'landmark-main-is-top-level': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
  },
}

/** The screen as it stands, in both themes: an open dialog stays open. */
export async function check(page: Page, name: string) {
  // Colours fade between themes, and rows out of view only start when axe
  // scrolls to them: it would measure them halfway.
  // A constructed sheet: the deployment's CSP refuses an inline one.
  await page.evaluate(() => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('* { transition: none !important; }')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  })
  for (const dark of [true, false]) {
    await page.evaluate((on) => {
      document.documentElement.classList.toggle('dark', on)
      // At the top, or the sticky band covers what it scrolled over.
      window.scrollTo(0, 0)
    }, dark)
    const { violations } = await new AxeBuilder({ page }).options(AXE_OPTIONS).analyze()
    const found = violations.flatMap((violation) =>
      violation.nodes.map((node) =>
        `${violation.id}: ${node.target.join(' ')} ${node.any[0]?.message ?? ''}`.slice(0, 260),
      ),
    )
    expect.soft(found, `${name}, ${dark ? 'dark' : 'light'} theme`).toEqual([])
  }
}
