import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, signedIn } from './helpers.ts'

// The documentation site's screenshots, taken from the demo exercises so they
// can be regenerated whenever a screen changes (`npm run docs:screenshots`).
// Each one comes in both themes: the site shows the reader's.
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/site/src/assets/screens')

/** `show` brings the screen back after the reload that applies the theme. */
async function shoot(page: Page, name: string, show?: () => Promise<void>) {
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => localStorage.setItem('ttx_theme', value), theme)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await show?.()
    await page.waitForTimeout(300) // the theme's colour transition
    await page.screenshot({ path: join(OUTPUT, `${name}-${theme}.png`), timeout: 30_000 })
  }
}

const release = (controller: Page) =>
  controller
    .getByRole('region', { name: 'Next' })
    .getByRole('button', { name: /^Release / })
    .first()
    .click()

test('the screens the guide shows', async ({ browser }) => {
  test.setTimeout(480_000)
  mkdirSync(OUTPUT, { recursive: true })
  const exercises = JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>
  const ttxId = exercises.ransomware
  const { controller, table } = await atTheTable(browser, 'ransomware', [PLAYER_1])
  const [player] = table

  await test.step('design', async () => {
    await controller.goto(`/creator/${ttxId}/exercise?edit=1`)
    await shoot(controller, 'exercise-team', async () => {
      await controller.getByRole('columnheader', { name: 'Controller' }).scrollIntoViewIfNeeded()
    })
    await controller.goto(`/creator/${ttxId}/needs`)
    await shoot(controller, 'needs-analysis')
    await controller.goto(`/creator/${ttxId}/msel`)
    await shoot(controller, 'msel', async () => {
      await controller.getByText('Injects', { exact: true }).first().click()
    })
    await controller.goto(`/creator/${ttxId}/conduct-prep`)
    await shoot(controller, 'session-plan')
  })

  const manager = await signedIn(browser, 'manager@demo.example.com')
  await manager.goto('/admin/users-and-roles')
  await shoot(manager, 'users-and-roles')

  await test.step('the live session', async () => {
    await controller.goto(`/control/${ttxId}`)
    await controller.getByRole('button', { name: 'Start exercise' }).click()
    await release(controller)
    await expect(player.getByRole('heading', { name: /^#1 /, level: 2 })).toBeVisible(LIVE)
    await shoot(controller, 'control-center')
    await shoot(player, 'playground')

    const evaluator = await signedIn(browser, 'evaluator@demo.example.com')
    await evaluator.goto(`/playground/${ttxId}`)
    await evaluator.getByRole('button', { name: 'All my points' }).click()
    await evaluator
      .getByRole('radiogroup', { name: 'Rating' })
      .first()
      .getByRole('radio')
      .first()
      .click()
    await expect(evaluator.getByText(/\b1 of \d+ rated/).first()).toBeVisible(LIVE)
    await shoot(evaluator, 'evaluator-panel', async () => {
      await evaluator.getByRole('button', { name: 'All my points' }).click()
    })
  })

  await test.step('a vote at the table', async () => {
    const { controller: polls, table: voters } = await atTheTable(browser, 'poisoned-package', [
      PLAYER_1,
    ])
    await polls.getByRole('button', { name: 'Start exercise' }).click()
    await release(polls)
    await expect(voters[0].getByRole('heading', { name: /^#1 / })).toBeVisible(LIVE)
    await release(polls)
    const options = voters[0].getByRole('group', { name: /\?$/ }).getByRole('button')
    await expect(options.first()).toBeVisible(LIVE)
    await options.first().click()
    await shoot(voters[0], 'vote', async () => {
      await voters[0]
        .getByRole('group', { name: /\?$/ })
        .evaluate((poll) => poll.scrollIntoView({ block: 'end' }))
    })
  })

  await test.step('the report and its improvement plan', async () => {
    await controller.goto(`/control/${ttxId}`)
    await controller.getByRole('button', { name: 'End exercise' }).click()
    await controller.getByRole('dialog').getByRole('button', { name: /^End/ }).click()
    await expect(player.getByText('The exercise has ended')).toBeVisible(LIVE)

    await controller.goto(`/creator/${ttxId}/after-action`)
    await controller.getByRole('button', { name: 'Start the report from the session' }).click()
    await expect(controller.getByRole('heading', { name: 'Conclusions' })).toBeVisible(LIVE)
    await controller.getByRole('button', { name: 'New action' }).first().click()
    const dialog = controller.getByRole('dialog')
    await dialog.getByLabel('Area for improvement').fill('Escalation to the crisis committee')
    await dialog.getByLabel('What will be done').fill('Add the on-call rota to the playbook')
    await dialog.getByLabel('Owner').fill('Head of Security')
    await dialog.getByRole('button', { name: 'Apply' }).click()
    await controller.waitForTimeout(2_000) // the report saves about a second after a change
    await shoot(controller, 'after-action-report', async () => {
      await controller
        .getByRole('heading', { name: 'Improvement plan' })
        .first()
        .evaluate((plan) => plan.scrollIntoView({ block: 'start' }))
    })

    await manager.goto('/admin/improvement-plan')
    await shoot(manager, 'improvement-plan')
  })
})
