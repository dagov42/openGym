import { describe, expect, it } from 'vitest'
import { _setLangState, t } from './i18n-core.js'
import ru from '../locales/ru.js'

// The horizons used to be looked up through a dynamic object, so the source-string check could
// not see them and the UI showed "6 months" beside "3 месяца" in the Russian sheet.
describe('lift goal horizon labels', () => {
  it('translate all three horizons in Russian', () => {
    _setLangState('ru', ru, null, null)
    expect(t('3 months')).toBe('3 месяца')
    expect(t('6 months')).toBe('6 месяцев')
    expect(t('1 year')).toBe('1 год')
    _setLangState('en', {}, null, null)
  })
})
