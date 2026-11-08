import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, type Browser, type Page } from '@playwright/test'

export const PASSWORD = 'DemoTTX-2026!'
export const CONTROLLER = 'controller@demo.example.com'
export const PLAYER_1 = 'player1@demo.example.com'
export const PLAYER_2 = 'player2@demo.example.com'
export const PLAYER_3 = 'player3@demo.example.com'
export const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '.auth')

// Shorter than the page's 30 s safety fetch, and nothing here reloads.
export const LIVE = { timeout: 10_000 }

/** The current RFC 6238 code: SHA-1, 6 digits, 30 s. */
export function totpCode(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.toUpperCase()]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('')
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 0xf
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** One person in a browser of their own, signed in. An account signs in once
 * per run, since a TOTP code works once; after that its session is reused. */
export async function signedIn(browser: Browser, email: string): Promise<Page> {
  // A deployment's Players may come in through its public face.
  const face = email.startsWith('player') ? process.env.E2E_PLAYER_URL : undefined
  const options = face ? { baseURL: face } : {}
  const saved = join(AUTH_DIR, `${email}.json`)
  if (existsSync(saved)) {
    const context = await browser.newContext({ ...options, storageState: saved })
    return context.newPage()
  }
  const context = await browser.newContext(options)
  const page = await context.newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  const totpSecret = (JSON.parse(process.env.E2E_TOTP ?? '{}') as Record<string, string>)[email]
  if (totpSecret) {
    await page.getByLabel('6-digit code').fill(totpCode(totpSecret))
    await page.getByRole('button', { name: 'Verify' }).click()
  }
  await expect(page).not.toHaveURL(/\/login/)
  await context.storageState({ path: saved })
  return page
}

/** Who a test needs, each in a browser of their own, on the seed's exercise
 * of that key. The Controller is on the Control center, with the session not
 * started; the Players on the Playground, with its live stream open. Without
 * the stream the page falls back to polling, and everything would still
 * arrive. */
export async function atTheTable(browser: Browser, exercise: string, players: string[]) {
  const ttxId = (JSON.parse(process.env.E2E_EXERCISES ?? '{}') as Record<string, string>)[exercise]
  const controller = await signedIn(browser, CONTROLLER)
  await controller.goto(`/control/${ttxId}`)
  const table = []
  for (const email of players) {
    const page = await signedIn(browser, email)
    const stream = page.waitForRequest(/\/run\/stream/)
    await page.goto(`/playground/${ttxId}`)
    await stream
    table.push(page)
  }
  return { controller, table }
}

/** A personal access token, as Preferences creates one. */
export async function createToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  const csrf = cookies.find((cookie) => cookie.name === 'ttx_csrf_token')?.value ?? ''
  const settings = await (await page.request.get('/api/v1/auth/tokens')).json()
  const response = await page.request.post('/api/v1/auth/tokens', {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      name: 'Browser test',
      expires_in_days: 7,
      acknowledge: true,
      disclaimer_version: settings.disclaimer_version,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).token
}

/** One call to the MCP endpoint, as an AI client makes it. */
export async function tool(page: Page, token: string, name: string, args: object) {
  const response = await page.request.post('/api/v1/mcp', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  })
  expect(response.status()).toBe(200)
  const { result } = await response.json()
  expect(result.isError, result.content[0].text).toBe(false)
  return JSON.parse(result.content[0].text)
}
