import '@testing-library/jest-dom/vitest'
import '../src/lib/i18n'

import { configure } from '@testing-library/react'
import { afterEach } from 'vitest'
import { vi } from 'vitest'

// findBy*/waitFor give up after 1s by default. Tests that render the whole
// <App/> (auth snapshot, route guards, redirects) can take longer than that
// when the full suite runs in parallel on a busy machine -- ContextBar's
// did, intermittently. 3s removes the flake; a genuinely broken test still
// fails, just a little later.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  // Per-viewer UI memory (folded descriptions, strip toggles) starts fresh
  // in every test.
  try {
    localStorage.clear()
  } catch {
    // jsdom without storage: nothing to clear.
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
