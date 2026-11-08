import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ProposalsPanel } from '../src/components/assistant/ProposalsPanel'
import { ATTENTION_CHANGED_EVENT } from '../src/lib/attention'
import type { IssueMessage } from '../src/lib/issueGroups'
import type { NeedsFormDraft } from '../src/lib/needsForm'
import { mergeNeedsProposals, type Proposal } from '../src/lib/proposals'
import { render } from './testUtils'

function respond(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as Response
}

const NEED = {
  id: 'n1',
  key: 'n1',
  code: 'NEED-01',
  source: 'risk_analysis',
  title: 'Old title',
  finding: '',
  affected_capability: 'crisis_decision_making',
  priority: 'high',
}

const DRAFT = {
  capabilities: ['crisis_decision_making'],
  needs: [NEED],
  objectives: [],
  risks: [],
} as unknown as NeedsFormDraft

function proposal(over: Partial<Proposal>): Proposal {
  return {
    id: 'p1',
    batch_id: 'b1',
    target: 'need',
    operation: 'create',
    target_id: null,
    base: null,
    patch: {},
    depends_on: [],
    summary: '',
    issues: [],
    status: 'pending',
    applied_row_id: null,
    created_at: '2026-11-01T10:00:00Z',
    decided_at: null,
    outdated: false,
    ...over,
  }
}

const CREATE = proposal({
  id: 'p-create',
  summary: 'Recovery is the weak point.',
  patch: {
    source: 'previous_aar',
    title: 'Backups untested',
    affected_capability: 'crisis_decision_making',
    priority: 'high',
  },
})
const UPDATE = proposal({
  id: 'p-update',
  operation: 'update',
  target_id: 'n1',
  base: { title: 'Old title' },
  patch: { title: 'Sharper title' },
})

/** The page's side: a draft, a saved baseline, and a "save" button that
 * stands in for the autosave (rows get ids). */
function Harness({
  confirming = false,
  initial = DRAFT,
  issueMessage,
}: {
  confirming?: boolean
  initial?: NeedsFormDraft
  issueMessage?: IssueMessage
}) {
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(initial)
  return (
    <>
      <ProposalsPanel<NeedsFormDraft>
        ttxId="t1"
        targets={['need', 'objective']}
        draftRows={{ need: draft.needs, objective: draft.objectives }}
        savedRows={{ need: saved.needs, objective: saved.objectives }}
        codeOf={(id) => draft.needs.find((n) => n.id === id)?.code || undefined}
        merge={(group, accepted) => mergeNeedsProposals(draft, group, accepted)}
        apply={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        disabledReason={confirming ? 'Answer the open question first.' : null}
        issueMessage={issueMessage}
      />
      <button
        type="button"
        onClick={() => {
          const withIds = {
            ...draft,
            needs: draft.needs.map((n) => ({ ...n, id: n.id ?? `saved-${n.key}` })),
          }
          setDraft(withIds)
          setSaved(withIds)
        }}
      >
        save
      </button>
      <button
        type="button"
        onClick={() => {
          // A save the page can't match to the proposal: the row is
          // saved, but not as the proposal reads it (the server
          // normalized it).
          const normalized = {
            ...draft,
            needs: draft.needs.map((n) => ({ ...n, title: `${n.title} ` })),
          }
          setDraft(normalized)
          setSaved(normalized)
        }}
      >
        save unmatched
      </button>
      <button
        type="button"
        onClick={() => {
          // The save keeps what the form keeps: the row comes back.
          setDraft(initial)
          setSaved(initial)
        }}
      >
        save restored
      </button>
      <output data-testid="titles">{draft.needs.map((n) => n.title).join('|')}</output>
    </>
  )
}

describe('ProposalsPanel', () => {
  it('accepts into the draft and marks applied once saved', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [CREATE, UPDATE] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    expect(await screen.findByText('Recovery is the weak point.')).toBeInTheDocument()
    expect(screen.getByText('2 to review')).toBeInTheDocument()
    const [acceptCreate, acceptUpdate] = screen.getAllByRole('button', { name: 'Accept' })
    fireEvent.click(acceptCreate)
    fireEvent.click(acceptUpdate)

    expect(screen.getByTestId('titles')).toHaveTextContent('Sharper title|Backups untested')
    expect(screen.getAllByText('Accepted, saving…')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const applied = fetchMock.mock.calls
      .slice(1)
      .map(([path, init]) => [path, JSON.parse(init.body)])
    expect(applied).toEqual(
      expect.arrayContaining([
        [
          expect.stringMatching(/proposals\/p-create\/applied$/),
          { row_id: expect.stringMatching(/^saved-/) },
        ],
        [expect.stringMatching(/proposals\/p-update\/applied$/), { row_id: 'n1' }],
      ]),
    )
    await waitFor(() => expect(screen.queryByText('AI proposals')).not.toBeInTheDocument())
  })

  it('keeps Accept off while a confirmation is open, and discards', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [CREATE] }))
      .mockResolvedValueOnce(respond({ discarded: ['p-create'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness confirming />)

    expect(await screen.findByRole('button', { name: 'Accept' })).toBeDisabled()
    expect(screen.getByText('Answer the open question first.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(await screen.findByText('Proposal discarded')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][0]).toMatch(/proposals\/p-create\/discard$/)
    await waitFor(() => expect(screen.queryByText('AI proposals')).not.toBeInTheDocument())
  })

  it('asks before replacing an edit made since', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          respond({ items: [{ ...UPDATE, base: { title: 'Something else' } }] }),
        ),
    )

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(screen.getByText('You changed this since')).toBeInTheDocument()
    expect(screen.getByTestId('titles')).toHaveTextContent('Old title')
    fireEvent.click(screen.getByRole('button', { name: 'Replace with the proposal' }))
    expect(screen.getByTestId('titles')).toHaveTextContent('Sharper title')
  })

  it('marks applied at once an update the saved document already holds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [UPDATE] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)
    const holding = { ...DRAFT, needs: [{ ...NEED, title: 'Sharper title' }] } as NeedsFormDraft

    render(<Harness initial={holding} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/proposals\/p-update\/applied$/)
    expect(JSON.parse(init.body)).toEqual({ row_id: 'n1' })
    await waitFor(() => expect(screen.queryByText('AI proposals')).not.toBeInTheDocument())
  })

  it('closes one that comes back after a save, without asking again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [UPDATE] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'save unmatched' }))

    expect(await screen.findByText('Already saved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ row_id: 'n1' })
    await waitFor(() => expect(screen.queryByText('AI proposals')).not.toBeInTheDocument())
  })

  it('offers Discard when the row it came back for is not saved', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [UPDATE] }))
      .mockResolvedValueOnce(
        respond(
          {
            success: false,
            error: {
              code: 'ASSISTANT_PROPOSAL_ROW_NOT_SAVED',
              message: "That row isn't saved in this exercise.",
              ttx_id: 't1',
            },
          },
          409,
        ),
      )
      .mockResolvedValue(respond({ discarded: ['p-update'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'save unmatched' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    expect(await screen.findByText("That row isn't saved in this exercise.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(fetchMock.mock.calls[2][0]).toMatch(/proposals\/p-update\/discard$/))
  })

  it('accepts every proposal in one go', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [CREATE, UPDATE] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept all (2)' }))

    expect(screen.getByTestId('titles')).toHaveTextContent('Sharper title|Backups untested')
    expect(screen.getAllByText('Accepted, saving…')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Accept all/ })).not.toBeInTheDocument()
  })

  it('discards every proposal once confirmed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [CREATE, UPDATE] }))
      .mockResolvedValueOnce(respond({ discarded: ['p-create'] }))
      .mockResolvedValueOnce(respond({ discarded: ['p-update'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Discard all' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discard every proposal?' })
    expect(dialog).toHaveTextContent('The 2 proposals waiting here are discarded.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard all' }))

    await waitFor(() => expect(screen.queryByText('AI proposals')).not.toBeInTheDocument())
    const discarded = fetchMock.mock.calls.slice(1).map(([path]) => path)
    expect(discarded).toEqual([
      expect.stringMatching(/p-create\/discard$/),
      expect.stringMatching(/p-update\/discard$/),
    ])
  })

  it('folds the changes of each one when the list is long', async () => {
    const many = [1, 2, 3, 4].map((n) =>
      proposal({ ...CREATE, id: `p-${n}`, summary: `Proposal ${n}` }),
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ items: many })))

    render(<Harness />)

    expect(await screen.findByText('Proposal 1')).toBeInTheDocument()
    const [first] = screen.getAllByText('4 changes')
    expect(first.closest('details')).not.toHaveAttribute('open')
  })

  it('groups the proposals on one row, accepting all of them or the ones ticked', async () => {
    const priority = proposal({
      id: 'p-priority',
      operation: 'update',
      target_id: 'n1',
      base: { priority: 'high' },
      patch: { priority: 'low' },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [UPDATE, priority] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    expect(await screen.findByText('· 2 proposals')).toBeInTheDocument()
    const [title, level] = screen.getAllByRole('checkbox')
    expect(title).toBeChecked()
    expect(level).toBeChecked()
    expect(screen.getByRole('button', { name: 'Accept these (2)' })).toBeInTheDocument()

    fireEvent.click(level)
    fireEvent.click(screen.getByRole('button', { name: 'Accept selected (1)' }))

    expect(screen.getByTestId('titles')).toHaveTextContent('Sharper title')
    // The unticked one still waits, ticked again for its own decision.
    expect(screen.getByRole('button', { name: 'Accept these (1)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Discard these' })).toBeEnabled()
  })

  it('shows what a group does together, and its warnings in words', async () => {
    const owners = (id: string, values: string[], summary: string) =>
      proposal({
        id,
        operation: 'update',
        target_id: 'n1',
        base: { title: 'Old title', owners: [] },
        patch: { owners: values },
        summary,
        issues: [{ level: 'warning', code: 'OWNER_UNKNOWN', field: 'owners', item: 'n1' }],
      })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond({
          items: [
            owners('p-a', ['Crisis committee'], 'The board must hear it.'),
            owners('p-b', ['SOC shift lead'], 'The SOC acts first.'),
          ],
        }),
      ),
    )
    const issueMessage = Object.assign(
      () => 'NEED-01: an owner isn’t one of the exercise’s areas.',
      { item: () => 'NEED-01' },
    )

    render(<Harness issueMessage={issueMessage} />)

    expect(await screen.findByText('Result of accepting them')).toBeInTheDocument()
    const together = screen.getByText('Result of accepting them').parentElement as HTMLElement
    expect(within(together).getByText('+ Crisis committee')).toBeInTheDocument()
    expect(within(together).getByText('+ SOC shift lead')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'The board must hear it.' })).toBeChecked()
    expect(screen.getAllByText('An owner isn’t one of the exercise’s areas.')).toHaveLength(2)
    expect(screen.queryByText(/OWNER_UNKNOWN/)).not.toBeInTheDocument()
  })

  it('names proposed rows and fields as the form does, never by internal names', async () => {
    const threat = proposal({
      id: 'p-threat',
      target: 'msel_threat',
      patch: { name: 'Sandworm Team', mitre_group_id: 'G0034' },
    })
    const attributed = proposal({
      id: 'p-inject',
      target: 'inject',
      operation: 'update',
      target_id: 'i1',
      base: { attack_attribution: 'noise', contingent_purpose: '' },
      patch: {
        attack_attribution: 'threat_actor',
        threat_actor_key: 'proposal:p-threat',
        contingent_purpose: 'Raise the pressure',
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ items: [threat, attributed] })))

    render(
      <ProposalsPanel<NeedsFormDraft>
        ttxId="t1"
        targets={['msel_threat', 'inject']}
        draftRows={{}}
        savedRows={{}}
        codeOf={() => 'INJ-22'}
        merge={() => ({ patch: {}, keys: {}, conflicts: [], missing: [] })}
        apply={() => undefined}
        disabledReason={null}
      />,
    )

    expect(await screen.findByText('Sandworm Team (proposed)')).toBeInTheDocument()
    expect(screen.getByText(/A threat actor/)).toBeInTheDocument()
    expect(screen.getByText('Noise')).toBeInTheDocument()
    expect(screen.getByText('Purpose')).toBeInTheDocument()
    expect(screen.queryByText(/proposal:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/contingent purpose/i)).not.toBeInTheDocument()
  })

  it('says what a deletion removes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respond({ items: [proposal({ id: 'p-del', operation: 'delete', target_id: 'n1' })] }),
        ),
    )

    render(<Harness />)

    expect(await screen.findByText('Delete need NEED-01')).toBeInTheDocument()
    expect(screen.getByText('Removes “Old title”.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByTestId('titles')).toHaveTextContent(/^$/)
  })

  it('shows a named changeset as one set, accepted together', async () => {
    const named = (over: Partial<Proposal>) => proposal({ changeset: 'Close MSEL v5', ...over })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond({
          items: [
            named({ ...CREATE, changeset: 'Close MSEL v5' }),
            named({ ...UPDATE, changeset: 'Close MSEL v5' }),
          ],
        }),
      ),
    )

    render(<Harness />)

    expect(await screen.findByText('Changeset “Close MSEL v5”')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept these (2)' }))
    expect(screen.getByTestId('titles')).toHaveTextContent('Sharper title|Backups untested')
  })

  it('runs a code reset as the own action of the page, applied once the codes follow the order', async () => {
    const reset = proposal({
      id: 'p-reset',
      target: 'msel_renumber',
      operation: 'update',
      target_id: 'm1',
      patch: { kind: 'injects' },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [reset, CREATE] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)
    const onAction = vi.fn()

    function Page({ outOfOrder }: { outOfOrder: string[] }) {
      return (
        <ProposalsPanel<NeedsFormDraft>
          ttxId="t1"
          targets={['msel_renumber', 'need']}
          draftRows={{}}
          savedRows={{
            msel_renumber: [{ id: 'm1', key: 'm1', out_of_order: outOfOrder } as never],
          }}
          codeOf={() => undefined}
          merge={() => ({ patch: {}, keys: {}, conflicts: [], missing: [] })}
          apply={() => undefined}
          disabledReason={null}
          onAction={onAction}
        />
      )
    }

    const { rerender } = render(<Page outOfOrder={['injects']} />)

    expect(await screen.findByText('Reset inject codes to storyline order')).toBeInTheDocument()
    // Accept all leaves the action out: it runs on its own.
    expect(screen.queryByRole('button', { name: /^Accept all/ })).not.toBeInTheDocument()
    const [acceptReset] = screen.getAllByRole('button', { name: 'Accept' })
    fireEvent.click(acceptReset)
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-reset' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender(<Page outOfOrder={[]} />)
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/proposals\/p-reset\/applied$/),
        expect.objectContaining({ body: JSON.stringify({ row_id: 'm1' }) }),
      ),
    )
  })

  it('says what waits on other pages and what to accept there first', async () => {
    const scope = proposal({
      id: 'p-scope',
      target: 'needs_scope',
      operation: 'update',
      target_id: 'f1',
      changeset: 'Close it',
      patch: { participating_areas: ['Board'] },
    })
    const inject = proposal({
      id: 'p-inject',
      target: 'inject',
      operation: 'update',
      target_id: 'i1',
      changeset: 'Close it',
      depends_on: ['p-scope'],
      patch: { recipients: ['Board'] },
    })
    const other = proposal({ ...inject, id: 'p-other', depends_on: [], changeset: 'Close it' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ items: [scope, inject, other] })))

    render(
      <MemoryRouter initialEntries={['/creator/t1/msel']}>
        <ProposalsPanel<NeedsFormDraft>
          ttxId="t1"
          targets={['inject']}
          draftRows={{}}
          savedRows={{}}
          codeOf={() => 'INJ-01'}
          merge={() => ({ patch: {}, keys: {}, conflicts: [], missing: [] })}
          apply={() => undefined}
          disabledReason={null}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Also waiting:')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'Needs analysis' })
    expect(links[0]).toHaveAttribute('href', '/creator/t1/needs')
    expect(screen.getByText(/Accept first: Change the scope, in/)).toBeInTheDocument()
    expect(screen.getByText(/1 more of this set waits in/)).toBeInTheDocument()
  })

  it('says when the form kept a row a deletion took out, and offers to discard it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        respond({ items: [proposal({ id: 'p-del', operation: 'delete', target_id: 'n1' })] }),
      )
      .mockResolvedValue(respond({ discarded: ['p-del'] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
    expect(screen.getByTestId('titles')).toHaveTextContent(/^$/)
    // The save goes through, and the form brings the row back.
    window.dispatchEvent(new Event(ATTENTION_CHANGED_EVENT))
    fireEvent.click(screen.getByRole('button', { name: 'save restored' }))

    expect(await screen.findByText('Kept by the form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/p-del\/discard$/),
        expect.anything(),
      ),
    )
  })

  it('groups the observation points of one objective under its EEG', async () => {
    const point = (id: string, target: string, summary: string) =>
      proposal({ id, target: 'eeg_point', operation: 'delete', target_id: target, summary })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond({
          items: [
            point('d1', 'pt1', 'Test criterion'),
            point('d2', 'pt2', 'Test action'),
            point('d3', 'pt3', 'Other objective'),
          ],
        }),
      ),
    )
    const owners: Record<string, string> = { pt1: 'OBJ-01', pt2: 'OBJ-01', pt3: 'OBJ-02' }

    render(
      <ProposalsPanel<NeedsFormDraft>
        ttxId="t1"
        targets={['eeg_point']}
        draftRows={{}}
        savedRows={{}}
        codeOf={(id) => owners[id]}
        merge={() => ({ patch: {}, keys: {}, conflicts: [], missing: [] })}
        apply={() => undefined}
        disabledReason={null}
      />,
    )

    expect(await screen.findByText('EEG of OBJ-01')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Test criterion' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Test action' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Accept these (2)' })).toBeInTheDocument()
    // The other objective's point stands alone.
    expect(screen.queryByText('EEG of OBJ-02')).not.toBeInTheDocument()
  })

  it('marks applied at once a presentation the saved exercise already holds', async () => {
    const presentation = proposal({
      id: 'p-ex',
      target: 'ttx_meta',
      operation: 'update',
      target_id: 't1',
      base: { name: 'Old' },
      patch: { name: 'New name' },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [presentation] }))
      .mockResolvedValue(respond({}))
    vi.stubGlobal('fetch', fetchMock)
    const row = { id: 't1', key: 't1', name: 'New name', description: '', content_language: 'en' }

    render(
      <ProposalsPanel<NeedsFormDraft>
        ttxId="t1"
        targets={['ttx_meta']}
        draftRows={{ ttx_meta: [row] }}
        savedRows={{ ttx_meta: [row] }}
        codeOf={() => 'TTX-0001'}
        merge={() => ({ patch: {}, keys: {}, conflicts: [], missing: [] })}
        apply={() => undefined}
        disabledReason={null}
        autoApply={['ttx_meta']}
      />,
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/p-ex\/applied$/),
        expect.objectContaining({ body: JSON.stringify({ row_id: 't1' }) }),
      ),
    )
  })
})
