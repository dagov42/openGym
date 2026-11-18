// A rough length for a routine or a combined session: history first, the plan until there is
// enough of it. This is a planning aid, never a promise; the constants are heuristics.
import { isPerSide, modeOf, supersetUnits, workoutDay, workoutDuration } from './history.js'
import { ownExerciseRest, restSecFor, sideRestFor, transitionRestFor } from './supersetFlow.js'

const MINUTE = 60
const HISTORY_N = 5
const HISTORY_MIN = 2
const DURATION_MIN = 5 * MINUTE * 1000
const DURATION_MAX = 4 * 60 * MINUTE * 1000
const REPS_SET_SEC = 40
const WARMUP_SET_SEC = 20
const SETUP_SEC = 30
const DISTANCE_SET_SEC = 60
const DEFAULT_TIME_SEC = 45
const DEFAULT_CARDIO_MIN = 20
const SIDE_SWITCH_SEC = 10

const idsOf = w => [].concat(w?.routineIds ?? (w?.routineId ? [w.routineId] : []))
const keyOf = ids => [...new Set((ids || []).map(String))].sort().join('|')

const isNoProg = w => w?.excludeFromProgression === true ||
  (Array.isArray(w?.entries) && w.entries.length > 0 && w.entries.every(e => e?.noProg === true))

/** The median of the durations (minutes) of the last five exact-set sessions, or null. */
function historyMinutes(S, ids) {
  const key = keyOf(ids)
  const samples = (S.workouts || [])
    .filter(w => !isNoProg(w) && keyOf(idsOf(w)) === key)
    .map(w => ({ day: workoutDay(w) || '', start: Number(w.start) || 0, ms: workoutDuration(w) }))
    .filter(x => x.ms >= DURATION_MIN && x.ms <= DURATION_MAX)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : b.start - a.start))
    .slice(0, HISTORY_N)
  if (samples.length < HISTORY_MIN) return null
  const minutes = samples.map(x => x.ms / MINUTE / 1000).sort((a, b) => a - b)
  const mid = Math.floor(minutes.length / 2)
  const median = minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2
  return { minutes: median, samples: samples.length }
}

const setsOf = cfg => Math.max(0, Math.round(Number(cfg?.sets) || 0))
const workRestOf = (S, cfg) => {
  const own = ownExerciseRest(cfg)
  if (own !== null) return own
  return S?.restSec > 0 ? Number(S.restSec) : 90
}
const warmupRestOf = (S, cfg, workRest) => {
  if (cfg?.warmupRestOff === true) return 0
  const own = Number(cfg?.warmupRestSec)
  if (own > 0) return own
  const profile = Number(S?.warmupRestSec)
  if (S?.warmupRestSec === 0) return 0
  return profile > 0 ? profile : workRest
}
const transitionOf = (S, entries, unit, workRest) => {
  const own = transitionRestFor(entries, unit, S?.nextRestSec)
  return own === null || own === undefined ? workRest : own
}

function workSeconds(cfg) {
  const sets = setsOf(cfg)
  if (!sets) return 0
  const mode = modeOf(cfg)
  const perSide = isPerSide(cfg) ? 2 : 1
  if (mode === 'time') {
    const sec = Number(cfg.sec) > 0 ? Number(cfg.sec) : DEFAULT_TIME_SEC
    return sets * perSide * sec
  }
  if (mode === 'cardio') {
    const min = Number(cfg.min) > 0 ? Number(cfg.min) : DEFAULT_CARDIO_MIN
    return sets * min * MINUTE
  }
  if (mode === 'distance') return sets * DISTANCE_SET_SEC
  return sets * perSide * REPS_SET_SEC
}

function sideRestSeconds(S, cfg) {
  if (modeOf(cfg) !== 'time' || !isPerSide(cfg)) return 0
  const workRest = workRestOf(S, cfg)
  const rest = sideRestFor(cfg, { timed: true, restAfter: workRest, switchSec: SIDE_SWITCH_SEC })
  return Math.max(0, Number(rest) || 0) * setsOf(cfg)
}

/** The plan-only estimate in minutes, or null when the routine has no work to estimate. */
export function routinePlanMinutes(S, routine) {
  const entries = Array.isArray(routine?.ex) ? routine.ex : []
  if (!entries.length) return null
  let sec = 0
  for (const unit of supersetUnits(entries)) {
    const cfgs = unit.map(i => entries[i])
    const rounds = Math.max(...cfgs.map(setsOf))
    if (!rounds) continue
    const roundWork = cfgs.reduce((n, cfg) => n + workSeconds(cfg) / Math.max(1, setsOf(cfg) || 1), 0)
    sec += roundWork * rounds
    for (const cfg of cfgs) {
      const sets = setsOf(cfg)
      const workRest = workRestOf(S, cfg)
      const warmups = Math.max(0, Math.round(Number(cfg.warmupSets) || 0))
      sec += warmups * WARMUP_SET_SEC + Math.max(0, warmups - 1) * warmupRestOf(S, cfg, workRest)
      sec += sideRestSeconds(S, cfg)
      sec += Math.max(0, sets - 1) * workRest
    }
    const defaultRest = S?.restSec > 0 ? Number(S.restSec) : 90
    // A single exercise's work rests are already counted above; only a superset has a round
    // rest of its own, counted once for the whole group.
    if (unit.length > 1) {
      const betweenRounds = restSecFor(entries, unit, defaultRest)
      sec += Math.max(0, rounds - 1) * Math.max(0, Number(betweenRounds) || 0)
    }
    sec += transitionOf(S, entries, unit, workRestOf(S, cfgs[0])) + SETUP_SEC
  }
  return sec > 0 ? sec / MINUTE : null
}

/** Display rounding: to 5 minutes above 20, to 1 minute at or below. */
export const uiMinutes = minutes => {
  const n = Math.max(0, Number(minutes) || 0)
  return n > 20 ? Math.round(n / 5) * 5 : Math.round(n)
}

/**
 * `{ minutes, source: 'history' | 'plan' | 'mixed', samples }` for the exact routine set, or null.
 * A combined set with its own history uses that; otherwise it sums each routine's own estimate.
 */
export function sessionLength(S, ids, { now = Date.now() } = {}) { // eslint-disable-line no-unused-vars
  const list = [...new Set([].concat(ids || []).map(String))]
  if (!list.length) return null
  const direct = historyMinutes(S, list)
  if (direct) return { minutes: direct.minutes, source: 'history', samples: direct.samples }
  if (list.length === 1) {
    const routine = (S?.routines || []).find(r => String(r.id) === list[0])
    const minutes = routinePlanMinutes(S, routine)
    return minutes === null ? null : { minutes, source: 'plan', samples: 0 }
  }
  const children = list.map(id => sessionLength(S, [id], { now })).filter(Boolean)
  if (!children.length) return null
  const minutes = children.reduce((n, x) => n + x.minutes, 0)
  const source = children.every(x => x.source === 'history') ? 'history' : 'mixed'
  return { minutes, source, samples: children.reduce((n, x) => n + x.samples, 0) }
}
