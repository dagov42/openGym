import { describe, expect, it } from 'vitest'
import { routinePlanMinutes, sessionLength, uiMinutes } from './session-length.js'

const DAY = '2026-11-18'
const at = (minutes, day = DAY) => {
  const start = new Date(day + 'T10:00:00').getTime()
  return { d: day, start, end: start + minutes * 60000 }
}
const workout = (minutes, ids, day = DAY, extra = {}) => ({ id: 'w' + minutes + day + ids.join(''), ...at(minutes, day), routineIds: ids, entries: [{ id: '0025', sets: [{ done: true }] }], ...extra })
const r = (id, ex) => ({ id, name: id, ex })

const S = {
  restSec: 90,
  nextRestSec: 60,
  routines: [
    r('r1', [{ id: '0025', sets: 3, reps: 8 }]),
    r('r2', [{ id: '0025', sets: 2, reps: 8, warmupSets: 2 }]),
    r('r3', [{ id: '0025', sets: 2, reps: 8, sg: 'a' }, { id: '0027', sets: 2, reps: 8, sg: 'a' }]),
  ],
  workouts: [],
}

describe('uiMinutes', () => {
  it('rounds to 1 below 20 and to 5 above', () => {
    expect(uiMinutes(19)).toBe(19)
    expect(uiMinutes(20)).toBe(20)
    expect(uiMinutes(22)).toBe(20)
    expect(uiMinutes(53)).toBe(55)
    expect(uiMinutes(57)).toBe(55)
  })
})

describe('plan estimate', () => {
  it('counts work, rests, transition and setup for a plain routine', () => {
    expect(routinePlanMinutes(S, S.routines[0])).toBe(6.5)
  })

  it('adds warm-up work and the rest between its rungs', () => {
    expect(routinePlanMinutes(S, S.routines[1])).toBe(6.5)
  })

  it('counts a superset round once, not once per member', () => {
    const one = sessionLength(S, ['r1']).minutes
    const two = sessionLength(S, ['r3']).minutes
    expect(two).toBeLessThan(one * 2)
    expect(two).toBeGreaterThan(0)
  })

  it('has no estimate for a routine with no exercises', () => {
    expect(routinePlanMinutes(S, { id: 'empty', ex: [] })).toBe(null)
  })
})

describe('history estimate', () => {
  it('uses the median of the last five exact-set sessions', () => {
    const s = { ...S, workouts: [10, 20, 30, 40, 50].map((n, i) => workout(n, ['r1'], '2026-11-' + String(10 + i).padStart(2, '0'))) }
    const out = sessionLength(s, ['r1'])
    expect(out).toMatchObject({ source: 'history', samples: 5 })
    expect(out.minutes).toBe(30)
  })

  it('ignores a combined session for a solo routine, and treats the set order as irrelevant', () => {
    const s = { ...S, workouts: [workout(20, ['r1']), workout(40, ['r1', 'r2']), workout(30, ['r2', 'r1'])] }
    expect(sessionLength(s, ['r1', 'r2'])).toMatchObject({ source: 'history', samples: 2, minutes: 35 })
    expect(sessionLength(s, ['r1']).source).toBe('plan')
  })

  it('filters short, long, excluded and fully no-progression sessions', () => {
    const s = { ...S, workouts: [
      workout(3, ['r1']), workout(5 * 60, ['r1']), workout(10, ['r1'], '2026-11-15'),
      workout(30, ['r1'], '2026-11-16'), workout(40, ['r1'], '2026-11-17'),
      workout(20, ['r1'], '2026-11-18', { excludeFromProgression: true }),
      workout(30, ['r1'], '2026-11-18', { entries: [{ id: '0025', noProg: true }] }),
    ] }
    const out = sessionLength(s, ['r1'])
    expect(out).toMatchObject({ source: 'history', samples: 3 })
    expect(out.minutes).toBe(30)
  })
})

describe('combined sessions', () => {
  it('sums the two routines and marks a plan side as mixed', () => {
    const s = { ...S, workouts: [workout(20, ['r1'])] }
    const out = sessionLength(s, ['r1', 'r2'])
    expect(out.source).toBe('mixed')
    expect(out.minutes).toBeGreaterThan(10)
  })

  it('uses an exact combined history when there is one', () => {
    const s = { ...S, workouts: [workout(20, ['r1']), workout(70, ['r1', 'r2']), workout(50, ['r2', 'r1'])] }
    expect(sessionLength(s, ['r1', 'r2'])).toMatchObject({ source: 'history', minutes: 60, samples: 2 })
  })
})
