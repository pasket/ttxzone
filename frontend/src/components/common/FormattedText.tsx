import type { ReactNode } from 'react'

/** Text written with the formatting toolbar (`FormattedTextArea`): a small
 * Markdown subset -- **bold**, _italic_, "- " bullet and "1. " numbered
 * lists, blank-line paragraphs, and with `headings` "# " / "## " / "### "
 * titles (long documents such as the legal ones). Rendered as React
 * elements, never as HTML, so nothing typed can inject markup. Anything
 * else shows as typed. */
export function FormattedText({
  text,
  className = '',
  headings = false,
}: {
  text: string
  className?: string
  headings?: boolean
}) {
  return <div className={`space-y-2 ${className}`}>{blocks(text, headings)}</div>
}

type Block =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'bullets' | 'numbers'; items: string[] }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }

const BULLET = /^\s*[-*]\s+(.*)$/
const NUMBER = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^(#{1,3})\s+(.*)$/

function parse(text: string, headings: boolean): Block[] {
  const result: Block[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const last = result[result.length - 1]
    const heading = headings ? HEADING.exec(line) : null
    if (heading) {
      result.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] })
      continue
    }
    const bullet = BULLET.exec(line)
    const number = bullet ? null : NUMBER.exec(line)
    if (bullet || number) {
      const kind = bullet ? 'bullets' : 'numbers'
      const item = (bullet ?? number)![1]
      if (last && last.kind === kind) last.items.push(item)
      else result.push({ kind, items: [item] })
    } else if (!line.trim()) {
      // A blank line ends the paragraph or list.
      if (last && !(last.kind === 'paragraph' && last.lines.length === 0)) {
        result.push({ kind: 'paragraph', lines: [] })
      }
    } else if (last && last.kind === 'paragraph') {
      last.lines.push(line)
    } else {
      result.push({ kind: 'paragraph', lines: [line] })
    }
  }
  return result.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0)
}

const HEADING_CLASS = {
  1: 'pt-2 text-lg font-semibold text-balance',
  2: 'pt-2 text-base font-semibold text-balance',
  3: 'text-sm font-semibold text-balance',
}

function blocks(text: string, headings: boolean): ReactNode[] {
  return parse(text, headings).map((block, index) => {
    if (block.kind === 'heading') {
      // Inside a page or dialog that already has its h1/h2: one level down.
      const Tag = (['h2', 'h3', 'h4'] as const)[block.level - 1]
      return (
        <Tag key={index} className={HEADING_CLASS[block.level]}>
          {inline(block.text)}
        </Tag>
      )
    }
    if (block.kind === 'paragraph') {
      return (
        <p key={index} className="text-pretty">
          {block.lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {inline(line)}
            </span>
          ))}
        </p>
      )
    }
    const items = block.items.map((item, i) => <li key={i}>{inline(item)}</li>)
    return block.kind === 'bullets' ? (
      <ul key={index} className="list-disc space-y-0.5 pl-5">
        {items}
      </ul>
    ) : (
      <ol key={index} className="list-decimal space-y-0.5 pl-5">
        {items}
      </ol>
    )
  })
}

/** **bold** and _italic_ (or *italic*), not nested across each other. */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|(?<![\w*])_(.+?)_(?!\w)|(?<![\w*])\*(?!\s)(.+?)\*(?![\w*])/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[1]}
        </strong>,
      )
    } else {
      parts.push(<em key={match.index}>{match[2] ?? match[3]}</em>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
