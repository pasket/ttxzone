import { expect, test } from '@playwright/test'

import { check } from './axe.ts'
import { atTheTable, createToken, LIVE, PLAYER_1, tool } from './helpers.ts'

const CONCLUSIONS = 'The table contained the incident, but it isolated the servers late.'

test('an AI client drafts the report from the session, and a person accepts it', async ({
  browser,
}) => {
  const { controller, table } = await atTheTable(browser, 'after-action', [PLAYER_1])
  const [player] = table
  const ttxId = (JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>)[
    'after-action'
  ]

  await test.step('a session is played', async () => {
    await controller.getByRole('button', { name: 'Start exercise' }).click()
    await controller
      .getByRole('region', { name: 'Next' })
      .getByRole('button', { name: /^Release / })
      .first()
      .click()
    await expect(player.getByRole('heading', { name: /^#1 /, level: 2 })).toBeVisible(LIVE)
    await controller.getByRole('button', { name: 'End exercise' }).click()
    await controller.getByRole('dialog').getByRole('button', { name: /^End/ }).click()
    await expect(player.getByText('The exercise has ended')).toBeVisible(LIVE)
  })

  await controller.goto(`/creator/${ttxId}/after-action`)
  await controller.getByRole('button', { name: 'Start the report from the session' }).click()
  await expect(controller.getByRole('heading', { name: 'Conclusions' })).toBeVisible(LIVE)

  const inject = await test.step('the client reads the session and proposes', async () => {
    const token = await createToken(controller)
    const record = await tool(controller, token, 'get_session_record', { ttx_id: ttxId })
    const played = record.injects[0].code as string
    await tool(controller, token, 'propose_report_text', {
      ttx_id: ttxId,
      items: [
        {
          section: 'conclusions',
          text: CONCLUSIONS,
          summary: 'What the session shows.',
          evidence: [{ kind: 'inject', ref: played }],
        },
      ],
    })
    return played
  })

  await test.step('it waits on the page, with what backs it', async () => {
    await controller.reload()
    const panel = controller.getByRole('region', { name: 'AI proposals' })
    await expect(panel.getByText('Based on')).toBeVisible(LIVE)
    await expect(panel.getByText(inject)).toBeVisible()
    await expect(panel.getByText(CONCLUSIONS)).toBeVisible()
    await check(controller, 'The report with a proposal')
  })

  await test.step('accepted, the report saves it and it leaves the list', async () => {
    await controller.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(controller.getByRole('region', { name: 'AI proposals' })).toBeHidden(LIVE)
    await controller.reload()
    await expect(controller.getByText('AI proposals')).toBeHidden()
    await expect(controller.getByText(CONCLUSIONS).first()).toBeVisible(LIVE)
  })
})
