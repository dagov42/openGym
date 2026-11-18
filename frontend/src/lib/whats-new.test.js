// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { itemsFor, normalizeVersion, readSeen, shouldShow, writeSeen, SEEN_KEY } from './whats-new.js'

afterEach(() => { try { localStorage.removeItem(SEEN_KEY) } catch { /* no storage */ } })

describe('whats-new data', () => {
  it('finds the notes for a version and strips build metadata', () => {
    expect(itemsFor('1.4.8')).toHaveLength(4)
    expect(itemsFor('1.4.8.1+2026-11-18')).toEqual(itemsFor('1.4.8.1'))
    expect(normalizeVersion('1.4.6+2026-11-16')).toBe('1.4.6')
    expect(itemsFor('9.9.9')).toBeNull()
  })

  it('shows only for a newer version with notes, and waits while busy', () => {
    expect(shouldShow('', '1.4.8', { firstRun: true })).toBe('no')
    expect(shouldShow('', '1.4.8')).toBe('no')
    expect(shouldShow('1.4.8', '1.4.8')).toBe('no')
    expect(shouldShow('1.4.7', '1.4.8')).toBe('show')
    expect(shouldShow('1.4.7', '1.4.8', { busy: true })).toBe('wait')
    expect(shouldShow('1.5.0', '1.4.8')).toBe('no')
    expect(shouldShow('1.4.8', '9.9.9')).toBe('no')
  })

  it('reads and writes the device version without throwing', () => {
    expect(readSeen()).toBe('')
    writeSeen('1.4.8')
    expect(readSeen()).toBe('1.4.8')
  })
})

