/** How a coded row -- a need, objective, phase, inject, threat actor,
 * expected action or ATT&CK technique -- is named anywhere in the app: its
 * code first, then its title. A code is never shown alone, and several are
 * never run together with commas (CodeRefList stacks them).
 *
 * - Table cell: CodeRef `stacked` -- the code in bold, the title under it.
 * - List, checkbox, sentence: CodeRef `inline` -- "OBJ-01 | Title…".
 * - Plain text (native <option>, toast, aria-label, tooltip): codeRefText.
 */

/** How much of a title a one-line reference shows. */
export const CODE_REF_TITLE_CHARS = 40

/** A title cut to `max` characters, marked when cut. */
export function shortTitle(title: string, max = CODE_REF_TITLE_CHARS): string {
  const trimmed = title.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed
}

/** "OBJ-01 | Contain the ransomware…": the plain-text form. With no title,
 * just the code; with no code yet (a row not saved), `pending` in its
 * place. `max` cuts the title (Infinity: whole, e.g. a dialog heading). */
export function codeRefText(
  code: string,
  title: string,
  pending = '',
  max = CODE_REF_TITLE_CHARS,
): string {
  const ref = code || pending
  const short = shortTitle(title, max)
  if (!short) return ref
  return ref ? `${ref} | ${short}` : short
}

/** The codes the app issues (OBJ-01, NEED-02, PH-03, INJ-04, INJ-C05,
 * INJ-04-A1, DSC-06, DSC-06-A1, POL-07, THR-01, ACT-02, TTX-2026-01) and MITRE ATT&CK's (T1486,
 * T1566.001, TA0040, G0005), as they appear inside a sentence. */
export const CODE_PATTERN =
  /\b(?:(?:OBJ|NEED|PH|THR|ACT|TTX)-\d{2,4}(?:-\d{2})?|INJ-C?\d{2}(?:-A\d+)?|DSC-\d{2}(?:-A\d+)?|POL-\d{2}|INJ-[A-Z]{3}-C?\d{2}|T\d{4}(?:\.\d{3})?|TA\d{4}|G\d{4})\b/g
