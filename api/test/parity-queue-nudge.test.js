// The api's reminder copy of the queue and nudge rules must answer exactly as the app's copy.
// The mirrored test cases in api/test/queue.test.js and api/test/nudge.test.js check each side
// against the rule; this checks the two implementations against each other on the same state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as feQueue from '../../frontend/src/lib/queue.js'
import * as apiQueue from '../queue.js'
import { nudgeFor as feNudge, nudgeMinute as feNudgeMinute, toneOf as feToneOf, lineIndex as feLineIndex } from '../../frontend/src/lib/nudge.js'
import { nudgeFor as apiNudge, nudgeMinute as apiNudgeMinute, toneOf as apiToneOf, lineIndex as apiLineIndex } from '../nudge.js'

const routines = [{ id: 'd1', name: 'US W1 D1' }, { id: 'd2', name: 'US W1 D2' }, { id: 'd3', name: 'US W1 D3' }]
const SINCE = Date.parse('2026-09-07T08:00:00')
const TODAY = '2026-09-09'
const Q = (over = {}) => ({
  routines,
  workouts: [],
  queue: { ids: ['d1', 'd2', 'd3'], since: SINCE, startsOn: '2026-09-07', label: 'US W1' },
  ...over,
})
const w = (over = {}) => ({ id: 'w', d: '2026-09-08', start: SINCE + 3600000, routineIds: [], routineId: null, name: '', ...over })

test('pinState agrees on open, done, pinned and future days', () => {
  const done = Q({ workouts: [w({ routineIds: ['d1'], start: SINCE })] })
  const pinned = Q({ dayPlan: { '2026-09-10': 'd2' } })
  const future = Q({ workouts: [w({ routineIds: ['d2'], start: SINCE - 86400000, d: '2026-09-10', name: 'US W1 D2' })] })
  const cases = [
    [Q(), 'd1', TODAY, undefined],
    [Q(), 'nope', TODAY, undefined],
    [done, 'd1', TODAY, undefined],
    [done, 'd2', TODAY, undefined],
    [pinned, 'd2', TODAY, undefined],
    [pinned, 'd2', '2026-09-10', '2026-09-10'],
    [pinned, 'd2', '2026-09-09', '2026-09-10'],
    [future, 'd2', TODAY, undefined],
    [future, 'd2', '2026-09-10', undefined],
    [future, 'd1', '2026-09-09', undefined],
  ]
  for (const [S, id, today, iso] of cases) {
    assert.equal(
      feQueue.pinState(S, id, today, iso),
      apiQueue.pinState(S, id, today, iso),
      `pinState(${id}, ${today}, ${iso})`,
    )
  }
})

test('queueLiveOn agrees while the pass has a session left', () => {
  const doneAll = Q({ workouts: ['d1', 'd2', 'd3'].map((id, i) => w({ id: 'w' + i, routineIds: [id], start: SINCE })) })
  const oneDone = Q({ workouts: [w({ routineIds: ['d1'], start: SINCE })] })
  for (const S of [Q(), oneDone, doneAll, Q({ queue: { ...Q().queue, startsOn: '2026-09-10' } })]) {
    for (const iso of ['2026-09-07', '2026-09-09', '2026-09-10', '2026-09-20']) {
      assert.equal(feQueue.queueLiveOn(S, iso, iso), apiQueue.queueLiveOn(S, iso), `queueLiveOn(${iso})`)
    }
  }
})

// The app returns every routine id a day names (a combined day can name two); the api returns the
// one route its reminder copy pushes. They agree when the day names one routine, which is every
// fixture here.
const nudgeState = (over = {}) => ({
  routines: [{ id: 'push', name: 'Push' }, { id: 'pull', name: 'Pull' }],
  week: { 1: 'push', 3: 'push', 5: 'push' },
  dayPlan: {},
  workouts: [],
  reminder: { on: true, nudge: true, time: '08:00' },
  ...over,
})
const nw = d => ({ id: 'w' + d, d, routineId: 'push' })
const normNudge = (r) => (Array.isArray(r) ? (r.length === 1 ? r[0] : r) : r)

test('nudgeFor agrees on misses, rest days, back-off and notes', () => {
  const states = [
    nudgeState({ workouts: [nw('2026-09-04')] }),
    nudgeState({ workouts: [nw('2026-09-04'), nw('2026-09-15')] }),
    nudgeState({ week: { 0: 'push', 1: 'push', 2: 'push', 3: 'push', 4: 'push', 5: 'push', 6: 'push' } }),
    nudgeState({ workouts: [nw('2026-09-04')], dayPlan: { '2026-09-07': 'rest' } }),
    nudgeState({ workouts: [nw('2026-09-04')], dayNotes: { '2026-09-07': { tag: 'sick', _ts: 1 } } }),
    nudgeState({ workouts: [nw('2026-09-04')], dayNotes: { '2026-09-07': { text: 'Flight', _ts: 1 } } }),
    nudgeState({ workouts: [nw('2026-09-04')], dayNotes: { '2026-09-07': { _ts: 2 } } }),
    nudgeState({ week: {}, queue: { ids: ['push', 'pull'], since: 1, startsOn: '2026-09-07' }, workouts: [{ id: 'a', d: '2026-09-07', routineId: 'push', start: 1 }] }),
  ]
  const dates = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16']
  for (const st of states) {
    for (const iso of dates) {
      assert.equal(normNudge(feNudge(st, iso)), apiNudge(st, iso), `nudgeFor(${iso})`)
    }
  }
})

test('the small shared helpers agree', () => {
  for (const time of ['08:00', '19:00', '19:30', '19:31', undefined]) {
    assert.equal(feNudgeMinute(time), apiNudgeMinute(time), `nudgeMinute(${time})`)
  }
  for (const tone of ['friendly', 'guilt', 'drill', 'nope', undefined]) {
    assert.equal(feToneOf({ tone }), apiToneOf({ tone }), `toneOf(${tone})`)
  }
  for (const iso of ['2026-09-07', '2026-12-31']) {
    for (const n of [1, 3, 4]) assert.equal(feLineIndex(iso, n), apiLineIndex(iso, n), `lineIndex(${iso}, ${n})`)
  }
})
