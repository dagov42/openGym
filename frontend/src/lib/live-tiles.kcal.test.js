import { describe, expect, it } from 'vitest'
import { kcalSoFar } from './live-tiles.js'
import { MET } from './active-energy.js'

// The live tile must use the same estimate as the saved workout: a walk is walking from the
// first minute, not strength training's MET for every session.
describe('kcalSoFar', () => {
  const start = new Date(2026, 8, 17, 18).getTime()
  const walk = { id: '3666', target: { mode: 'cardio' }, sets: [{ min: 60, done: false }] }
  const S = { unit: 'kg', bodyweight: [] }

  it('uses the planned type before any set and rounds like activeKcal', () => {
    const A = { start, entries: [walk] }
    expect(kcalSoFar(S, A, start + 3600e3)).toBe(Math.round((MET.walking - 1) * 75))
  })

  it('uses the cardio MET once its minutes are logged', () => {
    const A = { start, entries: [{ ...walk, sets: [{ min: 60, done: true }] }] }
    expect(kcalSoFar(S, A, start + 3600e3)).toBe(Math.round((MET.walking - 1) * 75))
  })

  it('has nothing before the workout starts', () => {
    expect(kcalSoFar(S, { start, entries: [walk] }, start)).toBeNull()
  })
})
