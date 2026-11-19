import { describe, expect, it } from 'vitest'
import { autoNextMode } from './auto-next.js'

describe('autoNextMode', () => {
  it('reads the three settings of the row', () => {
    expect(autoNextMode('off')).toBe('off')
    expect(autoNextMode('rest')).toBe('rest')
    expect(autoNextMode('now')).toBe('now')
  })

  it('keeps the fork default: a missing key means when the rest ends', () => {
    expect(autoNextMode(undefined)).toBe('rest')
    expect(autoNextMode(null)).toBe('rest')
  })

  it('reads the old switch without changing its behaviour', () => {
    expect(autoNextMode(true)).toBe('rest')
    expect(autoNextMode(false)).toBe('off')
  })

  it('turns anything this app did not write off', () => {
    for (const value of [0, '', 'Now', 'REST', 'yes', {}, []]) {
      expect(autoNextMode(value), JSON.stringify(value)).toBe('off')
    }
  })
})
