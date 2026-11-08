import type { ActorOrigin, ContentLanguage } from './types'

/** Scenarios: whole exercises packaged for reuse (Library -> Scenarios).
 * The server checks a scenario before anything is written (`dry_run`) and
 * answers with a `ScenarioCheck`; copying one onto an exercise overwrites
 * its content. Files are `.ttx.md` (Markdown with a versioned data block). */

export const SCENARIO_FILE_ACCEPT = '.md,.ttx.md,text/markdown'

export interface ScenarioCounts {
  needs: number
  objectives: number
  phases: number
  injects: number
  actors: number
  threat_actors: number
  tags: number
  images: number
  files: number
}

export const SCENARIO_COUNT_KEYS: (keyof ScenarioCounts)[] = [
  'needs',
  'objectives',
  'phases',
  'injects',
  'actors',
  'threat_actors',
  'tags',
  'images',
  'files',
]

export interface ScenarioIssue {
  /** Where in the document, e.g. `msel.injects[3].phase_code`. */
  path: string
  code: string
  message: string
}

export interface ScenarioVariable {
  name: string
  count: number
}

export interface ScenarioCheck {
  ok: boolean
  errors: ScenarioIssue[]
  warnings: ScenarioIssue[]
  name: string | null
  language: string | null
  format_version: number | null
  counts: ScenarioCounts | null
  /** What the exercise holds today and an apply would replace. */
  replaces: ScenarioCounts | null
  /** The {placeholders} the scenario uses (before any value is filled in). */
  variables: ScenarioVariable[]
  /** The exercise made from the scenario, once it exists. */
  ttx_id?: string | null
}

/** What an exercise holds today; a played one can't be replaced. */
export interface ExerciseScenario extends ScenarioCounts {
  played: boolean
}

export interface ScenarioSummary {
  id: string
  name: string
  description: string | null
  /** The language of this text (a TTX-Zone scenario's follows the reader). */
  language: string
  /** The languages the scenario exists in, whoever reads it. */
  languages: ContentLanguage[]
  format_version: number
  attack_version: string | null
  counts: ScenarioCounts
  origin: ActorOrigin | null
  origin_id: string | null
  origin_name: string | null
  disabled_at: string | null
  usage_count: number
  created_at: string | null
  updated_at: string | null
}

/** The parts of a scenario document the preview shows. */
export interface ScenarioDocument {
  language: string
  exercise: { name: string; description: string | null }
  needs: { objectives: { code: string; title: string; statement: string }[] }
  msel: {
    title: string
    summary: string
    phases: { code: string; name: string; situation_update: string }[]
    injects: {
      code: string
      title: string
      phase_code: string | null
      kind: 'mandatory' | 'contingent'
      offset_minutes: number | null
    }[]
  } | null
  cast: { code: string; name: string }[]
}

export interface ScenarioRead extends ScenarioSummary {
  document: ScenarioDocument
}

/** Where "to this exercise" takes a scenario from. */
export type ScenarioSource = {
  source: 'system' | 'organization'
  id: string
  name: string
  languages: ContentLanguage[]
}
