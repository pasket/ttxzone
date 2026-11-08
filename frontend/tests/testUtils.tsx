import { render as rtlRender } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { ToastProvider } from '../src/lib/ToastContext'

/** Every component that can call useToast() now needs a ToastProvider
 * ancestor -- this is the standard testing-library "custom render" recipe
 * for a provider every test must have, so call sites keep calling
 * `render(ui)` unchanged, only the import moves here. List screens also
 * keep their page/sort/search in the URL (useTableUrlState), so `ui` gets
 * a MemoryRouter too -- unless the test already brings its own, since
 * routers can't nest. */
export function render(ui: ReactElement) {
  const wrap = (node: ReactElement) => (
    <ToastProvider>
      {node.type === MemoryRouter ? node : <MemoryRouter>{node}</MemoryRouter>}
    </ToastProvider>
  )
  const result = rtlRender(wrap(ui))
  // `rerender` keeps the same providers around the new element.
  return { ...result, rerender: (next: ReactElement) => result.rerender(wrap(next)) }
}

/** Stubs `fetch` with `mock`, except the Players tabs' pending-requests
 * count (`?limit=1&offset=0`), the leave requests (none) and the instance
 * policy (email invitations off unless `emailInvitations`), answered on
 * their own so a test's queued responses stay in the order its screen asks
 * for them. */
export function stubFetchWithPendingCount(
  mock: (...args: unknown[]) => unknown,
  pending = 0,
  emailInvitations = false,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown, init?: unknown) =>
      // The Invitations page asks whether the deployment sends email.
      String(input).endsWith('/instance/policy')
        ? Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              tenancy_mode: 'managed',
              can_found_organization: false,
              password_reset_available: emailInvitations,
              email_invitations_available: emailInvitations,
            }),
          } as Response)
        : String(input).includes('/access-requests?limit=1&offset=0')
          ? Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ items: [], total: pending, limit: 1, offset: 0 }),
            } as Response)
          : String(input).endsWith('/leave-requests') ||
              String(input).endsWith('/leave-requests/me')
            ? Promise.resolve({ ok: true, status: 200, json: async () => [] } as Response)
            : mock(input, init),
    ),
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- test-only file, never hot-reloaded through Vite's component fast-refresh
export * from '@testing-library/react'
