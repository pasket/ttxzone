/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

import { check } from './axe.ts'
import { atTheTable, LIVE, PLAYER_1, signedIn } from './helpers.ts'

const exerciseId = () =>
  (JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>).accessibility

async function visit(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    // A section's route may redirect once its data is in.
    await expect(page.getByRole('main')).toBeVisible(LIVE)
    await check(page, path)
  }
}

test('the signed-out screens', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await visit(page, ['/login', '/register', '/forgot-password'])
})

test('the live session, for every role', async ({ browser }) => {
  test.setTimeout(240_000)
  const { controller, table } = await atTheTable(browser, 'accessibility', [PLAYER_1])
  const [player] = table
  const release = () =>
    controller
      .getByRole('region', { name: 'Next' })
      .getByRole('button', { name: /^Release / })
      .first()
      .click()

  await expect(controller.getByRole('button', { name: 'Start exercise' })).toBeVisible(LIVE)
  await check(controller, 'Control center before the start')
  await controller.getByRole('button', { name: 'Start exercise' }).click()
  await release()
  await expect(player.getByRole('heading', { name: /^#1 / })).toBeVisible(LIVE)
  await release()
  const vote = player.getByRole('group', { name: /\?$/ }).getByRole('button').first()
  await expect(vote).toBeVisible(LIVE)
  await check(player, 'Player, a poll open')
  await vote.click()
  await expect(controller.getByText('1 vote').first()).toBeVisible(LIVE)
  await check(controller, 'Control center, a poll open')

  await controller.getByRole('button', { name: 'Close the vote' }).click()
  await check(controller, 'Closing a vote')
  await controller.getByRole('dialog').getByRole('button', { name: 'Close the vote' }).click()
  await controller.getByRole('button', { name: 'Show result' }).first().click()
  await expect(player.getByText('Outcome').first()).toBeVisible(LIVE)
  await check(player, 'Player, the result shown')
  await player.getByRole('button', { name: /on a projector/ }).click()
  await check(player, 'Projector')

  for (const role of ['facilitator', 'evaluator', 'observer']) {
    const page = await signedIn(browser, `${role}@demo.example.com`)
    await page.goto(`/playground/${exerciseId()}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('list', { name: 'Phases' })).toBeVisible(LIVE)
    await check(page, `${role}, live`)
  }
})

test('the design screens', async ({ browser }) => {
  test.setTimeout(180_000)
  const page = await signedIn(browser, 'controller@demo.example.com')
  const id = exerciseId()
  await visit(
    page,
    ['exercise', 'needs', 'msel', 'conduct-prep', 'after-action', 'players'].map(
      (section) => `/creator/${id}/${section}`,
    ),
  )
  await visit(page, ['/creator/library', '/account/settings/general', '/account/settings/security'])
})

test('the organization screens', async ({ browser }) => {
  test.setTimeout(120_000)
  const page = await signedIn(browser, 'manager@demo.example.com')
  await visit(
    page,
    ['organization', 'users-and-roles', 'exercises', 'library', 'improvement-plan'].map(
      (section) => `/admin/${section}`,
    ),
  )
})

const PLATFORM = 'platform@demo.example.com'
const PLATFORM_SCREENS = [
  'tenancy',
  'accounts',
  'organizations',
  'legal',
  'email',
  'security',
  'sso',
  'assistant',
  'activity',
].map((section) => `/platform/${section}`)

test('the instance administration screens', async ({ browser }) => {
  test.setTimeout(180_000)
  const page = await signedIn(browser, PLATFORM)
  for (const path of PLATFORM_SCREENS) {
    await visit(page, [path])
    await expect(page).toHaveURL(path)
  }

  await page.goto('/platform/accounts')
  await page.getByRole('button', { name: 'Manage Carlos Ortega' }).click()
  await expect(page).toHaveURL(/\/platform\/accounts\/[0-9a-f-]{36}/)
  // The page's heading is the account's name, drawn once the account loads:
  // under load, an idle network can come before it.
  await expect(page.getByRole('heading', { level: 1, name: 'Carlos Ortega' })).toBeVisible(LIVE)
  await page.waitForLoadState('networkidle')
  await check(page, "An account's page")
  await page.getByRole('button', { name: 'Suspend' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible(LIVE)
  await check(page, 'Suspending an account')

  await page.goto('/platform/legal')
  await page.getByRole('button', { name: 'Start from template' }).click()
  await expect(page.getByRole('dialog')).toBeVisible(LIVE)
  await check(page, 'Starting the legal documents from a template')
})

test('nothing scrolls sideways on a phone', async ({ browser }) => {
  test.setTimeout(120_000)
  const screens: [string, string[]][] = [
    [
      'controller@demo.example.com',
      ['exercise', 'needs', 'msel', 'conduct-prep'].map((s) => `/creator/${exerciseId()}/${s}`),
    ],
    ['manager@demo.example.com', ['/admin/users-and-roles', '/admin/exercises']],
    [PLATFORM, PLATFORM_SCREENS],
  ]
  for (const [email, paths] of screens) {
    const page = await signedIn(browser, email)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of paths) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const excess = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect.soft(excess, path).toBe(0)
    }
  }
})
