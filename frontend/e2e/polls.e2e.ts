import { expect, test } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, PLAYER_2 } from './helpers.ts'

test('the Players vote on a poll and see the result once it is shown', async ({ browser }) => {
  const { controller, table } = await atTheTable(browser, 'poisoned-package', [PLAYER_1, PLAYER_2])
  const [first, second] = table
  const release = async () => {
    const next = controller.getByRole('region', { name: 'Next' })
    await next
      .getByRole('button', { name: /^Release / })
      .first()
      .click()
  }

  await controller.getByRole('button', { name: 'Start exercise' }).click()
  await release()
  await expect(first.getByRole('heading', { name: /^#1 / })).toBeVisible(LIVE)

  const options = await test.step('releasing the poll opens the vote', async () => {
    await release()
    const group = first.getByRole('group', { name: /\?$/ })
    await expect(group).toBeVisible(LIVE)
    return group.getByRole('button')
  })
  const choice = ((await options.first().textContent()) ?? '').replace(/^[A-F]/, '')
  const pollOf = (page: typeof first) =>
    page.getByRole('group', { name: /\?$/ }).getByRole('button')

  await test.step('a Player sees who voted, never the tally', async () => {
    await options.first().click()
    await expect(options.first()).toHaveAttribute('aria-pressed', 'true')
    await pollOf(second).first().click()
    await expect(first.getByText('2 have voted')).toBeVisible(LIVE)
    await expect(first.getByText('2 votes')).toBeHidden()
  })

  await test.step('the Controller reads the tally', async () => {
    await expect(controller.getByText('2 votes').first()).toBeVisible(LIVE)
  })

  await test.step('the result reaches the Players when the Controller shows it', async () => {
    await controller.getByRole('button', { name: 'Close the vote' }).click()
    await controller.getByRole('dialog').getByRole('button', { name: 'Close the vote' }).click()
    await expect(first.getByText("The result hasn't been shown yet.").first()).toBeVisible(LIVE)
    await expect(first.getByText('Outcome')).toBeHidden()
    await expect(first.getByText(choice).first()).toBeHidden()
    await controller.getByRole('button', { name: 'Show result' }).first().click()
    await expect(first.getByText('2 votes').first()).toBeVisible(LIVE)
    await expect(first.getByText('Outcome').first()).toBeVisible(LIVE)
    await expect(second.getByText('2 votes').first()).toBeVisible(LIVE)
  })

  await test.step('the meters reach the Players when the Controller shows them', async () => {
    await expect(controller.getByText('Impact meters')).toBeVisible(LIVE)
    await expect(first.getByText('Impact meters')).toBeHidden()
    await controller.getByRole('button', { name: 'Show the summary to the Players' }).click()
    await expect(first.getByText('Impact meters')).toBeVisible(LIVE)
    await expect(first.getByText('1 decision')).toBeVisible(LIVE)
  })

  await test.step('the summary reaches the room screen too', async () => {
    await first.getByRole('button', { name: /on a projector/ }).click()
    await expect(first.getByText('Impact meters').locator('visible=true')).toBeVisible()
  })
})
