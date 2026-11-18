// Search and filter the History list. Pure: the view builds the index only while a search or a
// filter is active, and then filters it on every keystroke.
import { exOr } from './exercises.js'
import { exerciseNameFor, t } from './i18n.js'
import { workoutGymLabel } from './gym-inventory.js'
import { DAY_NOTE_LABEL } from './day-notes.js'
import { RECOVERY_LABEL } from './recovery-sessions.js'
import { activityName, SPORT_LABEL } from './activities.js'
import { fmtMonth } from './format.js'

/** Case and diacritics ignored, whitespace collapsed. No transliteration. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Everything a History row can be found by, normalized into one haystack. */
export function rowHaystack(S, row) {
  const parts = []
  if (row.w) {
    const w = row.w
    parts.push(w.name, w.note)
    for (const id of (Array.isArray(w.routineIds) ? w.routineIds : (w.routineId ? [w.routineId] : []))) {
      const r = (S.routines || []).find(x => x.id === id)
      if (r?.name) parts.push(r.name)
    }
    parts.push(workoutGymLabel(S, w))
    for (const e of w.entries || []) {
      const ex = (S.customEx || []).find(c => c.id === e.id) || exOr(e.id) || e.ex || null
      parts.push(ex ? exerciseNameFor(ex) : '', ex?.n, e.n, e.note)
      for (const s of e.sets || []) parts.push(s.note)
    }
  }
  if (row.note) {
    parts.push(row.note.text, DAY_NOTE_LABEL[row.note.tag], t(DAY_NOTE_LABEL[row.note.tag]))
  }
  if (row.rec) {
    parts.push(RECOVERY_LABEL[row.rec.kind], t(RECOVERY_LABEL[row.rec.kind]), row.rec.note)
  }
  if (row.act) {
    const a = row.act
    parts.push(activityName(a, t), SPORT_LABEL[a.sport], t(SPORT_LABEL[a.sport] || SPORT_LABEL.other), a.note)
  }
  return normalize(parts.filter(Boolean).join(' '))
}

/** One pass over the rows; only called while a filter is active. */
export function buildHistoryIndex(S, rows) {
  return rows.map(row => ({ row, hay: rowHaystack(S, row) }))
}

/**
 * Every whitespace-separated term must be a substring (AND). Inactive filters return the index
 * unchanged, so the full list keeps its order.
 */
export function filterHistoryIndex(index, { query = '', type = 'all', month = null, pr = false } = {}) {
  const terms = normalize(query).split(' ').filter(Boolean)
  const active = terms.length > 0 || type !== 'all' || !!month || pr
  if (!active) return index
  return index.filter(({ row, hay }) => {
    const kind = row.w ? 'workout' : row.note ? 'note' : row.rec ? 'recovery' : row.act ? 'activity' : null
    if (type !== 'all' && type !== kind) return false
    if (month && (!row.d || row.d.slice(0, 7) !== month)) return false
    if (pr && !row.w?.prs?.length) return false
    return terms.every(term => hay.includes(term))
  })
}

/** Months that actually have rows, newest first, each with its localized label. */
export function monthsOf(index) {
  const rows = index.map(e => e.row || e)
  const months = [...new Set(rows.map(r => r.d?.slice(0, 7)).filter(Boolean))].sort().reverse()
  return months.map(ym => ({ ym, label: fmtMonth(ym) }))
}
