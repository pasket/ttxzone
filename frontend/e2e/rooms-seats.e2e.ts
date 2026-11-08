import { expect, test } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, PLAYER_2, PLAYER_3 } from './helpers.ts'

test('the Controller moves one Player and seats a late one', async ({ browser }) => {
  const { controller, table } = await atTheTable(browser, 'rooms-seats', [
    PLAYER_1,
    PLAYER_2,
    PLAYER_3,
  ])
  const [first, second, late] = table
  const nothingOnScreen = 'Nothing on screen. Wait for the Controller.'

  await controller.getByRole('button', { name: 'Start exercise' }).click()
  await expect(second.getByText(/You’re in .*RM-02/)).toBeVisible(LIVE)

  await test.step('a Player without a room follows the main room', async () => {
    await expect(late.getByText('You have no room yet, so you follow the main room.')).toBeVisible(
      LIVE,
    )
  })

  await test.step('one Player goes to the main room and back, the rest stay', async () => {
    await controller.getByText('1 Player: who is where').nth(1).click()
    await controller.getByRole('button', { name: 'Bring Javier Molina to the main room' }).click()
    await expect(second.getByText('The Controller brought you here.')).toBeVisible(LIVE)
    await expect(second.getByText(nothingOnScreen)).toBeVisible(LIVE)
    await expect(first.getByText(/You’re in .*RM-01/)).toBeVisible()
    await controller.getByRole('button', { name: 'Send Javier Molina back to their room' }).click()
    await expect(second.getByText(/You’re in .*RM-02/)).toBeVisible(LIVE)
  })

  await test.step('seated mid-session, a Player joins their room and its injects', async () => {
    await controller.getByRole('button', { name: 'Seat', exact: true }).click()
    const dialog = controller.getByRole('dialog')
    await dialog.getByLabel('Inés Castro').selectOption({ index: 1 })
    await dialog.getByRole('button', { name: 'Seat', exact: true }).click()
    await expect(late.getByText(/You’re in .*RM-01/)).toBeVisible(LIVE)

    await controller
      .getByRole('region', { name: 'Next' })
      .getByRole('button', { name: /^Release / })
      .first()
      .click()
    const inject = first.getByRole('heading', { name: /^#1 /, level: 2 })
    await expect(inject).toBeVisible(LIVE)
    await expect(late.getByRole('heading', { name: /^#1 /, level: 2 })).toHaveText(
      (await inject.textContent()) ?? '',
      LIVE,
    )
  })
})
