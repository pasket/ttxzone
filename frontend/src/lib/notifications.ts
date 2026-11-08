import { frameworkLabel } from './needsForm'
import type { ExpectedNotification, RegulatoryCatalog } from './types'

/** The notifications an exercise expects its team to recognise, from the
 * requirements its objectives cite -- the client-side twin of the
 * backend's services/notification_reference.py, so the needs analysis
 * shows them live while its draft is edited. Every cited requirement with
 * reports, once, in the catalog's order, with the objectives citing it. */
export function expectedNotifications(
  objectives: readonly { code: string; regulatory_requirement_ids: readonly string[] }[],
  catalog: RegulatoryCatalog | null,
  pending: string,
): ExpectedNotification[] {
  if (!catalog) return []
  return catalog.items
    .filter((item) => item.notifications.length > 0)
    .map((item) => ({
      item,
      codes: objectives
        .filter((objective) => objective.regulatory_requirement_ids.includes(item.id))
        .map((objective) => objective.code || pending),
    }))
    .filter(({ codes }) => codes.length > 0)
    .map(({ item, codes }) => ({
      requirement_id: item.id,
      framework: item.framework,
      framework_label_en: frameworkLabel(catalog, item.framework, false),
      framework_label_es: frameworkLabel(catalog, item.framework, true),
      reference: item.reference,
      description_en: item.description_en,
      description_es: item.description_es,
      objective_codes: codes,
      milestones: item.notifications,
    }))
}
