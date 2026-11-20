import { describe, expect, it } from 'vitest'
import ru from '../exercise-desc/ru.js'
import en from '../exercise-desc/en.js'

describe('Russian exercise descriptions', () => {
  it('covers the whole catalogue with non-empty translated text', () => {
    expect(Object.keys(ru)).toEqual(Object.keys(en))
    for (const [id, text] of Object.entries(ru)) {
      expect(typeof text, id).toBe('string')
      expect(text.trim(), id).toBeTruthy()
      expect(text, id).not.toMatch(/@@@/)
    }
  })
})
