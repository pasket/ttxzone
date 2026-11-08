import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** A file's SHA-256, shortened on screen (the whole digest in the tooltip
 * and the accessible name), with a button that copies all of it -- so
 * whoever downloads the file can check it's the one handed out. */
export function FileDigest({ sha256 }: { sha256: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(sha256)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard: the digest is in the tooltip to read.
    }
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        translate="no"
        title={sha256}
        className="truncate font-mono text-xs text-paper-ink/60 dark:text-fg-faint"
      >
        SHA-256 {sha256.slice(0, 16)}…
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t('common.files.copyDigest', { digest: sha256 })}
        className="shrink-0 rounded-xs px-1 text-xs text-paper-ink/60 hover:text-paper-ink focus-visible:outline-2 focus-visible:outline-accent-fg dark:text-fg-muted dark:hover:text-fg"
      >
        {copied ? t('common.files.copied') : t('common.files.copy')}
      </button>
    </span>
  )
}
