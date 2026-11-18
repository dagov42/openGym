// The list History shows, kept out of the view so the search module can build on it.
import { dayNoteOf } from './day-notes.js'
import { recoverySessionsOf } from './recovery-sessions.js'
import { activitiesOf } from './activities.js'

// Newest first: every workout, and in between them the days off you left a note on (#261) and the
// recovery sessions (sauna, ice bath, lib/recovery-sessions.js). A note on a day that has a workout
// too stays in the day sheet; the workout speaks for that day. A recovery session is always its own row,
// and so is an activity (a run, a match: lib/activities.js).
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes, ...recoverySessionsOf(S).map(r => ({ d: r.d, rec: r })), ...activitiesOf(S).map(a => ({ d: a.d, act: a }))]
  // Stable, so workouts keep the order they are stored in (by day, then start) within a day.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}
