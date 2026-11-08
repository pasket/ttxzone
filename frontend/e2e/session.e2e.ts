import { expect, test } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1 } from './helpers.ts'

test('a Controller and a Player play a session from start to feedback', async ({ browser }) => {
  const { controller, table } = await atTheTable(browser, 'ransomware', [PLAYER_1])
  const [player] = table

  await test.step('the Player waits until the Controller starts', async () => {
    await expect(
      player.getByText('Waiting for the Controller to start the exercise.'),
    ).toBeVisible()
    await controller.getByRole('button', { name: 'Start exercise' }).click()
    await expect(player.getByText('The first inject is on its way.')).toBeVisible(LIVE)
  })

  const title = await test.step('the released inject reaches the Player', async () => {
    const next = controller.getByRole('region', { name: 'Next' })
    await next
      .getByRole('button', { name: /^Release / })
      .first()
      .click()
    const delivered = player.getByRole('heading', { name: /^#1 /, level: 2 })
    await expect(delivered).toBeVisible(LIVE)
    const text = ((await delivered.textContent()) ?? '').replace(/^#1 /, '')
    await expect(controller.getByRole('region', { name: 'In play' })).toContainText(text)
    return text
  })

  await test.step('the Controller reads the decision the table records', async () => {
    const decision = `Isolate the affected servers (${title})`
    await player.getByLabel('Record a decision').fill(decision)
    await player.getByRole('button', { name: 'Record', exact: true }).click()
    await expect(controller.getByText(decision)).toBeVisible(LIVE)
  })

  await test.step('the session ends and the Player answers the feedback form', async () => {
    await controller.getByRole('button', { name: 'End exercise' }).click()
    await controller.getByRole('dialog').getByRole('button', { name: /^End/ }).click()
    await expect(player.getByText('The exercise has ended')).toBeVisible(LIVE)
    await player.getByRole('button', { name: 'Send my answers' }).click()
    await expect(player.getByText('Thank you — your answers have been sent.')).toBeVisible()
  })
})
