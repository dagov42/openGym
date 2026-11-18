import { describe, expect, it } from 'vitest'
import { fmtMonth } from './format.js'

describe('fmtMonth', () => {
  it('labels a YYYY-MM month through the date locale', () => {
    expect(fmtMonth('2026-11')).toBe('November 2026')
    expect(fmtMonth('2026-01')).toBe('January 2026')
  })

  it('returns anything that is not a valid month as it came in', () => {
    expect(fmtMonth('2026-13')).toBe('2026-13')
    expect(fmtMonth('2026-1')).toBe('2026-1')
    expect(fmtMonth('November')).toBe('November')
    expect(fmtMonth('')).toBe('')
    expect(fmtMonth(null)).toBe(null)
  })
})
