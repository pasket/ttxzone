import { fireEvent, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LibrarySection } from '../src/components/templates/LibrarySection'
import { render } from './testUtils'

const mockAuth = {
  activeOrganizationId: 'org-1',
  activeTtxId: 'ttx-1' as string | null,
  activeTtx: { id: 'ttx-1', needs_form_status: 'draft' } as {
    id: string
    needs_form_status: string
  } | null,
  ttxList: [{ id: 'ttx-1', content_language: 'en' }],
}
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mockAuth }))

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

const catalog = {
  attack_version: '19.2',
  items: [
    {
      id: 'INJ-RAN-02',
      title: { es: 'Nota de rescate con cuenta atrás', en: 'Ransom note with a countdown' },
      content: {
        es: 'El grupo {attacker_group} exige {ransom_amount} por {data_type}.',
        en: 'The {attacker_group} group demands {ransom_amount} for {data_type}.',
      },
      kind: 'mandatory',
      contingent_for: null,
      trigger: null,
      purpose: null,
      actor: 'threat-actor',
      delivery_method: 'document',
      recipients: [{ es: 'Comité de crisis', en: 'Crisis committee' }],
      expected_actions: [
        {
          description: { es: 'Denuncia ante la policía', en: 'Reports to the police' },
          responsible_role: { es: 'Legal', en: 'Legal' },
          within_minutes: 240,
        },
      ],
      attachments: [],
      key_question: { es: '¿Abrimos el chat?', en: "Do we open the attacker's chat?" },
      facilitator_notes: null,
      families: ['ransomware'],
      stage: 'escalation',
      capabilities: ['crisis_decision_making'],
      audience: 'mixed',
      attack: [
        {
          domain: 'enterprise',
          tactic_id: 'TA0040',
          tactic_name: 'Impact',
          technique_id: 'T1486',
          technique_name: 'Data Encrypted for Impact',
        },
      ],
      frameworks: [],
      variables: ['attacker_group', 'data_type', 'ransom_amount'],
      variable_defaults: {
        attacker_group: { es: 'Nébula', en: 'Nebula' },
        ransom_amount: { es: '4,5 millones de dólares', en: 'USD 4.5 million' },
      },
    },
    {
      id: 'INJ-DOS-01',
      title: { es: 'Ataque DDoS en curso', en: 'Denial-of-service attack under way' },
      content: { es: 'Ataque de {ddos_volume}.', en: 'A {ddos_volume} attack.' },
      kind: 'mandatory',
      contingent_for: null,
      trigger: null,
      purpose: null,
      actor: 'critical-supplier',
      delivery_method: 'phone',
      recipients: [{ es: 'SOC', en: 'SOC' }],
      expected_actions: [
        {
          description: { es: 'Activa la mitigación', en: 'Activates mitigation' },
          responsible_role: { es: 'SOC', en: 'SOC' },
          within_minutes: 15,
        },
      ],
      attachments: [],
      key_question: null,
      facilitator_notes: null,
      families: ['ddos'],
      stage: 'detection',
      capabilities: ['detection_triage_escalation'],
      audience: 'technical',
      attack: [],
      frameworks: [],
      variables: ['ddos_volume'],
      variable_defaults: { ddos_volume: { es: '180 Gbps', en: '180 Gbps' } },
    },
  ],
}

const actors = {
  items: [
    {
      id: 'threat-actor',
      type: 'threat_actor',
      name_en: 'Fictitious threat actor',
      name_es: 'Actor de amenaza ficticio',
      description_en: '',
      description_es: '',
      channel: 'document',
      default: true,
    },
  ],
}

const emptyMsel = {
  editable: true,
  injects: [],
  phases: [],
  actors: [],
  needs: { objectives: [] },
  time_compression: 60,
  attack_version: '19.2',
}

function stubCatalog() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      json(
        url.includes('/inject-catalog')
          ? catalog
          : url.includes('/actor-catalog')
            ? actors
            : url.includes('/msel')
              ? emptyMsel
              : { items: [] },
      ),
    ),
  )
}

function renderInjects(withExercise: boolean, entry = '/creator/ttx-1/library/injects') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LibrarySection withExercise={withExercise} kind="injects" />
    </MemoryRouter>,
  )
}

describe('LibrarySection — injects', () => {
  beforeEach(() => {
    stubCatalog()
    mockAuth.activeTtxId = 'ttx-1'
    mockAuth.activeTtx = { id: 'ttx-1', needs_form_status: 'draft' }
  })

  it('shows the title, intro and the three levels, TTX-Zone first', () => {
    renderInjects(true)
    expect(screen.getByRole('heading', { name: 'Injects' })).toBeInTheDocument()
    expect(screen.getByText(/move the scenario forward/)).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Library level' })
    expect(group).toHaveTextContent('TTX-ZoneMy organizationThis exercise')
    expect(screen.getByRole('button', { name: 'TTX-Zone' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Generic injects that come with TTX-Zone/)).toBeInTheDocument()
  })

  it('lists the kinds in tab order, tags last', () => {
    renderInjects(true)
    const tabs = screen.getByRole('navigation', { name: 'Library' })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Simulated actors', 'Threat actors', 'Injects', 'Scenarios', 'Tags'])
  })

  it('opens a catalog inject from its View action, not from its title', async () => {
    renderInjects(true)
    expect(await screen.findByText('Ransom note with a countdown')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ransom note with a countdown' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View INJ-RAN-02: Ransom note with a countdown' }),
    ).toBeInTheDocument()
  })

  it('lists the catalog with its codes and senders', async () => {
    renderInjects(true)
    expect(await screen.findByText('INJ-RAN-02')).toBeInTheDocument()
    expect(screen.getByText('INJ-DOS-01')).toBeInTheDocument()
    expect(await screen.findByText('Fictitious threat actor')).toBeInTheDocument()
    expect(screen.getByText('2 injects')).toBeInTheDocument()
  })

  it('filters by family and search, from the URL too', async () => {
    renderInjects(true, '/creator/ttx-1/library/injects?family=ddos')
    expect(await screen.findByText('INJ-DOS-01')).toBeInTheDocument()
    expect(screen.queryByText('INJ-RAN-02')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Family'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ransom' } })
    expect(screen.getByText('INJ-RAN-02')).toBeInTheDocument()
    expect(screen.queryByText('INJ-DOS-01')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'nothing like this' } })
    expect(screen.getByText('Nothing matches the filters.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('INJ-DOS-01')).toBeInTheDocument()
  })

  it('opens an inject in full, variables set apart with their defaults', async () => {
    renderInjects(true)
    fireEvent.click(
      await screen.findByRole('button', { name: 'View INJ-RAN-02: Ransom note with a countdown' }),
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent("Do we open the attacker's chat?")
    expect(dialog).toHaveTextContent('Reports to the police')
    expect(dialog).toHaveTextContent('4 h')
    expect(dialog).toHaveTextContent('Default: USD 4.5 million')
    expect(dialog).toHaveTextContent('T1486 Data Encrypted for Impact')
    expect(screen.getAllByText('{ransom_amount}').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('switches level', () => {
    renderInjects(true)
    fireEvent.click(screen.getByRole('button', { name: 'My organization' }))
    expect(screen.getByText(/Your organization’s own injects/)).toBeInTheDocument()
  })

  it('offers no exercise level in Admin, even when the URL asks for it', () => {
    renderInjects(false, '/admin/library/injects?tab=exercise')
    expect(screen.queryByRole('button', { name: 'This exercise' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'TTX-Zone' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('points to the needs analysis until it is approved', () => {
    renderInjects(true, '/creator/ttx-1/library/injects?tab=exercise')
    expect(screen.getByRole('link', { name: 'Go to the needs analysis' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs',
    )
  })

  it('lists the MSEL level once the needs analysis is approved', async () => {
    mockAuth.activeTtx = { id: 'ttx-1', needs_form_status: 'approved' }
    renderInjects(true, '/creator/ttx-1/library/injects?tab=exercise')
    expect(await screen.findByText("This exercise's MSEL has no injects yet.")).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Go to the needs analysis' })).not.toBeInTheDocument()
  })
})
