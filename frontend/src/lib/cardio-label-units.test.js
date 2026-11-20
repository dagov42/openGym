import { describe, expect, it } from 'vitest'
import { setLabel } from './history.js'
import { _setLangState } from './i18n-core.js'
import ru from '../locales/ru.js'

// The cardio recap on the workout screen used to print the English literals "21 min @ 10.5
// km/h" in every language. The minutes and the speed unit now go through t().
describe('cardio set label units', () => {
  const cfg = { id: '3666', mode: 'cardio' }
  it('uses Russian minutes and speed', () => {
    _setLangState('ru', ru, null, null)
    expect(setLabel('3666', { min: 21, speed: 10.5, done: true }, cfg, 'kmh')).toBe('21 мин @ 10,5 км/ч')
    _setLangState('en', {}, null, null)
  })

  it('keeps the English text unchanged', () => {
    _setLangState('en', {}, null, null)
    expect(setLabel('3666', { min: 21, speed: 10.5, done: true }, cfg, 'kmh')).toBe('21 min @ 10.5 km/h')
  })
})
