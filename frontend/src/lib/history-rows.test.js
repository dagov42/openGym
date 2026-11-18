import { describe, expect, it } from 'vitest'
import { historyRows } from './history-rows.js'

const S = {
  workouts: [
    { id: 'w1', d: '2026-11-02', start: 2, name: 'Push', entries: [] },
    { id: 'w2', d: '2026-11-03', start: 3, name: 'Pull', entries: [] },
    { id: 'w3', d: '2026-11-03', start: 1, name: 'Earlier same day', entries: [] },
  ],
  dayNotes: {
    '2026-11-01': { tag: 'sick', text: 'Flu', _ts: 1 },
    '2026-11-02': { tag: 'rest', text: 'A note on a trained day', _ts: 1 },
  },
  recoverySessions: { r1: { d: '2026-11-04', kind: 'sauna', min: 20, note: 'Hot', _ts: 1 } },
  activities: { a1: { d: '2026-11-05', sport: 'run', min: 30, title: 'Morning run', _ts: 1 } },
}

describe('historyRows', () => {
  it('mixes workouts, day notes, recovery and activities newest first', () => {
    const rows = historyRows(S)
    expect(rows.map(r => (r.w ? 'w:' + r.w.id : r.note ? 'n:' + r.d : r.rec ? 'r:' + r.rec.id : 'a:' + r.act.id)))
      .toEqual(['a:a1', 'r:r1', 'w:w3', 'w:w2', 'w:w1', 'n:2026-11-01'])
  })

  it('keeps a trained day\'s note out (the workout speaks for that day) and keeps stored order within a day', () => {
    const rows = historyRows(S)
    expect(rows.some(r => r.note?.text === 'A note on a trained day')).toBe(false)
    expect(rows.filter(r => r.d === '2026-11-03').map(r => r.w.id)).toEqual(['w3', 'w2'])
  })

  it('handles an empty profile', () => {
    expect(historyRows({})).toEqual([])
    expect(historyRows({ workouts: [], dayNotes: {}, recoverySessions: {}, activities: {} })).toEqual([])
  })
})
