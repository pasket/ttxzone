/** A library row's main cell: the item's name and what it is, at most two
 * lines of it (the whole text on hover, and in the item itself). */
export function LibraryItemText({
  title,
  description,
  marks,
}: {
  title: string
  description?: string | null
  /** Small marks after the name. */
  marks?: React.ReactNode
}) {
  return (
    <>
      <span className="block text-sm font-medium">
        {title}
        {marks}
      </span>
      {description && (
        <span
          title={description}
          className="mt-0.5 line-clamp-2 max-w-3xl text-[0.8125rem]/5 text-pretty text-paper-ink/70 dark:text-fg-muted"
        >
          {description}
        </span>
      )}
    </>
  )
}
