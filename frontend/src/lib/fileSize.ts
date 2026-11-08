/** A file size for people: B, KB or MB, in the reader's locale. */
export function formatSize(bytes: number, locale: string): string {
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (bytes < 1024) return `${fmt.format(bytes)} B`
  if (bytes < 1024 * 1024) return `${fmt.format(bytes / 1024)} KB`
  return `${fmt.format(bytes / (1024 * 1024))} MB`
}
