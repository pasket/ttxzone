/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Output of a git command, or null where there is no repository or no
 * git binary. The dev container reads the repository through `GIT_DIR`
 * (docker-compose.yml); the values are taken when the server starts. */
function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/** What "About TTX-Zone" shows (`src/lib/buildInfo.ts`). A build without
 * the repository passes the commit and its date as VITE_COMMIT_SHA and
 * VITE_COMMIT_DATE; otherwise they come from git, else stay unknown. A
 * modified build sets VITE_SOURCE_URL to where its own source is offered
 * (AGPL section 13); without it, About links the original repository. */
const BUILD_INFO = {
  version: (JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }).version,
  commit: process.env.VITE_COMMIT_SHA?.slice(0, 7) || git('rev-parse', '--short', 'HEAD'),
  updatedAt: process.env.VITE_COMMIT_DATE || git('log', '-1', '--format=%cI'),
  sourceUrl: process.env.VITE_SOURCE_URL || null,
}

/** The single-page app's Content-Security-Policy: its own scripts, styles
 * and API; IBM Plex from Google Fonts; images from itself plus `data:`
 * (the TOTP QR code) and `blob:` (staged upload previews). Inline `style`
 * attributes are allowed (React sets tag and chart colours through them),
 * inline <style>/<script> elements are not. The API's own responses carry
 * a deny-all policy (backend/app/core/middleware.py). */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Adds the policy to the built index.html as a <meta> tag. Build only:
 * the dev server injects inline scripts (React Refresh) the policy would
 * block. `frame-ancestors` can't be set from a <meta>, so whatever serves
 * the build in production must also send `Content-Security-Policy:
 * frame-ancestors 'none'` (or X-Frame-Options) as a header. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'ttx-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

const apiProxy = {
  '/api': {
    // Vite's dev-server proxy runs in this process, not the browser --
    // inside Docker, "localhost" is this container itself, not the
    // backend container, so the target must be the Compose service
    // name there. VITE_API_PROXY_TARGET is set in docker-compose.yml
    // for the frontend service; plain `npm run dev` on the host falls
    // back to localhost, where the backend's port is published to.
    target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
    changeOrigin: true,
  },
  '/media': {
    target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  define: { __BUILD_INFO__: JSON.stringify(BUILD_INFO) },
  server: {
    host: true,
    proxy: apiProxy,
  },
  // `vite preview` serves the build (with its policy) against the same API.
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:5173/',
      },
    },
    setupFiles: './tests/setup.ts',
    globals: true,
    // Right after a build, a local machine can stall every worker for a few
    // seconds at once, and tests that take under 2s timed out at the default
    // 5s (then kept running with fetch already unstubbed). A broken test
    // still fails, just later.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
