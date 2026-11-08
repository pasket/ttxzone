import { useTranslation } from 'react-i18next'

import { codeRefText } from '../lib/codeRef'
import {
  formatOffset,
  formatSpan,
  previousPhase,
  vagueActionWords,
  type MselDraft,
} from '../lib/msel'
import type { IssueMessage } from '../lib/issueGroups'
import type { MselNeedsContext, MselRoom, ValidationIssue } from '../lib/types'
import { objectiveName } from '../lib/needsForm'

/** Turns an MSEL validation issue into a sentence ("INJ-03: link it to at
 * least one objective."). Rows are found by the key the report names them
 * by (the id of a saved row, the temporary key of an unsaved one);
 * objectives by id; a recipient is named as itself. Labels come from
 * lookup maps: `code`, `field` and `item_id` are plain backend strings. */
export function useMselIssueMessage(
  draft: MselDraft,
  needs: MselNeedsContext,
  rooms: readonly MselRoom[] = [],
): IssueMessage {
  const { t } = useTranslation()
  const pending = t('creator.msel.table.pendingCode')
  const fieldLabels = t('creator.msel.fields', { returnObjects: true }) as Record<string, string>
  const messages = t('creator.msel.validation', { returnObjects: true }) as Record<string, string>

  // Named as the user knows them: title first, code in brackets.
  function itemLabel(id: string | null): string {
    if (!id) return ''
    const inject = draft.injects.find((i) => i.key === id || i.id === id)
    if (inject) return codeRefText(inject.code, inject.title, pending)
    const phase = draft.phases.find((p) => p.key === id || p.id === id)
    if (phase) return codeRefText(phase.code, phase.name, pending)
    const actor = draft.threat_actors.find((a) => a.key === id || a.id === id)
    if (actor) return codeRefText(actor.code, actor.name, pending)
    const room = rooms.find((r) => r.id === id)
    if (room) return codeRefText(room.code, room.name)
    const objective = needs.objectives.find((o) => o.id === id)
    return objective ? codeRefText(objective.code, objectiveName(objective)) : id
  }

  // A phase's times, and the phase before it in session order (the one
  // reaching furthest, which is what it overlaps or leaves a gap after), so
  // a phase warning can say where and by how much.
  function phaseValues(id: string | null): Record<string, string> {
    const phase = draft.phases.find((p) => p.key === id || p.id === id)
    if (!phase) return {}
    const previous = previousPhase(draft.phases, phase.key)
    const session = draft.duration_minutes ?? 0
    const span = (minutes: number) => formatSpan(Math.max(0, minutes))
    return {
      start: formatOffset(phase.start_offset),
      end: formatOffset(phase.end_offset),
      sessionEnd: formatOffset(session),
      before: span(phase.start_offset),
      after: span(session - phase.end_offset),
      ...(previous
        ? {
            previous: codeRefText(previous.code, previous.name, pending),
            previousEnd: formatOffset(previous.end_offset),
            overlap: span(Math.min(previous.end_offset, phase.end_offset) - phase.start_offset),
            gap: span(phase.start_offset - previous.end_offset),
          }
        : {}),
    }
  }

  // A vague expected action names the word, in brackets and quotes:
  // ' ("assess", "check")'; nothing when it can't be found in the draft.
  function vagueWords(issue: ValidationIssue): string {
    if (issue.code !== 'VAGUE_EXPECTED_ACTION') return ''
    const inject = draft.injects.find((i) => i.key === issue.item_id || i.id === issue.item_id)
    const words = inject ? vagueActionWords(inject) : []
    return words.length ? ` (${words.map((w) => `“${w}”`).join(', ')})` : ''
  }

  const message = (issue: ValidationIssue) => {
    const values: Record<string, string> = {
      field: issue.field ? (fieldLabels[issue.field] ?? issue.field) : '',
      item: itemLabel(issue.item_id),
      code: issue.code,
      words: vagueWords(issue),
      ...phaseValues(issue.item_id),
    }
    // No injects because there are no phases to put them in (Add inject is
    // disabled until there are): say what unblocks it.
    const noInjectsNoPhases =
      issue.code === 'MSEL_INCOMPLETE' &&
      issue.field === 'injects' &&
      !issue.item_id &&
      draft.phases.length === 0
    const template =
      (noInjectsNoPhases
        ? messages.INJECTS_NEED_PHASES
        : issue.code === 'MSEL_INCOMPLETE' && issue.item_id
          ? messages.MSEL_INCOMPLETE_item
          : messages[issue.code]) ?? messages.unknown
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '')
  }
  return Object.assign(message, { item: (issue: ValidationIssue) => itemLabel(issue.item_id) })
}
