import { splitVariables } from '../../lib/injectLibrary'

/** A template text with its {variables} set apart, so it reads as a
 * template: they're filled in per exercise. */
export function VariableText({ text }: { text: string }) {
  return (
    <>
      {splitVariables(text).map((part, index) =>
        part.variable ? (
          <span
            translate="no"
            key={index}
            className="rounded-xs bg-accent/10 px-1 font-mono text-[0.85em] text-accent-fg"
          >
            {`{${part.text}}`}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}
