import { useTranslation } from 'react-i18next'

/** Inline loading indicator for a button mid-submit -- plain animate-spin
 * SVG (Tailwind's built-in utility), no icon library. Sized to replace a
 * button's text label without changing the button's own height/padding.
 * The SVG is decorative, so the sr-only text carries the button's
 * accessible name while it replaces the visible label -- otherwise a busy
 * button is announced with no name at all. */
export function ButtonSpinner() {
  const { t } = useTranslation()

  return (
    <>
      <svg
        className="mx-auto h-4 w-4 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{t('common.loading')}</span>
    </>
  )
}
