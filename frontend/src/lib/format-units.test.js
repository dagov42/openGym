import { describe, expect, it } from 'vitest'
import { fmtVol, fmtWeight } from './format.js'
import { _setLangState } from './i18n-core.js'
import ru from '../locales/ru.js'

describe('weight units follow the language', () => {
  it('Russian shows кг and фунт, English keeps kg and lb', () => {
    _setLangState('ru', ru, null, null)
    expect(fmtVol(0, 'kg')).toBe('0 кг')
    expect(fmtWeight(80, 'lb')).toBe('80 фунт')
    _setLangState('en', {}, null, null)
    expect(fmtVol(0, 'kg')).toBe('0 kg')
    expect(fmtWeight(80, 'lb')).toBe('80 lb')
  })
})
