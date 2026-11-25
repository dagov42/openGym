import { describe, expect, it } from 'vitest'
import {
  pausesOf, pausedOn, pausedWeekKeys, heldWeeksBetween, withPlanPause, resumePlanPause,
} from './plan-pause.js'

const S = pauses => ({ planPauses: pauses, weekStart: 1 })
const p = (from, to, extra = {}) => ({ [from]: { to, reason: 'holiday', _ts: 1, ...extra } })

describe('plan pauses', () => {
  it('reads a closed range inclusively and an open-ended one', () => {
    const paused = pausesOf(S({ ...p('2026-12-20', '2026-12-27'), ...p('2027-01-10', null) }))
    expect(paused).toHaveLength(2)
    expect(pausedOn(S(p('2026-12-20', '2026-12-27')), '2026-12-19')).toBe(null)
    expect(pausedOn(S(p('2026-12-20', '2026-12-27')), '2026-12-20')).toMatchObject({ from: '2026-12-20' })
    expect(pausedOn(S(p('2026-12-20', '2026-12-27')), '2026-12-27')).toMatchObject({ from: '2026-12-20' })
    expect(pausedOn(S(p('2026-12-20', '2026-12-27')), '2026-12-28')).toBe(null)
    expect(pausedOn(S(p('2027-01-10', null)), '2027-03-01')).toMatchObject({ from: '2027-01-10' })
  })

  it('drops tombstones, bad ranges and junk', () => {
    const map = {
      ...p('2026-12-20', '2026-12-27'),
      '2026-12-28': { _ts: 2 },
      'bad': { to: null, reason: 'holiday', _ts: 1 },
      '2026-12-29': { to: '2026-12-01', reason: 'sick', _ts: 1 },
      '2026-12-30': { to: null, reason: 'holiday' },
    }
    expect(pausesOf(S(map)).map(x => x.from)).toEqual(['2026-12-20'])
  })

  it('unions overlaps and a later start wins for display', () => {
    const map = { ...p('2026-12-20', '2026-12-31'), ...p('2026-12-25', '2027-01-05') }
    expect(pausedOn(S(map), '2026-12-27')).toMatchObject({ from: '2026-12-25' })
  })

  it('marks paused weeks for Monday and Sunday starts', () => {
    const map = p('2026-12-20', '2026-12-27')
    expect([...pausedWeekKeys(S(map), 1)]).toEqual(['2026-12-14', '2026-12-21'])
    expect([...pausedWeekKeys(S(map), 0)]).toEqual(['2026-12-20', '2026-12-27'])
  })

  it('counts held programme weeks only when the switch is on', () => {
    const map = { ...p('2026-12-20', '2027-01-02'), ...p('2027-01-03', '2027-01-09', { holdProgramme: false }) }
    expect(heldWeeksBetween(S(map), '2026-12-01', '2027-01-31')).toBe(0)
    expect(heldWeeksBetween(S({ ...p('2026-12-20', '2027-01-02', { holdProgramme: true }) }), '2026-12-01', '2027-01-31')).toBe(2)
    expect(heldWeeksBetween(S(map), '2027-01-01', '2027-01-31')).toBe(0)
  })

  it('writes and resumes with stamped entries', () => {
    const map = withPlanPause({}, '2026-12-20', { to: '2026-12-27', reason: 'holiday', note: '  Lanzarote ', holdProgramme: true }, 100)
    expect(map['2026-12-20']).toMatchObject({ to: '2026-12-27', reason: 'holiday', note: 'Lanzarote', holdProgramme: true, _ts: 100 })
    const resumed = resumePlanPause(map, '2026-12-20', '2026-12-24', 200)
    expect(resumed['2026-12-20']).toMatchObject({ to: '2026-12-23', _ts: 200 })
    expect(resumePlanPause(map, '2026-12-24', '2026-12-24', 300)['2026-12-24']).toEqual({ _ts: 300 })
  })

  it('limits the map and ignores bad write dates when reading', () => {
    let map = {}
    for (let i = 0; i < 60; i++) map = withPlanPause(map, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, { to: null, reason: 'other' }, i + 1)
    expect(Object.keys(map).length).toBeGreaterThan(0)
    expect(pausesOf(S({ 'x': { to: null, reason: 'holiday', _ts: 1 } }))).toEqual([])
  })
})
