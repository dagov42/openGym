import { describe, expect, it } from 'vitest'
import { lastUsedByRoutine, recentRoutines } from './recent-routines.js'

const NOW = Date.UTC(2026, 10, 18, 18)
const iso = daysAgo => new Date(NOW - daysAgo * 864e5).toISOString().slice(0, 10)
const at = (daysAgo, hour = 10) => Date.UTC(2026, 10, 18 - daysAgo, hour)
const routine = (id, extra = {}) => ({ id, name: id.toUpperCase(), ex: [], ...extra })
const workout = (d, routineIds, start = new Date(d + 'T12:00:00').getTime()) => ({ id: 'w' + d + ':' + routineIds.join('+'), d, start, routineIds, entries: [] })

const S = (workouts, routines = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => routine(id))) => ({ routines, workouts })

describe('lastUsedByRoutine', () => {
  it('records a single routine, combined sessions for both, and skips deleted or idless workouts', () => {
    const map = lastUsedByRoutine(S([
      workout(iso(2), ['a']),
      workout(iso(1), ['a', 'b']),
      workout(iso(1), ['gone']),
      { id: 'imported', d: iso(1), entries: [] },
    ]))
    expect(map.get('a').at).toBe(new Date(iso(1) + 'T12:00:00').getTime())
    expect(map.get('b').at).toBe(new Date(iso(1) + 'T12:00:00').getTime())
    expect(map.has('gone')).toBe(false)
    expect(map.size).toBe(2)
  })

  it('keeps the newest workout, with the later start winning a same-day tie', () => {
    const map = lastUsedByRoutine(S([
      workout(iso(5), ['a'], at(5)),
      workout(iso(1), ['a'], at(1, 8)),
      workout(iso(1), ['a'], at(1, 20)),
    ]))
    expect(map.get('a')).toEqual({ at: at(1, 20), day: iso(1) })
  })
})

describe('recentRoutines', () => {
  it('returns the five newest in the window and omits a routine used once long ago', () => {
    const list = recentRoutines(S([
      workout(iso(1), ['a']), workout(iso(2), ['b']), workout(iso(3), ['c']),
      workout(iso(4), ['d']), workout(iso(5), ['e']), workout(iso(100), ['f']),
    ]), { now: NOW })
    expect(list.map(r => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('drops the section for fewer than two routines and respects the limit and exclusions', () => {
    expect(recentRoutines(S([workout(iso(1), ['a'])]), { now: NOW })).toEqual([])
    expect(recentRoutines(S([workout(iso(1), ['a']), workout(iso(2), ['b'])]), { now: NOW, limit: 1 })).toEqual([])
    const list = recentRoutines(S([workout(iso(1), ['a']), workout(iso(2), ['b']), workout(iso(3), ['c'])]), { now: NOW, exclude: ['a'] })
    expect(list.map(r => r.id)).toEqual(['b', 'c'])
  })

  it('keeps Plan order for a tie and includes both sides of a combined session', () => {
    const combined = recentRoutines(S([
      { ...workout(iso(1), ['a', 'b']), d: iso(1) },
      workout(iso(2), ['c']),
    ]), { now: NOW })
    expect(combined.map(r => r.id)).toEqual(['a', 'b', 'c'])
    const tied = recentRoutines(S([
      { ...workout(iso(1), ['b']), start: at(1) },
      { ...workout(iso(1), ['a']), start: at(1) },
    ]), { now: NOW })
    expect(tied.map(r => r.id)).toEqual(['a', 'b'])
  })

  it('has nothing for an empty profile or unknown routine ids', () => {
    expect(recentRoutines(S([]), { now: NOW })).toEqual([])
    expect(recentRoutines(S([workout(iso(1), ['gone']), workout(iso(2), ['gone2'])], [routine('a')]), { now: NOW })).toEqual([])
  })
})
