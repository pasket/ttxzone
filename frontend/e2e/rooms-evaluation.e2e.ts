import { expect, test } from '@playwright/test'

import { atTheTable, LIVE, PLAYER_1, PLAYER_2, signedIn } from './helpers.ts'

test('each room gets its key questions and is rated on its own', async ({ browser }) => {
  const { controller, table } = await atTheTable(browser, 'rooms-evaluation', [PLAYER_1, PLAYER_2])
  const [first, second] = table
  const ttxId = (JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>)[
    'rooms-evaluation'
  ]
  const release = () =>
    controller
      .getByRole('region', { name: 'Next' })
      .getByRole('button', { name: /^Release / })
      .first()
      .click()

  await controller.getByRole('button', { name: 'Start exercise' }).click()
  await release()
  await expect(first.getByRole('heading', { name: /^#1 /, level: 2 })).toBeVisible(LIVE)
  await release()
  await expect(second.getByRole('heading', { name: /^#1 /, level: 2 })).toBeVisible(LIVE)

  await test.step('a key question reaches only the room in view', async () => {
    await controller.getByRole('radio', { name: /RM-01/ }).click()
    const questions = controller.getByRole('region', { name: 'Key questions' })
    const asked = questions.getByRole('checkbox').first()
    await asked.check()
    await questions.getByRole('button', { name: /^Ask/ }).click()
    await expect(first.getByRole('region', { name: 'Questions for the table' })).toBeVisible(LIVE)
    await expect(second.getByRole('region', { name: 'Questions for the table' })).toBeHidden()

    // In the other room that question is still to be asked.
    await controller.getByRole('radio', { name: /RM-02/ }).click()
    await expect(
      controller.getByRole('region', { name: 'Key questions' }).getByRole('checkbox').first(),
    ).toBeEnabled(LIVE)
  })

  await test.step('on a phone the stage keeps its controls apart', async () => {
    await first.setViewportSize({ width: 390, height: 844 })
    const pill = await first.getByText(/^In /).first().boundingBox()
    const size = await first.getByRole('group', { name: 'Text size' }).boundingBox()
    expect(pill && size).toBeTruthy()
    const apart = pill!.x + pill!.width <= size!.x || pill!.y >= size!.y + size!.height
    expect(apart, 'the room pill stays clear of the text size').toBe(true)
    await first.setViewportSize({ width: 1280, height: 720 })
  })

  await test.step('a rating in one room leaves the other unrated', async () => {
    const evaluator = await signedIn(browser, 'evaluator@demo.example.com')
    await evaluator.goto(`/playground/${ttxId}?room=RM-01`)
    await evaluator.getByRole('button', { name: 'All my points' }).click()
    const level = () =>
      evaluator.getByRole('radiogroup', { name: 'Rating' }).first().getByRole('radio').first()
    await level().click()
    await expect(level()).toBeChecked(LIVE)
    await expect(evaluator.getByText(/\b1 of \d+ rated/).first()).toBeVisible(LIVE)

    await evaluator.getByRole('radio', { name: /RM-02/ }).click()
    await expect(evaluator.getByText(/\b0 of \d+ rated/).first()).toBeVisible(LIVE)
    await expect(level()).not.toBeChecked()

    await evaluator.getByRole('radio', { name: /RM-01/ }).click()
    await expect(evaluator.getByText(/\b1 of \d+ rated/).first()).toBeVisible(LIVE)
  })
})
