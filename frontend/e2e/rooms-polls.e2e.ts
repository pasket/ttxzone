import { expect, test, type Page } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, PLAYER_2 } from './helpers.ts'

const POLL = 'POL-12'

const options = (page: Page) => page.getByRole('group', { name: /\?$/ }).getByRole('button')
const optionText = async (page: Page, index: number) =>
  ((await options(page).nth(index).textContent()) ?? '').replace(/^[A-F]/, '')
const outcomeOf = (page: Page) => page.getByText('Outcome', { exact: true }).locator('..')

test('each room votes on a poll of its own, and the main room on another', async ({ browser }) => {
  const { controller, table } = await atTheTable(browser, 'rooms-polls', [PLAYER_1, PLAYER_2])
  const [first, second] = table

  await controller.getByRole('button', { name: 'Start exercise' }).click()
  await expect(first.getByText(/You’re in .*RM-01/)).toBeVisible(LIVE)

  await test.step('releasing the poll opens a vote in each room', async () => {
    await controller.getByRole('button', { name: `Release ${POLL}`, exact: true }).click()
    await controller
      .getByRole('dialog')
      .getByRole('button', { name: /^Release/ })
      .click()
    await expect(options(first).first()).toBeVisible(LIVE)
    await expect(options(second).first()).toBeVisible(LIVE)
  })

  const firstChoice = await optionText(first, 0)
  const secondChoice = await optionText(second, 1)

  await test.step('a room counts only its own votes', async () => {
    await options(first).nth(0).click()
    await options(second).nth(1).click()
    await expect(options(first).nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(options(second).nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(first.getByText('1 has voted')).toBeVisible(LIVE)
    await expect(second.getByText('1 has voted')).toBeVisible(LIVE)
  })

  const settle = async (room: RegExp) => {
    await controller.getByRole('radio', { name: room }).click()
    await expect(controller.getByText('1 vote').first()).toBeVisible(LIVE)
    await controller.getByRole('button', { name: 'Close the vote' }).click()
    await controller.getByRole('dialog').getByRole('button', { name: 'Close the vote' }).click()
    await controller.getByRole('button', { name: 'Show result' }).first().click()
    await expect(controller.getByRole('button', { name: 'Hide result' }).first()).toBeVisible(LIVE)
  }

  await test.step('each room settles on its own, with its own consequence', async () => {
    await settle(/RM-01/)
    await expect(outcomeOf(first).first()).toContainText(firstChoice, LIVE)
    await expect(second.getByText('Outcome', { exact: true })).toBeHidden()
    await settle(/RM-02/)
    await expect(outcomeOf(second).first()).toContainText(secondChoice, LIVE)
    await expect(outcomeOf(first).first()).not.toContainText(secondChoice)
  })

  await test.step('projected in the main room, the Players vote together', async () => {
    await controller.getByRole('button', { name: 'Everyone to the main room' }).click()
    await expect(first.getByText('Nothing on screen. Wait for the Controller.')).toBeVisible(LIVE)
    await controller.getByRole('button', { name: `Project ${POLL} in the main room` }).click()
    await expect(options(first).first()).toBeVisible(LIVE)
    await expect(options(second).first()).toBeVisible(LIVE)
    await options(first).first().click()
    await options(second).first().click()
    await expect(first.getByText('2 have voted')).toBeVisible(LIVE)
  })
})
