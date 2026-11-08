import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDisclosureMenu } from '../../hooks/useDisclosureMenu'
import { btnNeutralIconGhost, floatingSurface } from '../../lib/buttonStyles'
import type { ContentLanguage } from '../../lib/types'
import { DuplicateIcon } from '../common/DuplicateIcon'

const menuItemClass =
  'block w-full rounded-xs px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** Duplicate, as an icon like Edit and Delete: a small menu with where
 * the copy goes -- the organization's library (Program Managers, Admin)
 * and/or the exercise in context (Exercise Planners, Creator). Renders
 * nothing when neither target applies. A <details> disclosure, like the
 * MSEL's downloads (useDisclosureMenu adds Escape and click-outside).
 * The list is placed `fixed` under its trigger, so a table's horizontal
 * scroll wrapper (which clips overflow) can't cut it off; scrolling or
 * resizing closes it. Shared by every library. An item available in
 * several languages (`languages`) offers one organization copy per
 * language: the library holds one, and the reader's profile doesn't choose
 * it. */
export function DuplicateMenu({
  label,
  toOrganization,
  toExercise,
  newExercise,
  showOrganization,
  showExercise,
  languages = [],
  onPick,
}: {
  label: string
  toOrganization: string
  toExercise: string
  /** Also offered, first: a new exercise (scenarios only). */
  newExercise?: { label: string; onPick: () => void }
  showOrganization: boolean
  showExercise: boolean
  languages?: readonly ContentLanguage[]
  onPick: (level: 'organization' | 'exercise', language?: ContentLanguage) => void
}) {
  const { t } = useTranslation()
  const menuRef = useDisclosureMenu()
  const details = useRef<HTMLDetailsElement | null>(null)
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!place) return
    const close = () => {
      if (details.current) details.current.open = false
      setPlace(null)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [place])

  if (!showOrganization && !showExercise && !newExercise) return null
  return (
    <details
      ref={(node) => {
        details.current = node
        return menuRef(node)
      }}
      className="relative"
      onToggle={(event) => {
        const summary = event.currentTarget.querySelector('summary')
        if (!event.currentTarget.open || !summary) {
          setPlace(null)
          return
        }
        const box = summary.getBoundingClientRect()
        setPlace({ top: box.bottom + 4, right: window.innerWidth - box.right })
      }}
    >
      <summary aria-label={label} title={label} className={`${btnNeutralIconGhost} list-none`}>
        <DuplicateIcon />
      </summary>
      <ul
        style={place ? { position: 'fixed', top: place.top, right: place.right } : undefined}
        className={`absolute right-0 z-30 mt-1 w-56 space-y-0.5 p-1 ${floatingSurface}`}
      >
        {showOrganization &&
          (languages.length > 1 ? (
            languages.map((language) => (
              <li key={language}>
                <button
                  type="button"
                  className={menuItemClass}
                  onClick={() => onPick('organization', language)}
                >
                  {toOrganization} · {t(`templates.scenarios.languages.${language}`)}
                </button>
              </li>
            ))
          ) : (
            <li>
              <button
                type="button"
                className={menuItemClass}
                onClick={() => onPick('organization')}
              >
                {toOrganization}
              </button>
            </li>
          ))}
        {newExercise && (
          <li>
            <button type="button" className={menuItemClass} onClick={newExercise.onPick}>
              {newExercise.label}
            </button>
          </li>
        )}
        {showExercise && (
          <li>
            <button type="button" className={menuItemClass} onClick={() => onPick('exercise')}>
              {toExercise}
            </button>
          </li>
        )}
      </ul>
    </details>
  )
}
