import { frameworkLabel, needName } from './needsForm'
import type { Capability, NeedPriority, NeedsForm, RegulatoryCatalog } from './types'

export interface TraceabilityRow {
  key: string
  needCode: string
  /** The need's title (or finding, untitled). */
  needTitle: string
  priority: NeedPriority
  /** Null for a HIGH need no objective answers (V06), listed so the gap
   * shows up in the matrix itself. */
  objective: {
    code: string
    title: string
    statement: string
    capability: Capability
    successCriterion: string
    evidence: string
    requirements: string[]
  } | null
}

/** Need → capability → objective → requirement: one row per (objective,
 * linked need) pair, in objective order, then the HIGH needs no objective
 * answers. Requirements are shown as "Framework Reference". */
export function traceabilityRows(
  form: NeedsForm,
  catalog: RegulatoryCatalog | null,
  spanish = false,
): TraceabilityRow[] {
  const needs = new Map(form.needs.map((need) => [need.id, need]))
  const label = (id: string) => {
    const requirement = catalog?.items.find((item) => item.id === id)
    return requirement
      ? `${frameworkLabel(catalog, requirement.framework, spanish)} ${requirement.reference}`
      : id
  }
  const rows: TraceabilityRow[] = form.objectives.flatMap((objective) =>
    objective.linked_need_ids
      .map((needId) => needs.get(needId))
      .filter((need) => need !== undefined)
      .map((need) => ({
        key: `${objective.id}:${need.id}`,
        needCode: need.code,
        needTitle: needName(need),
        priority: need.priority,
        objective: {
          code: objective.code,
          title: objective.title,
          statement: objective.statement,
          capability: objective.capability,
          successCriterion: objective.success_criterion,
          evidence: objective.evidence,
          requirements: objective.regulatory_requirement_ids.map(label),
        },
      })),
  )
  const linked = new Set(form.objectives.flatMap((objective) => objective.linked_need_ids))
  for (const need of form.needs) {
    if (need.priority === 'high' && !linked.has(need.id)) {
      rows.push({
        key: `orphan:${need.id}`,
        needCode: need.code,
        needTitle: needName(need),
        priority: need.priority,
        objective: null,
      })
    }
  }
  return rows
}
