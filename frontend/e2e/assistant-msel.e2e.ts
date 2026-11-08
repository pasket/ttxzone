import { expect, test } from '@playwright/test'

import { check } from './axe.ts'
import { CONTROLLER, createToken, LIVE, signedIn, tool } from './helpers.ts'

// One technique in each ATT&CK domain: the patch comes back from the
// database with its keys reordered, and the page must still see it saved.
const TECHNIQUES = [
  { domain: 'enterprise', tactic_id: 'TA0040', technique_id: 'T1486' },
  { domain: 'ics', tactic_id: 'TA0105', technique_id: 'T0829' },
]
const NEW_TITLE = 'The cyber insurer asks for the forensic timeline'
const CHANGED_TITLE = 'EDR alerts: mass encryption on the file servers'

test('an AI client proposes MSEL changes, and accepted ones leave the panel for good', async ({
  browser,
}) => {
  const planner = await signedIn(browser, CONTROLLER)
  const ttxId = (JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>)[
    'assistant-msel'
  ]

  let deleted = ''
  await test.step('the client reads the MSEL and proposes', async () => {
    const token = await createToken(planner)
    const msel = await tool(planner, token, 'get_msel', { ttx_id: ttxId })
    deleted = msel.injects[msel.injects.length - 1].title
    const objectives = (msel.objectives as { code: string }[]).slice(0, 2).map((o) => o.code)
    await tool(planner, token, 'propose_injects', {
      ttx_id: ttxId,
      items: [
        {
          code: msel.injects[0].code,
          title: CHANGED_TITLE,
          objectives: [...objectives].reverse(),
          attack_attribution: 'noise',
          attack_techniques: TECHNIQUES,
        },
        {
          phase: msel.phases[0].code,
          title: NEW_TITLE,
          content: 'By noon, with the first indicators.',
          objectives,
        },
        { code: msel.injects[msel.injects.length - 1].code, delete: true },
      ],
    })
  })

  await planner.goto(`/creator/${ttxId}/msel`)
  const panel = planner.getByRole('region', { name: 'AI proposals' })

  await test.step('they wait on the page', async () => {
    await expect(panel.getByText(CHANGED_TITLE)).toBeVisible(LIVE)
    await expect(panel.getByText(NEW_TITLE)).toBeVisible()
    await check(planner, 'The MSEL with proposals')
  })

  await test.step('accepted all at once, one save takes them off the panel', async () => {
    await panel.getByRole('button', { name: 'Accept all (3)' }).click()
    // A ready MSEL asks once, for all of them.
    const editAnyway = planner.getByRole('dialog').getByRole('button', { name: 'Edit anyway' })
    if (await editAnyway.isVisible()) await editAnyway.click()
    await expect(panel).toBeHidden(LIVE)
  })

  await test.step('they stay gone after a reload, decided on the server', async () => {
    const proposals = `/api/v1/ttx/${ttxId}/assistant/proposals`
    const listed = planner.waitForResponse((r) => r.url().includes('/assistant/proposals'))
    await planner.reload()
    await listed
    await expect(planner.getByRole('region', { name: 'AI proposals' })).toBeHidden()
    const msel = await (await planner.request.get(`/api/v1/ttx/${ttxId}/msel`)).json()
    const titles = (msel.injects as { title: string }[]).map((i) => i.title)
    expect(titles).toEqual(expect.arrayContaining([CHANGED_TITLE, NEW_TITLE]))
    expect(titles).not.toContain(deleted)
    const pending = await (await planner.request.get(`${proposals}?status=pending`)).json()
    expect(pending.items).toEqual([])
    const accepted = await (await planner.request.get(`${proposals}?status=accepted`)).json()
    expect(accepted.items).toHaveLength(3)
  })
})
