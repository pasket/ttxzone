import { useTranslation } from 'react-i18next'

import { splitAcronyms } from '../../lib/glossary'

/** Renders app copy with its glossary acronyms marked up as <abbr> (dotted
 * underline, expansion on hover -- WCAG technique H28). No tab stops: the
 * header's glossary panel is the keyboard and touch route to the same definitions.
 * Inside a link or button the cursor stays a pointer: a help cursor there
 * reads as "not clickable". `plain` drops the underline where it would single
 * one item out of a set of siblings (menu entries), keeping the hover title.
 * For app-authored strings only, never user content. */
export function AcronymText({ text, plain = false }: { text: string; plain?: boolean }) {
  const { t } = useTranslation()
  const terms = t('glossary.terms', { returnObjects: true }) as Record<
    string,
    { expansion: string }
  >
  return (
    <>
      {splitAcronyms(text).map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <abbr
            key={index}
            title={terms[part.term]?.expansion}
            className={
              plain
                ? 'no-underline'
                : 'cursor-help underline decoration-dotted decoration-from-font underline-offset-2 [a_&]:cursor-pointer [button_&]:cursor-pointer'
            }
          >
            {part.term}
          </abbr>
        ),
      )}
    </>
  )
}
