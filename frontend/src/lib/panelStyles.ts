/** Content-panel surface: white on the light page bg, a lighter gray on
 * the dark one -- separated by tone plus a hairline border, never a shadow
 * (design-system rule for static panels). Layout rule: the page bg is the
 * page, a panel is one object on it (a list, a form, a settings group, a
 * chart); page titles and their primary action stay outside, on the bg. */
export const panelClass = 'rounded-sm border border-panel-line bg-panel'

/** Hairline between a panel's header/body/footer bands. */
export const panelDivider = 'border-panel-line'

/* A table running edge to edge inside a `flush` Panel: cells keep a 20px
 * inset at the panel's outer edges (first:/last:) so text lines up with
 * the panel header above it, and rows get a hover tint for scanning. */
export const panelTableHeadRow =
  'border-b border-panel-line text-xs font-medium text-paper-ink/60 dark:text-fg-muted'
export const panelTh = 'px-3 py-2.5 font-medium first:pl-5 last:pr-5'
export const panelTbody = 'divide-y divide-panel-line'
export const panelTr = 'transition-colors hover:bg-hover motion-reduce:transition-none'
/** A row of a long list (the MITRE groups, the ATT&CK picker, the inject
 * catalog): the browser skips laying it out while it's off screen. */
export const lazyRow = '[content-visibility:auto] [contain-intrinsic-size:auto_3rem]'
export const panelTd = 'px-3 py-3 first:pl-5 last:pr-5'
/** The column a table is about (name and description): it takes the spare
 * width, so the short columns stay together on the right. */
export const panelMainTh = `${panelTh} w-full min-w-64`
/** A count: right-aligned with even digits, to compare down the column. */
export const panelNumTh = `${panelTh} text-right whitespace-nowrap`
export const panelNumTd = `${panelTd} text-right text-sm tabular-nums`
/** Trailing Actions header inside a panel table -- same fixed width as
 * buttonStyles' actionsHeaderClass (two h-9 icon buttons + gap) plus the
 * panel's 20px right inset. */
export const panelActionsTh = `${panelTh} w-28 text-right`

/* Width rule for module pages: one right edge per page. Every panel --
 * list, form, identity band, dashboard -- spans the page's content width
 * (AuthenticatedLayout's cap, wider with the Primary Menu folded),
 * so stacked panels line up and a list swapping to its create form
 * doesn't make the page jump in width. What
 * stays narrow is the *fields* inside a form panel: they sit in a readable
 * column (`panelFormFields`, or a max-w-sm group for short forms), while
 * the footer spans the panel with its actions at the right edge (the
 * Vercel/GitHub settings pattern). Don't cap a panel's own width. */
export const panelFormFields = 'max-w-2xl'

/** A panel form's footer row: Cancel then the committing action, right-aligned. */
export const panelFormActions = 'flex justify-end gap-2'
