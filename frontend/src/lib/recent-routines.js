// Which routines a profile actually used lately, for the Start picker. Derived from S.workouts.
import { workoutAt, workoutDay } from './history.js'

export const RECENT_DAYS = 90
export const MIN_RECENT = 2
export const RECENT_LIMIT = 5

const idsOf = w => Array.isArray(w?.routineIds) ? w.routineIds : (w?.routineId ? [w.routineId] : [])

/** The newest workout per existing routine: Map<routineId, { at, day }>. */
export function lastUsedByRoutine(S) {
  const known = new Set((S.routines || []).map(r => r.id))
  const out = new Map()
  for (const w of S.workouts || []) {
    const ids = idsOf(w)
    if (!ids.length) continue
    const day = workoutDay(w)
    let at = workoutAt(w)
    if (!Number.isFinite(at) && day) at = new Date(day + 'T12:00:00').getTime()
    if (!Number.isFinite(at)) continue
    for (const id of ids) {
      if (!known.has(id)) continue
      const prev = out.get(id)
      // A later start wins; equal timestamps keep the later stored workout (this loop's order).
      if (!prev || at >= prev.at) out.set(id, { at, day })
    }
  }
  return out
}

/**
 * Up to `limit` routines used in the last `days`, newest first, excluding `exclude` (today's
 * planned ids). Fewer than MIN_RECENT in the window means no section at all.
 */
export function recentRoutines(S, { limit = RECENT_LIMIT, days = RECENT_DAYS, now = Date.now(), exclude = [] } = {}) {
  const routines = Array.isArray(S.routines) ? S.routines : []
  const order = new Map(routines.map((r, i) => [r.id, i]))
  const skip = new Set(exclude || [])
  const cutoff = now - days * 864e5
  const rows = []
  for (const [id, { at }] of lastUsedByRoutine(S)) {
    if (skip.has(id) || !order.has(id) || at < cutoff) continue
    rows.push({ r: routines[order.get(id)], at, i: order.get(id) })
  }
  rows.sort((a, b) => b.at - a.at || a.i - b.i)
  const picked = rows.slice(0, Math.max(0, limit)).map(x => x.r)
  return picked.length >= MIN_RECENT ? picked : []
}
