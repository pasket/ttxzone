import { expect, test, type Locator } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, PLAYER_2 } from './helpers.ts'

test('each room gets its injects until the Controller brings everyone together', async ({
  browser,
}) => {
  const { controller, table } = await atTheTable(browser, 'connected-plant', [PLAYER_1, PLAYER_2])
  const [first, second] = table

  await controller.getByRole('button', { name: 'Start exercise' }).click()

  await test.step('each Player is told which room they are in', async () => {
    await expect(first.getByText(/You’re in .*RM-01/)).toBeVisible(LIVE)
    await expect(second.getByText(/You’re in .*RM-02/)).toBeVisible(LIVE)
  })

  const release = () =>
    controller
      .getByRole('region', { name: 'Next' })
      .getByRole('button', { name: /^Release / })
      .first()
      .click()
  const titleOf = async (heading: Locator) =>
    ((await heading.textContent()) ?? '').replace(/^#1 /, '')

  const title = await test.step('each room gets only its own inject', async () => {
    const firstInject = first.getByRole('heading', { name: /^#1 /, level: 2 })
    const secondInject = second.getByRole('heading', { name: /^#1 /, level: 2 })
    await release()
    await expect(firstInject).toBeVisible(LIVE)
    await release()
    // The second room's first inject is the second one released.
    await expect(secondInject).toBeVisible(LIVE)
    const own = await titleOf(firstInject)
    expect(await titleOf(secondInject)).not.toBe(own)
    await expect(firstInject).toHaveText(`#1 ${own}`)
    return own
  })

  await test.step('the main room shows what the Controller projects', async () => {
    await controller.getByRole('button', { name: 'Everyone to the main room' }).click()
    await expect(second.getByText('Nothing on screen. Wait for the Controller.')).toBeVisible(LIVE)
    await expect(second.getByText(title)).toBeHidden()
    await controller
      .getByRole('button', { name: /^Project / })
      .first()
      .click()
    await expect(second.getByRole('heading', { name: title })).toBeVisible(LIVE)
    await expect(first.getByRole('heading', { name: title })).toBeVisible(LIVE)
  })

  await test.step('back in their rooms, each sees their own again', async () => {
    await controller.getByRole('button', { name: 'Everyone back to their rooms' }).click()
    await expect(second.getByText(/You’re in .*RM-02/)).toBeVisible(LIVE)
    await expect(first.getByRole('heading', { name: title })).toBeVisible(LIVE)
  })
})
