import { afterEach, describe, expect, it } from 'vitest'

import i18n from '../src/lib/i18n'

describe('i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('keeps <html lang> in step with the active language', async () => {
    await i18n.changeLanguage('es')
    expect(document.documentElement.lang).toBe('es')
    await i18n.changeLanguage('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
