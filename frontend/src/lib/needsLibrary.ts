import type { ObjectiveTemplate, RiskTemplate } from './types'

/** TTX-Zone's objective and risk templates (needs analysis, "Add from the
 * library") in the language they are copied in. */
export function objectiveTemplateText(template: ObjectiveTemplate, lang: 'en' | 'es') {
  return lang === 'es'
    ? {
        title: template.title_es,
        statement: template.statement_es,
        criterion: template.criterion_es,
        evidence: template.evidence_es,
      }
    : {
        title: template.title_en,
        statement: template.statement_en,
        criterion: template.criterion_en,
        evidence: template.evidence_en,
      }
}

export function riskTemplateText(template: RiskTemplate, lang: 'en' | 'es') {
  return lang === 'es'
    ? { risk: template.risk_es, mitigation: template.mitigation_es }
    : { risk: template.risk_en, mitigation: template.mitigation_en }
}
