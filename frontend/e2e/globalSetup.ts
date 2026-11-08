import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AUTH_DIR } from './helpers.ts'

const COMPOSE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'docker-compose.yml')

function compose(...args: string[]): string {
  return execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 600_000,
  })
}

function seedOwnStack(): string {
  compose('up', '-d', '--build', '--wait', '--renew-anon-volumes')
  return compose(
    'exec',
    '-T',
    '-e',
    `SEED_DEMO_LOCALE=${process.env.SEED_DEMO_LOCALE ?? 'es'}`,
    'backend',
    'python',
    '-m',
    'scripts.seed_demo',
    '--reset',
    '--extras',
  )
}

/** Start the stack and rebuild the demo's exercises, so every run begins from
 * sessions not yet played. The TOTP secrets and the exercises reach the tests
 * in the environment. */
export default function globalSetup() {
  const seeded = process.env.E2E_SEED_OUTPUT
    ? readFileSync(process.env.E2E_SEED_OUTPUT, 'utf8')
    : seedOwnStack()
  const secrets = [...seeded.matchAll(/(\S+@demo\.example\.com)\s.*TOTP (\w{2,})/g)]
  if (!secrets.length) throw new Error(`No TOTP secrets in:\n${seeded}`)
  process.env.E2E_TOTP = JSON.stringify(Object.fromEntries(secrets.map((m) => [m[1], m[2]])))
  const exercises = [...seeded.matchAll(/exercise (\S+)\s+(\S+)/g)].map((m) => [m[1], m[2]])
  process.env.E2E_EXERCISES = JSON.stringify(Object.fromEntries(exercises))
  rmSync(AUTH_DIR, { recursive: true, force: true })
}
