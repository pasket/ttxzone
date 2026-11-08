/** Replaced at build time by `vite.config.ts`'s `define`. */
declare const __BUILD_INFO__: {
  version: string
  commit: string | null
  updatedAt: string | null
  sourceUrl: string | null
}

/** The running build: package version, short commit and the commit's date
 * (ISO 8601), the last two null when the build had no repository, and where
 * a modified build offers its source code (null: the original's). */
export const BUILD_INFO = __BUILD_INFO__

/** The original work, credited in About by every build (NOTICE, section 7). */
export const AUTHOR = 'Andoni Valverde'
export const ORIGINAL_SOURCE_URL = 'https://github.com/pasket/ttxzone'
export const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html'
