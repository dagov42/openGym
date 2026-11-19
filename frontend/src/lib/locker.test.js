import { describe, expect, it } from 'vitest'
import { LOCKER_MAX, cleanLocker, lockerOf } from './locker.js'

describe('locker numbers', () => {
  it('trims, caps and keeps letters and punctuation', () => {
    expect(cleanLocker('  B-42  ')).toBe('B-42')
    expect(cleanLocker('12A')).toBe('12A')
    expect(cleanLocker('x'.repeat(50))).toBe('x'.repeat(LOCKER_MAX))
  })

  it('drops control characters and treats anything but a string as empty', () => {
    expect(cleanLocker(' B\u0000-42\n')).toBe('B-42')
    expect(cleanLocker(null)).toBe('')
    expect(cleanLocker(42)).toBe('')
  })

  it('reads a card safely, capping a hostile saved value', () => {
    expect(lockerOf({ locker: '  42 ' })).toBe('42')
    expect(lockerOf({ locker: 'z'.repeat(10000) })).toHaveLength(LOCKER_MAX)
    expect(lockerOf({})).toBe('')
    expect(lockerOf(null)).toBe('')
  })
})
