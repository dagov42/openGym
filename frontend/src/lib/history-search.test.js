import { describe, expect, it } from 'vitest'
import { buildHistoryIndex, filterHistoryIndex, monthsOf, normalize, rowHaystack } from './history-search.js'
import { historyRows } from './history-rows.js'
import { exOr } from './exercises.js'

const ex = exOr('0025')
const S = {
  routines: [{ id: 'r1', name: 'Push Day' }],
  equipProfiles: [{ id: 'g1', name: 'Home' }, { id: 'g2', name: 'Gym' }],
  customEx: [{ id: 'c1', n: 'Sled drag' }],
  dayNotes: { '2026-11-02': { tag: 'sick', text: 'Flu', _ts: 1 } },
  recoverySessions: { s1: { d: '2026-11-03', kind: 'sauna', min: 20, note: 'Hot room', _ts: 1 } },
  activities: { a1: { d: '2026-11-04', sport: 'run', min: 30, title: 'Morning run', note: 'Rain', _ts: 1 } },
  workouts: [{
    id: 'w1', d: '2026-11-01', name: 'Bench day', note: 'Elbows in',
    gym: { id: 'g1', name: 'Home' }, routineIds: ['r1'], prs: [{ id: 'p1' }],
    entries: [
      { id: '0025', note: 'Entry note', sets: [{ note: 'Set note' }] },
      { id: 'c1', ex: { n: 'Sled drag' }, sets: [] },
    ],
  }],
}

describe('normalize', () => {
  it('ignores case and diacritics and collapses spaces', () => {
    expect(normalize('  Café   CRÈME ')).toBe('cafe creme')
    expect(normalize('ЖИМ ЛЁЖА')).toBe('жим лежа')
    expect(normalize(null)).toBe('')
  })
})

describe('rowHaystack', () => {
  it('covers a workout name, routine, gym, exercise names and notes', () => {
    const hay = rowHaystack(S, { d: S.workouts[0].d, w: S.workouts[0] })
    for (const text of ['bench day', 'push day', 'home', 'elbows in', 'entry note', 'set note', 'sled drag', normalize(ex.n)]) {
      expect(hay).toContain(text)
    }
  })

  it('covers a day note, recovery and activity', () => {
    expect(rowHaystack(S, { d: '2026-11-02', note: { tag: 'sick', text: 'Flu' } })).toContain('flu')
    expect(rowHaystack(S, { d: '2026-11-02', note: { tag: 'sick', text: 'Flu' } })).toContain('sick')
    expect(rowHaystack(S, { d: '2026-11-03', rec: { kind: 'sauna', note: 'Hot room' } })).toContain('hot room')
    expect(rowHaystack(S, { d: '2026-11-03', rec: { kind: 'sauna', note: 'Hot room' } })).toContain('sauna')
    const act = rowHaystack(S, { d: '2026-11-04', act: { sport: 'run', title: 'Morning run', note: 'Rain' } })
    expect(act).toContain('morning run')
    expect(act).toContain('rain')
    expect(act).toContain('run')
    // An unknown sport still gets the fallback label, and a missing title gets the sport's.
    expect(rowHaystack(S, { d: '2026-11-04', act: { sport: 'curling', note: 'Broom' } })).toContain('other sport')
  })

  it('reads the singular routineId and an entry that only carries its own exercise object', () => {
    const old = { ...S, workouts: [{ id: 'old', d: '2026-11-01', routineId: 'r1', entries: [{ id: 'gone', ex: { n: 'Legacy move' }, note: 'Entry', sets: [{}] }] }] }
    const hay = rowHaystack(old, { d: '2026-11-01', w: old.workouts[0] })
    expect(hay).toContain('push day')
    expect(hay).toContain('legacy move')
    expect(hay).toContain('entry')
  })
})

describe('filterHistoryIndex', () => {
  const index = buildHistoryIndex(S, historyRows(S))

  it('matches every term (AND), and an inactive filter leaves the order alone', () => {
    expect(filterHistoryIndex(index, {})).toBe(index)
    expect(filterHistoryIndex(index, { query: 'bench' }).map(e => e.row.w?.id || e.row.rec?.kind || e.row.act?.sport || e.row.note?.tag))
      .toEqual(['w1'])
    expect(filterHistoryIndex(index, { query: 'bench elbows' })).toHaveLength(1)
    expect(filterHistoryIndex(index, { query: 'bench rain' })).toHaveLength(0)
  })

  it('filters by type, month and PR only', () => {
    expect(filterHistoryIndex(index, { type: 'note' }).map(e => e.row.note?.tag)).toEqual(['sick'])
    expect(filterHistoryIndex(index, { type: 'recovery' }).map(e => e.row.rec?.kind)).toEqual(['sauna'])
    expect(filterHistoryIndex(index, { type: 'activity' }).map(e => e.row.act?.sport)).toEqual(['run'])
    expect(filterHistoryIndex(index, { month: '2026-11' })).toHaveLength(4)
    expect(filterHistoryIndex(index, { month: '2026-10' })).toHaveLength(0)
    expect(filterHistoryIndex(index, { pr: true }).map(e => e.row.w?.id)).toEqual(['w1'])
    // A row with no kind is not a workout, a note, recovery or an activity.
    const odd = [{ row: { d: '2026-11-06' }, hay: '' }]
    expect(filterHistoryIndex(odd, { type: 'workout' })).toHaveLength(0)
    expect(filterHistoryIndex(odd, { month: '2026-11' })).toHaveLength(1)
  })

  it('lists the months that actually have rows, newest first', () => {
    expect(monthsOf(index).map(m => m.ym)).toEqual(['2026-11'])
    expect(monthsOf(index)[0].label).toBe('November 2026')
    // Rows without a date contribute no month; duplicate months are one.
    expect(monthsOf([{ d: null }, { d: '2026-01' }, { d: '2026-01' }]).map(m => m.ym)).toEqual(['2026-01'])
  })
})
