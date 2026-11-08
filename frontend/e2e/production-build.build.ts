/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

// What a browser transfers for the sign-in page, today about 293 KB. Going past
// it usually means a module got imported statically and joined the entry chunk.
const SIGN_IN_BUDGET_KB = 350

const MODULE_CHUNKS = /(creator|platform|admin|control|account)Routes-/

const PLAYER = {
  id: 'u1',
  email: 'player@example.com',
  full_name: 'Pat',
  totp_enabled: false,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
}

/** No backend here: the API answers as signed out, or as a Player with
 * nothing to do. Only the build is under test. */
async function fakeApi(page: Page, signedIn: boolean) {
  await page.route('**/api/v1/**', (route) => {
    if (!route.request().url().endsWith('/auth/me')) {
      return route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } })
    }
    if (signedIn) return route.fulfill({ json: PLAYER })
    return route.fulfill({
      status: 401,
      json: { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'No.', ttx_id: null } },
    })
  })
}

/** Every Content-Security-Policy refusal, from the first script on. */
async function recordPolicyViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = []
    Object.assign(window, { policyViolations: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
}

const policyViolations = (page: Page) =>
  page.evaluate(() => (window as unknown as { policyViolations: string[] }).policyViolations)

/** A move inside the app, as a link makes: no page load. */
const navigate = (page: Page, path: string) =>
  page.evaluate((target) => {
    history.pushState({}, '', target)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)

test('assets are compressed for whoever accepts it, and cached for good', async ({ request }) => {
  const html = await (await request.get('/login')).text()
  const entry = html.match(/\/assets\/index-[^"]+\.js/)?.[0]
  expect(entry).toBeTruthy()

  const compressed = await request.get(entry!, { headers: { 'Accept-Encoding': 'gzip' } })
  expect(compressed.headers()['content-encoding']).toBe('gzip')
  expect(compressed.headers()['vary']).toContain('Accept-Encoding')
  expect(compressed.headers()['cache-control']).toContain('immutable')

  const plain = await request.get(entry!, { headers: { 'Accept-Encoding': 'identity' } })
  expect(plain.headers()['content-encoding']).toBeUndefined()
  expect(await plain.text()).toBe(await compressed.text())
})

test('the sign-in page breaks no policy and stays within its budget', async ({ page }) => {
  await fakeApi(page, false)
  await recordPolicyViolations(page)
  const assets: Promise<number>[] = []
  const names: string[] = []
  page.on('requestfinished', (request) => {
    const { pathname } = new URL(request.url())
    if (!pathname.startsWith('/assets/')) return
    names.push(pathname)
    assets.push(request.sizes().then((sizes) => sizes.responseBodySize))
  })

  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await policyViolations(page)).toEqual([])
  expect(names.filter((name) => MODULE_CHUNKS.test(name))).toEqual([])
  const transferred = (await Promise.all(assets)).reduce((sum, size) => sum + size, 0)
  expect(transferred / 1024).toBeLessThan(SIGN_IN_BUDGET_KB)
})

test('a chunk gone after a deployment reloads once, then says so', async ({ page }) => {
  await fakeApi(page, true)
  await recordPolicyViolations(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const gone = '**/assets/accountRoutes-*.js'
  let asked = 0
  await page.route(gone, (route) => {
    asked += 1
    return route.fulfill({ status: 404, body: 'gone' })
  })
  await navigate(page, '/account/settings/general')

  const failure = page.getByRole('alert').filter({ hasText: "couldn't be loaded" })
  await expect(failure).toBeVisible({ timeout: 20_000 })
  expect(asked).toBe(2)

  await page.unroute(gone)
  await page.getByRole('button', { name: 'Reload page' }).click()
  await expect(page.getByRole('heading', { name: 'General' }).first()).toBeVisible()
  await expect(failure).toBeHidden()
  expect(await policyViolations(page)).toEqual([])
})
