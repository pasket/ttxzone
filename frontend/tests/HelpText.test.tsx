import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HelpText } from '../src/components/common/HelpText'
import { act, fireEvent, render, screen } from './testUtils'

const TEXT = 'Build the session here: one incident in a few phases, with injects.'

/** jsdom lays nothing out: say whether the text needs more than its line
 * -- cut when folded, wrapping when open -- as a browser would measure it. */
function layout(textWidth: number, lineWidth = 400) {
  const long = () => textWidth > lineWidth
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => textWidth)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(lineWidth)
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() =>
    rects(long() ? [0, 20] : [0]),
  )
}

/** The rects of an inline element, one per fragment, at these tops. */
function rects(tops: number[]) {
  return tops.map((top) => ({ top, height: 18 })) as unknown as DOMRectList
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback()
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

const toggle = () => screen.getByRole('button', { name: /^Show (more|less)$/ })
const shown = () => screen.getByText(TEXT)

describe('HelpText', () => {
  it('shows a text that fits on one line whole, with no button', () => {
    layout(300)
    render(<HelpText id="test.intro" text={TEXT} />)
    expect(shown()).not.toHaveClass('truncate')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('takes a line split by an inline element for one line', () => {
    layout(300)
    // An <abbr> in the text: three fragments side by side, one line.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => rects([0, 0, 0]))
    render(<HelpText id="test.intro" text={TEXT} />)
    expect(shown()).not.toHaveClass('truncate')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens a longer one the first time, then starts it folded to one line', () => {
    layout(900)
    const { unmount } = render(<HelpText id="test.intro" text={TEXT} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(toggle()).toHaveTextContent('Show less')
    expect(shown()).not.toHaveClass('truncate')
    unmount()

    render(<HelpText id="test.intro" text={TEXT} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveTextContent('Show more')
    // Cut with an ellipsis on its one line.
    expect(shown()).toHaveClass('truncate')
  })

  it('remembers the viewer opening it again', () => {
    layout(900)
    localStorage.setItem('ttx_help', JSON.stringify({ 'test.intro': 'seen' }))
    const { unmount } = render(<HelpText id="test.intro" text={TEXT} />)
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    unmount()

    render(<HelpText id="test.intro" text={TEXT} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('drops the button once the text fits again', () => {
    let width = 900
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => width)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() =>
      rects(width > 400 ? [0, 20] : [0]),
    )
    let resize = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {
          resize()
        }
        disconnect() {}
      },
    )
    render(<HelpText id="test.intro" text={TEXT} />)
    expect(toggle()).toBeInTheDocument()
    width = 300
    act(() => resize())
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('still opens when storage is unavailable', () => {
    layout(900)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<HelpText id="test.intro" text={TEXT} />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })
})
