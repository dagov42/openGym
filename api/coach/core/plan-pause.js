/* Plan pauses (2026-11-25): a civil date range when the plan is deliberately on hold.
 * Shared by the app and the server, like streak.js, so the reminder, the nudge, the streak and
 * the programme all agree. Pure: no node, no DOM, no i18n.
 *
 *   S.planPauses = { '2026-12-20': { to: '2026-12-27'|null, reason: 'holiday'|'sick'|'other',
 *                                    note?: string, holdProgramme?: true, _ts } }
 *
 * A tombstone ({ _ts } only) removes a pause without a key deletion, exactly like dayNotes: a
 * delete would come back from another device's copy. `to` is inclusive; null is open-ended.
 */

export const PAUSE_MAX = 50
export const PAUSE_REASONS = ['holiday', 'sick', 'other']
export const PAUSE_NOTE_MAX = 160
const ISO = /^\d{4}-\d{2}-\d{2}$/
const isISO = v => typeof v === 'string' && ISO.test(v)
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

const cleanDate = v => (isISO(v) ? v : null)
const cleanNote = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, PAUSE_NOTE_MAX) : '')

function cleanEntry(from, value) {
  if (!isMap(value) || !isISO(from)) return null
  // A tombstone carries only the write stamp.
  if (value.to == null && value.reason == null && value.note == null && value.holdProgramme == null) return null
  const to = value.to == null ? null : cleanDate(value.to)
  if (value.to != null && !to) return null
  if (to && to < from) return null
  const reason = PAUSE_REASONS.includes(value.reason) ? value.reason : 'other'
  const note = cleanNote(value.note)
  const ts = Number(value._ts)
  if (!Number.isFinite(ts) || ts <= 0) return null
  return {
    from,
    to,
    reason,
    ...(note ? { note } : {}),
    ...(value.holdProgramme === true ? { holdProgramme: true } : {}),
    _ts: ts,
  }
}

/** The cleaned pauses, oldest start first. Tombstones and invalid entries are dropped. */
export function pausesOf(S) {
  const map = isMap(S?.planPauses) ? S.planPauses : null
  if (!map) return []
  const out = []
  for (const [from, value] of Object.entries(map)) {
    const p = cleanEntry(from, value)
    if (p) out.push(p)
    if (out.length >= PAUSE_MAX) break
  }
  return out.sort((a, b) => a.from.localeCompare(b.from))
}

/** The pause covering `iso`, or null. Overlaps are allowed; the latest start wins for display. */
export function pausedOn(S, iso) {
  if (!isISO(iso)) return null
  let found = null
  for (const p of pausesOf(S)) {
    if (iso < p.from) continue
    if (p.to != null && iso > p.to) continue
    if (!found || p.from > found.from) found = p
  }
  return found
}

/** Whether `iso` is inside any pause. */
export const isPausedOn = (S, iso) => pausedOn(S, iso) != null

const DAY = 86400000
const ms = iso => Date.parse(iso + 'T12:00:00Z')
const isoAt = t => new Date(t).toISOString().slice(0, 10)
export const weekStartOf = S => (S?.weekStart === 0 || S?.weekStart === 6 ? S.weekStart : 1)
/** First day of the week `iso` is in, for a week starting on `ws` (0 Sunday, 1 Monday, 6 Saturday). */
export function weekKeyOf(iso, ws = 1) {
  const t = ms(iso)
  return isoAt(t - ((new Date(t).getUTCDay() - ws + 7) % 7) * DAY)
}
const addDays = (iso, n) => isoAt(ms(iso) + n * DAY)

/**
 * Week keys touched by a pause. Open-ended pauses run through `today` (default: the start day).
 * Bounded so a hostile far-future `to` cannot spin forever.
 */
export function pausedWeekKeys(S, ws = weekStartOf(S), today = null) {
  const set = new Set()
  for (const p of pausesOf(S)) {
    let to = p.to || today || p.from
    if (p.to == null && today && today < p.from) to = p.from
    if (to < p.from) continue
    let d = weekKeyOf(p.from, ws)
    const end = weekKeyOf(to, ws)
    for (let i = 0; i < 1500 && d <= end; i++, d = addDays(d, 7)) set.add(d)
  }
  return set
}

/**
 * Whole calendar weeks held by pause periods with `holdProgramme: true`, between two dates
 * (inclusive), for the programme clock. A week counts when at least four of its days are paused,
 * so a Sunday start does not hold the week that is already over and a short weekend does not
 * hold a full programme week.
 */
export function heldWeeksBetween(S, from, to, ws = weekStartOf(S)) {
  if (!isISO(from) || !isISO(to) || to < from) return 0
  const periods = pausesOf(S).filter(p => p.holdProgramme)
  if (!periods.length) return 0
  const held = new Set()
  let d = weekKeyOf(from, ws)
  const last = weekKeyOf(to, ws)
  for (let i = 0; i < 1500 && d <= last; i++, d = addDays(d, 7)) {
    let days = 0
    for (let n = 0; n < 7; n++) {
      const iso = addDays(d, n)
      if (iso < from || iso > to) continue
      if (periods.some(p => iso >= p.from && (p.to == null || iso <= p.to))) days++
    }
    if (days >= 4) held.add(d)
  }
  return held.size
}

/** The pause summary for a list: { from, to, reason, note?, holdProgramme? } or null. */
export const pauseSummary = p => (p ? { from: p.from, to: p.to, reason: p.reason, ...(p.note ? { note: p.note } : {}), ...(p.holdProgramme ? { holdProgramme: true } : {}) } : null)
