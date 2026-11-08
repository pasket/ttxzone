import { useLocation, useParams } from 'react-router-dom'

import { useActingRole } from './useActingRole'
import { currentModuleFromPath } from '../lib/moduleAccess'
import { sectionsForModule, sectionsForRole } from '../lib/navSections'

/** The active module's Primary Menu sections, the base of their links and
 * the section the URL is on (`active`, if any) -- shared by the menus and
 * the ContextBar, which dims the exercise where the page ignores it. */
export function useActiveSections() {
  const location = useLocation()
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()
  const module = currentModuleFromPath(location.pathname)
  const sections = sectionsForRole(sectionsForModule(module), useActingRole(module))
  const base = ttxId ? `/${module}/${ttxId}` : `/${module}`
  // A literal sibling route with no `:section` param of its own (an
  // org-scoped one like "/creator/players/pending" -- see App.tsx)
  // is matched on the pathname's second segment instead, so its parent
  // section still highlights in the Primary Menu. A ttx-scoped URL's
  // second segment is a ttxId, which never equals a section path.
  const secondSegment = location.pathname.split('/')[2]
  const pathMatch = sections.find((s) => s.path === secondSegment)
  // Same for a ttx-scoped literal route ("/creator/:ttxId/library/injects").
  const activeSection = pathMatch ? pathMatch.path : (section ?? location.pathname.split('/')[3])
  const active = sections.find((s) => s.path === activeSection)
  return { sections, base, activeSection, active, module }
}
