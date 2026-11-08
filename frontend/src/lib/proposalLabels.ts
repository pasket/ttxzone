import type { Proposal, ProposalTarget } from './proposals'

/** How each kind of row an AI proposal names reads, for the proposals
 * panel and Platform's activity log. */
export const TARGET_LABEL_KEYS = {
  need: 'assistant.targets.need',
  objective: 'assistant.targets.objective',
  needs_scope: 'assistant.targets.scope',
  needs_tlp: 'assistant.targets.tlp',
  ttx_meta: 'assistant.targets.exercise',
  inject: 'assistant.targets.inject',
  msel_phase: 'assistant.targets.phase',
  msel_actor: 'assistant.targets.actor',
  msel_threat: 'assistant.targets.threatActor',
  msel_meta: 'assistant.targets.mselSettings',
  msel_renumber: 'assistant.targets.codeReset',
  eeg_point: 'assistant.targets.eegPoint',
  aar_text: 'assistant.targets.reportText',
  aar_objective: 'assistant.targets.objective',
  aar_action: 'assistant.targets.improvementAction',
} as const

/** The Creator section where each kind of proposal waits. */
export type ProposalSection = 'exercise' | 'needs' | 'msel' | 'conduct-prep' | 'after-action'

export const PROPOSAL_SECTIONS: Record<ProposalTarget, ProposalSection> = {
  need: 'needs',
  objective: 'needs',
  needs_scope: 'needs',
  needs_tlp: 'needs',
  ttx_meta: 'exercise',
  inject: 'msel',
  msel_phase: 'msel',
  msel_actor: 'msel',
  msel_threat: 'msel',
  msel_meta: 'msel',
  msel_renumber: 'msel',
  eeg_point: 'conduct-prep',
  aar_text: 'after-action',
  aar_objective: 'after-action',
  aar_action: 'after-action',
}

export const SECTION_TITLE_KEYS = {
  exercise: 'creator.sections.exercise',
  needs: 'creator.sections.needs',
  msel: 'creator.sections.msel',
  'conduct-prep': 'creator.sections.conductPrep',
  'after-action': 'creator.sections.afterAction',
} as const satisfies Record<ProposalSection, string>

/** Sent when a page accepts or discards proposals, so the menu's counts
 * follow without polling. */
export const PROPOSALS_CHANGED_EVENT = 'ttx:assistant-proposals-changed'

export function countBySection(items: Proposal[]): Partial<Record<ProposalSection, number>> {
  const counts: Partial<Record<ProposalSection, number>> = {}
  for (const p of items) {
    const section = PROPOSAL_SECTIONS[p.target]
    if (section) counts[section] = (counts[section] ?? 0) + 1
  }
  return counts
}
