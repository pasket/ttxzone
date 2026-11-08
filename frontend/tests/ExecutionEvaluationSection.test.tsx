import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ExecutionEvaluationSection } from '../src/components/playground/ExecutionEvaluationSection'
import type { EEGRead } from '../src/lib/types'
import { render } from './testUtils'

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const eeg: EEGRead = {
  ttx_id: 'ttx-1',
  exercise_code: 'TTX-2026-01',
  exercise_name: 'Ransomware drill',
  tlp: 'amber',
  needs_form_status: 'approved',
  needs_form_version: 2,
  objectives: [
    {
      id: 'obj-1',
      code: 'OBJ-01',
      capability: 'regulatory_notification',
      statement: 'Decide on the NIS2 early warning within 60 minutes.',
      observation_points: ['Decision documented', 'Rationale recorded'],
      evidence: 'Minutes and timeline.',
    },
  ],
  rating_scale: ['P', 'S', 'M', 'U'],
}

function renderSection(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  )
  render(
    <MemoryRouter initialEntries={['/playground/ttx-1/evaluation']}>
      <Routes>
        <Route path="/playground/:ttxId/evaluation" element={<ExecutionEvaluationSection />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ExecutionEvaluationSection', () => {
  it("shows the approved needs analysis's EEG with its TLP label", async () => {
    renderSection(json(200, eeg))

    expect(await screen.findByText('Decision documented')).toBeInTheDocument()
    expect(screen.getByText('Rationale recorded')).toBeInTheDocument()
    expect(screen.getByText('TLP:AMBER')).toBeInTheDocument()
    expect(screen.getByText('From version 2 of the approved needs analysis.')).toBeInTheDocument()
    expect(screen.getByText('P — Performed without challenges')).toBeInTheDocument()
    expect(screen.getByText('Draft EEG')).toBeInTheDocument()
  })

  it("shows the ready plan's definitive EEG with the levels each point adjusts", async () => {
    renderSection(
      json(200, {
        ...eeg,
        source: 'plan',
        plan_version: 1,
        plan_reopened: true,
        lead_evaluator: 'Eva Luator',
        objectives: [
          {
            ...eeg.objectives[0],
            evaluators: ['Eva Luator'],
            points: [
              {
                id: 'pt-1',
                kind: 'expected_action',
                text: 'Committee records the decision',
                criteria: { P: '', S: '', M: 'Prompted', U: '' },
                action_code: 'INJ-01-A1',
                inject_code: 'INJ-01',
                inject_title: 'SOC alert',
                responsible_role: 'Committee',
                expected_within_minutes: 15,
              },
            ],
          },
        ],
      }),
    )

    expect(await screen.findByText('Committee records the decision')).toBeInTheDocument()
    expect(screen.getByText('Prompted')).toBeInTheDocument()
    // The common scale once; only the adjusted level under the point.
    expect(screen.getAllByText(/Done and achieved, with room to be more effective/)).toHaveLength(1)
    expect(screen.getAllByText('M', { selector: 'dt' })).not.toHaveLength(0)
    expect(screen.queryAllByText('P', { selector: 'dt' })).toHaveLength(0)
    expect(screen.getByText('Evaluated by: Eva Luator')).toBeInTheDocument()
    expect(screen.queryByText('Decision documented')).not.toBeInTheDocument()
    expect(screen.queryByText('Draft EEG')).not.toBeInTheDocument()
    expect(
      screen.getByText(/A new version of the evaluation plan is being prepared/),
    ).toBeInTheDocument()
  })

  it('gives observers the notifications to recognise, deadlines first', async () => {
    // The description starts open the first time it's seen.
    window.localStorage.clear()
    renderSection(
      json(200, {
        ...eeg,
        notifications: [
          {
            requirement_id: 'GDPR-33-34',
            framework: 'GDPR',
            framework_label_en: 'GDPR',
            framework_label_es: 'RGPD',
            reference: 'Arts. 33–34',
            description_en: 'Personal data breach notification',
            description_es: 'Notificación de brechas',
            objective_codes: ['OBJ-01'],
            milestones: [
              {
                recipient_en: 'Data protection authority',
                recipient_es: 'Autoridad de protección de datos',
                stage_en: 'Breach notification',
                stage_es: 'Notificación de la brecha',
                deadline_en: '72 h',
                deadline_es: '72 h',
                clock_en: 'Awareness of the breach',
                clock_es: 'Conocimiento de la brecha',
              },
            ],
          },
        ],
      }),
    )

    const reference = await screen.findByRole('region', { name: 'Expected notifications' })
    expect(reference).toHaveTextContent('GDPR Arts. 33–34')
    expect(reference).toHaveTextContent('72 h')
    expect(reference).toHaveTextContent('Names who notifies, by role')
    expect(reference).toHaveTextContent('The clock is simulated')
  })

  it('says how each objective is judged and lists the evidence to collect', async () => {
    renderSection(
      json(200, {
        ...eeg,
        objectives: [
          {
            ...eeg.objectives[0],
            achieve_at_least: 1,
            time_box_minutes: 15,
            partially_achieved: 'No rationale recorded.',
            evidence_items: ['Minutes', 'Timeline'],
          },
        ],
      }),
    )

    expect(await screen.findByText('Achieved with at least 1 of 2 conditions')).toBeInTheDocument()
    expect(screen.getByText('Within 15 min of the inject that triggers it')).toBeInTheDocument()
    // Each outcome beside the boxes it stands for; a blank one reads the
    // common definition.
    expect(screen.getByText('No rationale recorded.')).toBeInTheDocument()
    expect(screen.getByText('Partially achieved')).toBeInTheDocument()
    expect(
      screen.getAllByText("Not done, or done in a way that doesn't achieve what was expected.")
        .length,
    ).toBeGreaterThan(1)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('explains the wait while the needs analysis is not approved', async () => {
    renderSection(
      json(409, {
        success: false,
        error: { code: 'NEEDS_FORM_NOT_APPROVED', message: 'Not yet', ttx_id: 'ttx-1' },
      }),
    )

    expect(await screen.findByText("The EEG isn't ready yet")).toBeInTheDocument()
  })
})
