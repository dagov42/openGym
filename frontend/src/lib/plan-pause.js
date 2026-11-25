// Plan pauses on the app side. The date rules live in the shared core
// (api/coach/core/plan-pause.js), the same file the server reads.
import {
  PAUSE_MAX, PAUSE_REASONS, PAUSE_NOTE_MAX, pausesOf, pausedOn, isPausedOn,
  pausedWeekKeys, heldWeeksBetween, pauseSummary,
} from '../../../api/coach/core/plan-pause.js'

export { PAUSE_MAX, PAUSE_REASONS, PAUSE_NOTE_MAX, pausesOf, pausedOn, isPausedOn, pausedWeekKeys, heldWeeksBetween, pauseSummary }

export const PLAN_PAUSE_REASON_LABEL = {
  holiday: 'Holiday',
  sick: 'Sick',
  other: 'Other',
}
export const PLAN_PAUSE_REASON_ICON = {
  holiday: 'globe',
  sick: 'cloud',
  other: 'note',
}

/** The pause visible on `iso`, if any. */
export const pauseOn = (S, iso) => pausedOn(S, iso)

/**
 * Write a pause starting at `from`. An empty/cleared patch writes the stamped tombstone, so the
 * removal syncs. `to` null means open-ended. Keeps at most PAUSE_MAX entries (the oldest start is
 * dropped when a hostile map is already full).
 */
export function withPlanPause(map, from, patch = {}, now = Date.now()) {
  const base = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  const hasContent = patch && (patch.to === null || patch.to != null || patch.reason != null || patch.note != null || patch.holdProgramme != null)
  if (!hasContent) {
    const next = { ...base, [from]: { _ts: now } }
    return trimPauses(next)
  }
  const to = patch.to === null ? null : typeof patch.to === 'string' ? patch.to : null
  const reason = PAUSE_REASONS.includes(patch.reason) ? patch.reason : 'other'
  const note = typeof patch.note === 'string' ? patch.note.replace(/\s+/g, ' ').trim().slice(0, PAUSE_NOTE_MAX) : ''
  const entry = { to, reason, ...(note ? { note } : {}), ...(patch.holdProgramme === true ? { holdProgramme: true } : {}), _ts: now }
  return trimPauses({ ...base, [from]: entry })
}

/** End the pause at `from` now: yesterday for a past start, a tombstone for a start today. */
export function resumePlanPause(map, from, today, now = Date.now()) {
  const base = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  if (from >= today) return withPlanPause(base, from, {}, now)
  const d = new Date(today + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return withPlanPause(base, from, { to: `${y}-${m}-${day}`, reason: base[from]?.reason || 'other', note: base[from]?.note, holdProgramme: base[from]?.holdProgramme === true }, now)
}

function trimPauses(map) {
  const keys = Object.keys(map).sort()
  if (keys.length <= PAUSE_MAX) return map
  const keep = keys.slice(keys.length - PAUSE_MAX)
  return Object.fromEntries(keep.map(k => [k, map[k]]))
}

/** A short label for a pause: "Holiday until 27 Dec", "Paused from 20 Dec", "Paused". */
export function pauseLabel(p, fmt = iso => iso) {
  if (!p) return ''
  const reason = PLAN_PAUSE_REASON_LABEL[p.reason] || 'Paused'
  if (p.to) return `${reason} · ${fmt(p.from, true)} – ${fmt(p.to, true)}`
  return `${reason} · ${fmt(p.from, true)}`
}
