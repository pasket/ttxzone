/** The addresses typed in the email invitations' box: split on commas,
 * semicolons, spaces and line breaks, empty pieces dropped, each once. */
export function parseAddresses(text: string): string[] {
  const seen = new Set<string>()
  for (const piece of text.split(/[\s,;]+/)) {
    const address = piece.trim()
    if (address) seen.add(address)
  }
  return Array.from(seen)
}
