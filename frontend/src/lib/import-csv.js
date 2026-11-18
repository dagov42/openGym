// Import a training history exported from another app.
//
// Every one of these apps exports the same thing in a different dialect: one row per
// *set*, carrying a date, an exercise name and some mix of weight/reps/distance/time.
// So this reads a column MAP built from the header rather than fixed positions, which
// means a new app is usually a few header aliases rather than another importer.
//
// Verified against real exports:
//   FitNotes (Android) Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment
//   FitNotes 2 (iOS)   Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind
//   Strong             Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
//   Hevy               title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
//   openGym            our own CSV export, lib/export-csv.js WORKOUT_COLUMNS (#647)
// Read from the header GymMane documents in its code (not from a real file yet, #647):
//   GymMane            date,exercise,muscle,set,reps,weight_kg,volume_kg,est_1rm_kg,distance_km,duration_s,rpe
// Anything else falls through to loose header matching, which covers Lyfta and the
// spreadsheet round-trips people actually have on disk, as long as the file has a
// date, an exercise name and something measured.
//
// Apple Health is a different animal — an XML dump, often hundreds of MB — and only its
// body-weight records are interesting here. parseBodyweight() scans for those without
// building a DOM.

import { normalizeTempo } from './tempo.js'
import { delimiterOf, mapHeader, detectSource } from './import-csv-headers.js'
export { detectSource }
import { cleanBands, bandsFromCell } from './bands.js'
import { EXIDX, canonicalExId, isCardio as isCardioEx } from './exercises.js'
import { uid } from './format.js'
import { addWeighIn, readingsOf, hashId } from './weigh-ins.js'
import { activitiesFromHealthExport, activitiesFromStravaExport, isStravaExport, splitSportWorkouts, mergeImportedActivities } from './activities.js'
import {
  MEASUREMENT_FIELDS, MEASUREMENT_KEYS, builtinCsvColumn, parseCustomCsvColumn, fromCsvUnit, sameMeasurementKind,
  emptyMeasurement, measurementEntryHasValues, normalizeMeasurementEntry, normalizeMeasurementsState,
} from './measurements.js'
import { isWarmupRow, completedVolumeOf, syncSideAggregate } from './workout-model.js'
import { keyOf, isNoMatch, matchExercise, exerciseCandidates, matchHevyTitle, bpFromName } from './import-csv-match.js'
export { isNoMatch, matchExercise, exerciseCandidates, matchHevyTitle, bpFromName }
import { clampIncline, inclineFrom, clampLevel, levelFrom } from './incline.js'
import { NOTE_MAX } from './history.js'
import { pickFor, inRange } from './import-choices.js'
import { SET_TAGS } from './set-tags.js'
import { SET_NOTE_MAX } from './set-notes.js'
const SET_TAG_IDS = new Set(SET_TAGS.map(x => x.id))

/* ----------------------------------------------------------------- CSV ---- */

/**
 * A real CSV reader: quoted fields, embedded commas and newlines, doubled quotes, BOM
 * and CRLF. Splitting on commas breaks on the first exercise named "Bench Press, Close
 * Grip" — and a whole history would import shifted by one column without ever erroring.
 */
export function parseCSV(text) {
  const rows = []
  let row = [], field = '', quoted = false
  const s = String(text).replace(/^﻿/, '')
  const sep = delimiterOf(s)
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += c
    } else if (c === '"' && field === '') quoted = true // FitNotes writes `Step Ups 16"` unescaped (#1106)
    else if (c === sep) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(x => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some(x => x !== '')) rows.push(row)
  return rows
}

// Categories the exporters use -> the dataset's body parts, for exercises we invent.
// Indexed straight from a cell of the file, so it has no prototype: a plain object answers
// "constructor" and "__proto__" with Object's own machinery, and a function or Object.prototype
// would then ride into the store as an exercise's body part.
const CATEGORY_BP = Object.assign(Object.create(null), {
  chest: 'chest', back: 'back', lats: 'back', shoulders: 'shoulders', delts: 'shoulders',
  legs: 'upper legs', quads: 'upper legs', hamstrings: 'upper legs', glutes: 'upper legs',
  calves: 'lower legs', abs: 'waist', core: 'waist', obliques: 'waist',
  arms: 'upper arms', biceps: 'upper arms', triceps: 'upper arms', forearms: 'lower arms',
  cardio: 'cardio', 'full body': 'upper legs', olympic: 'upper legs', neck: 'neck',
  // The catalogue's own body parts, as our export writes them.
  'upper legs': 'upper legs', 'lower legs': 'lower legs', 'upper arms': 'upper arms',
  'lower arms': 'lower arms', waist: 'waist',
})

/* ----------------------------------------------------------- conversion --- */

const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0 }
// An effort rating out of someone else's export. A blank cell means "not rated" and has to
// stay absent rather than becoming 0 — and 0 itself means opposite things on the two scales:
// RIR 0 is a set taken to failure and worth keeping, while RPE has no 0 (the scale is 1–10),
// so an app writing 0 for "nothing here" must not be read as an effort. Ratings above the
// scale are capped rather than dropped — the set was still rated, just written oddly.
const effortNum = (raw, zeroMeansRated) => {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = parseFloat(s.replace(',', '.'))
  if (!isFinite(n) || n < 0 || (n === 0 && !zeroMeansRated)) return null
  return Math.min(10, Math.round(n * 100) / 100)
}
const LB_TO_KG = 0.45359237
// A converted weight is kept to the hundredth, which Weight decimals can show (#139): 45 lb is
// 20.41 kg, and a tenth would make it 20.4, which reads back as 44.97 lb. A weight typed into the
// app is never rounded at all, so an import shouldn't be the one place that drops precision.
export const roundWeight = w => Math.round(w * 100) / 100
// Hevy's CSV writes a line break inside a note as the two characters `\n`.
const hevyNote = s => s.replace(/\\r\\n|\\n/g, '\n')
// Past these a cell is broken, not a record (the heaviest lifts ever logged stay well under).
const MAX_KG = 2000, MAX_REPS = 1000, MAX_KM = 1000, MAX_BODY_KG = 650
const p2 = n => String(n).padStart(2, '0')
// Month names as the exporting app wrote them. Hevy and Strong localize the date on every
// row to the language the app was set to, so an English-only table silently dropped seven
// months of a French history: `févr.`/`août`/`déc.` never even matched, because the accent
// falls inside the first three letters, and `avr.`/`mai`/`juin`/`juil.` matched the shape
// but stood for nothing. Only janv./mars/sept./oct./nov. came through, by looking exactly
// like their English counterparts. Keys are lower-case and stripped of diacritics.
const MON = {
  // English
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // French — juin/juil. differ only at the fourth letter, which is why the lookup below
  // tries the whole word and a 4-letter prefix before falling back to three.
  janv: 1, fevr: 2, mars: 3, avri: 4, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8,
  sept: 9, octo: 10, nove: 11, dece: 12,
  // Spanish · Portuguese
  ene: 1, fev: 2, abr: 4, ago: 8, set: 9, out: 10, dic: 12,
  // German · Dutch — Dutch spells March "maart" and shortens it "mrt.", neither of which shares
  // a prefix with any other language's March, so both are keys of their own.
  mrz: 3, mei: 5, okt: 10, dez: 12, maart: 3, mrt: 3,
  // Italian
  gen: 1, mag: 5, giu: 6, lug: 7, ott: 10,
}

/** A month word in any of the languages above -> 1-12, or null. */
const monthOf = w => {
  const k = String(w || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return MON[k] || MON[k.slice(0, 4)] || MON[k.slice(0, 3)] || null
}

/** "2020-12-30 18:51:52" · "2024-03-07" · "2024/03/07" · "2024.03.07" · "22 Dec 2025, 08:00" · "21 août 2024, 18:00" · "07/03/2024" -> { d, t } */
export function parseWhen(s) {
  const v = String(s || '').trim()
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/)
  if (m) return calendarDay(m[1], m[2], m[3], m[4], m[5], m[6], m[7])
  // \p{L} rather than [A-Za-z]: the month word carries an accent in most languages.
  m = v.match(/^(\d{1,2})\s+(\p{L}{3,})\.?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/u)
  let mon = m && monthOf(m[2])
  if (mon) return calendarDay(m[3], mon, m[1], m[4], m[5], m[6], m[7])
  m = v.match(/^(\p{L}{3,})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/u)
  mon = m && monthOf(m[1])
  if (mon) return calendarDay(m[3], mon, m[2], m[4], m[5], m[6], m[7])
  // Day-first when ambiguous: FitNotes/Strong/Hevy all write unambiguous dates, so a
  // bare numeric one came through a spreadsheet, and those are usually European.
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?)?/)
  if (m) {
    const [, a, b, y] = m
    const day = +a > 12 ? a : +b > 12 ? b : a
    const mon = day === a ? b : a
    return calendarDay(y, mon, day, m[4], m[5], m[6], m[7])
  }
  return null
}
/** Whole calendar days from one "YYYY-MM-DD" to another (0 when either is unreadable). */
export const daysBetween = (a, b) => {
  const n = (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000
  return isFinite(n) && n > 0 && n < 2 ? n : 0
}
// A date only counts when it is one: a real calendar day (no 31 February, no month 13), not
// before 1900 and not in the future. A day of slack covers a file written in a time zone
// ahead of this one. Anything else is a broken cell, and filed as a workout it would sit
// in the history as "Invalid Date" or a session from the year 9999.
function calendarDay(y, mo, d, h, mi, sec, ampm) {
  y = +y; mo = +mo; d = +d
  const at = new Date(Date.UTC(y, mo - 1, d))
  if (y < 1900 || at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null
  if (h !== undefined && (ampm ? (+h < 1 || +h > 12 || +mi > 59 || +sec > 59) : (+h > 23 || +mi > 59 || +sec > 59))) return null
  const now = new Date()
  if (at.getTime() > Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1)) return null
  return { d: `${y}-${p2(mo)}-${p2(d)}`, t: hm(h, mi, sec, ampm) }
}
const hm = (h, mi, sec, ampm) => {
  if (h === undefined) return null
  let hour = parseInt(h, 10) || 0
  if (ampm) {
    hour %= 12
    if (ampm.toLowerCase() === 'p') hour += 12
  }
  return hour * 3600000 + (parseInt(mi, 10) || 0) * 60000 + (parseInt(sec, 10) || 0) * 1000
}

/** "HH:MM:SS" · "MM:SS" · "90" -> minutes */
// "0:01:30" or "1:30" as seconds; 0 for anything that is not a clock time.
function clockSeconds(v) {
  const s = String(v ?? '').trim()
  if (!/^\d+(:\d{1,2}){1,2}$/.test(s)) return 0
  const p = s.split(':').map(x => parseInt(x, 10) || 0)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
}
function toMinutes(v) {
  const s = String(v ?? '').trim()
  if (!s) return 0
  if (s.includes(':')) {
    const p = s.split(':').map(x => parseInt(x, 10) || 0)
    const sec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
    return Math.round(sec / 60 * 10) / 10
  }
  const m = s.match(/(\d+)\s*h/i), mm = s.match(/(\d+)\s*m/i)      // Strong's "2h 38m"
  if (m || mm) return (m ? +m[1] * 60 : 0) + (mm ? +mm[1] : 0)
  return Math.round(num(s) * 10) / 10
}
// No prototype for the same reason as CATEGORY_BP: the key is a cell from the file.
const KM = Object.assign(Object.create(null), { m: 0.001, km: 1, cm: 0.00001, in: 0.0000254, ft: 0.0003048, yd: 0.0009144, mi: 1.609344 })
const toKm = (v, unit) => num(v) * (KM[String(unit || 'km').toLowerCase().trim()] ?? 1)

/* --------------------------------------------------------------- parse ---- */

/**
 * Read an export into workouts openGym understands, WITHOUT touching state — the caller
 * shows the summary for confirmation first. Nothing here throws on a bad row: a history
 * of several thousand sets will contain oddities, and losing the file over one of them
 * helps nobody. Bad rows are counted and reported instead.
 */
// Ids of what an import makes, from what it is rather than at random: the same file imported on
// two devices before they synced made every session and custom exercise twice (two random ids
// each), and the merge, which unites by id, kept both. The same session from the same app now has
// the same id wherever it is imported, and the merge keeps one. (cyrb53, 53 bits, base 36.)
export function importId(prefix, text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return prefix + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

// The custom exercise the user already has for what an import names: the one an earlier import
// made under the same id, else one with the same name. A name the catalogue did not know when it
// was first imported became a custom exercise, and the catalogue may know it now; matched afresh,
// the next import would put its new days on the catalogue id and split the history in two. So an
// exercise the user already has keeps its id, and only a name that is new is matched.
const nameKey = n => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim()
export function priorCustom(customEx, id, name) {
  const list = Array.isArray(customEx) ? customEx.filter(c => c && c.id) : []
  return list.find(c => c.id === id) || list.find(c => nameKey(c.n) === nameKey(name)) || null
}

// `customEx`: the custom exercises already in state (priorCustom above).
export function parseWorkoutCSV(text, opts = {}) {
  const rows = parseCSV(text)
  if (rows.length < 2) return { error: 'empty' }
  return parseWorkoutRows(rows, mapHeader(rows[0]), detectSource(rows[0]), opts)
}

/**
 * The rows of a table as workouts: `rows[0]` is the header (skipped), `map` says which column
 * holds which field (the names in COLUMNS), `source` is the app the file came from. Shared by
 * the CSV reader above and by lib/import-apps.js, which turns the exports that are not a plain
 * one-row-per-set CSV (Liftosaur, Liftoff, StrongLifts, JEFIT...) into rows like these first.
 * Two fields only those exports fill: `session`, a column naming the workout a row belongs to
 * (so two sessions on one day stay two), and `matchName`, the name to match against the
 * catalogue when the app's own display name leaves out what it means (Liftosaur's "Front Raise"
 * is a dumbbell one). `skipped` counts rows the caller already threw away.
 */
export function parseWorkoutRows(rows, map, source, { unit = 'kg', customEx = [], skipped: preSkipped = 0, matches, skip, from, to, notes: keepNotes = true, effort: keepEffort = true, bands: ownBands = [] } = {}) {
  // Bands by name (lib/bands.js): matched to the profile's, a name it lacks becomes a new band.
  const bandList = cleanBands(ownBands)
  const addedBands = []
  // Our own export (lib/export-csv.js) says more than the others: the catalogue id, which side of
  // a per-side set a row is, a drop-set's drops as rows of their own. Read that way only when the
  // header says it is ours.
  const own = source === 'openGym'
  const dateCol = map.date !== undefined ? 'date' : map.startTime !== undefined ? 'startTime' : null
  if (!dateCol || map.exercise === undefined) return { error: 'unrecognised' }
  // Strong's Duration is how long the whole workout took ("1h 5m", "52m"), written on every
  // row; the set's own time is its Seconds column. Read as a set time it turned every
  // weight-less row into an hour of cardio and left the workout itself at zero minutes.
  if (source === 'Strong' && map.time !== undefined) { map.workoutDuration = map.time; delete map.time }
  // The newer Strong export writes that length in seconds instead. Elsewhere a seconds column
  // under that name is the set's own time.
  if (map.durationSec !== undefined) {
    if (source === 'Strong') map.workoutDurationSec = map.durationSec
    else if (map.seconds === undefined) map.seconds = map.durationSec
    delete map.durationSec
  }

  const resolved = new Map()          // exact title -> dataset id | null, resolved once
  const prior = new Map()             // exercise name -> the user's own custom exercise for it
  const byDate = new Map()           // session key -> the workout being built (see `sessionKey` below)
  const created = new Map()
  const unmatched = new Set()
  const rowNotes = new Map()         // session key -> Strong's Note rows, as [exact title, name key, text]
  let sets = 0, skipped = preSkipped, matched = 0, warmups = 0, rpeSets = 0, rirSets = 0
  let sawLb = false, sawKg = false
  // What the summary lets you choose (lib/import-choices.js): every name the file uses with what it
  // became and what the automatic match would make it, and what was left out on purpose.
  const autoOf = new Map()           // exact title -> the automatic match (null: your own)
  const stats = new Map()            // exact title -> { name, sets, sessions }
  let excluded = 0, notesSeen = 0, effortSeen = 0

  // The export puts an apostrophe in front of a name a spreadsheet would run as a formula.
  const cell = (r, f) => {
    const v = map[f] === undefined ? '' : String(r[map[f]] ?? '').trim()
    return own && /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v
  }
  const sessionKeyOf = (when, r) => map.session !== undefined
    ? when.d + '|' + cell(r, 'session')
    : (source === 'Strong' || source === 'Hevy' || own) && when.t != null
    ? when.d + '|' + when.t + '|' + (cell(r, 'workoutName') || '')
    : when.d

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = cell(r, 'exercise')
    let when = parseWhen(cell(r, dateCol))
    if (!name || !when) { skipped++; continue }
    // Ours writes the day and the start apart, so a session that ran past midnight keeps its day.
    if (own && map.startTime !== undefined) {
      const st = parseWhen(cell(r, 'startTime'))
      if (st && st.t != null) when = { d: when.d, t: st.t }
    }
    const order = cell(r, 'setNo').toLowerCase()
    if (order === 'rest timer') continue
    // Strong's note on an exercise for that workout is a row of its own; it joins the entry once
    // the sets have placed it.
    if (order === 'note') {
      const text = cell(r, 'note')
      if (text) notesSeen++
      if (text && keepNotes && inRange(when.d, from, to)) {
        const sk = sessionKeyOf(when, r)
        if (!rowNotes.has(sk)) rowNotes.set(sk, [])
        rowNotes.get(sk).push([name.trim().toLowerCase(), keyOf(name), text])
      }
      continue
    }

    // explicit kg/lb columns beat a generic column plus a unit column
    let w = 0, rowUnit = ''
    // Anneal writes both; its Weight_LBS is the stored value and Weight_KG a two-decimal copy.
    if (source === 'Anneal' && map.weightLb !== undefined && cell(r, 'weightLb')) { w = num(cell(r, 'weightLb')); rowUnit = 'lb' }
    else if (map.weightKg !== undefined && cell(r, 'weightKg')) { w = num(cell(r, 'weightKg')); rowUnit = 'kg' }
    else if (map.weightLb !== undefined && cell(r, 'weightLb')) { w = num(cell(r, 'weightLb')); rowUnit = 'lb' }
    else {
      w = num(cell(r, 'weight'))
      const u = cell(r, 'weightUnit').toLowerCase()
      rowUnit = u.startsWith('lb') ? 'lb' : u.startsWith('kg') ? 'kg' : ''
    }
    if (rowUnit === 'lb') sawLb = true
    if (rowUnit === 'kg') sawKg = true

    let reps = Math.round(num(cell(r, 'reps')))
    let secs = num(cell(r, 'seconds'))
    // Anneal's Reps column holds seconds when Logging_Mode says the set was timed.
    if (cell(r, 'loggingMode').toLowerCase() === 'time' && !secs) { secs = reps; reps = 0 }
    // FitNotes keeps a hold (a plank, a dead hang) only in its Time column, "0:01:30": the set's
    // own time, as exact seconds. Its treadmill rows have a distance and stay cardio below.
    const fnSecs = /^FitNotes/.test(source) && map.seconds === undefined ? clockSeconds(cell(r, 'time')) : 0
    const setNoteRaw = source === 'Hevy' ? hevyNote(cell(r, 'note')) : cell(r, 'note')
    const setNote = keepNotes ? setNoteRaw : ''
    // Ours keeps cardio minutes to hundredths, the way the app stores them.
    const mins = secs > 0 ? Math.round(secs / 60 * (own ? 100 : 10)) / (own ? 100 : 10) : toMinutes(cell(r, 'time'))
    const km = map.distanceKm !== undefined && cell(r, 'distanceKm')
      ? num(cell(r, 'distanceKm'))
      : map.distanceM !== undefined && cell(r, 'distanceM')
        ? toKm(cell(r, 'distanceM'), 'm')
        : toKm(cell(r, 'distance'), cell(r, 'distanceUnit'))
    if (!w && !reps && !mins && !km) { skipped++; continue }
    // Nobody lifts a negative weight or 2 t, nor does 1,000 reps in a set; a cell like that is
    // broken, and kept it would show as an infinite PR or a NaN chart. Skip the row, say so.
    const maxW = rowUnit === 'lb' || (!rowUnit && unit === 'lb') ? MAX_KG / LB_TO_KG : MAX_KG
    if (w < 0 || reps < 0 || secs < 0 || mins < 0 || km < 0 || w > maxW || reps > MAX_REPS || mins > 24 * 60 || km > MAX_KM) { skipped++; continue }
    // Sessions outside the days you chose stay in the file.
    if (!inRange(when.d, from, to)) { excluded++; continue }
    const warmup = /warm/i.test(cell(r, 'setType')) || order === 'w' || /^(yes|true|1)$/i.test(cell(r, 'warmup'))

    // Our own file names the exercise by id: a catalogue id is taken as it is, and a custom one
    // keeps its id too, so the same exercise on another device is the same exercise. Never a key
    // of Object.prototype ("constructor" would find a function in every index).
    const rawId = own ? cell(r, 'exerciseId') : ''
    const fileId = /^[A-Za-z0-9][\w.-]{0,63}$/.test(rawId) && !(rawId in Object.prototype) ? rawId : ''
    const key = fileId ? 'id:' + fileId : keyOf(name)
    // The match is cached per exact title, not per word bag: the bag drops "weighted", so
    // "Triceps Dip" and "Triceps Dip (Weighted)" would share one match, the first title's.
    const exact = fileId ? key : name.trim().toLowerCase()
    let id = resolved.get(exact)
    if (id === undefined) {
      if (fileId && Object.hasOwn(EXIDX, fileId)) id = canonicalExId(fileId)
      else {
        const mine = priorCustom(customEx, fileId || importId('im', source + '|' + name.toLowerCase()), name)
        if (mine) prior.set(key, mine)
        // Hevy CSV: prefer the generated English-title map (same table as the API import).
        // Localized titles still fall through to the word-bag matcher. A custom exercise of ours
        // stays custom: it was not in the catalogue on purpose.
        const alt = map.matchName !== undefined ? cell(r, 'matchName') : ''
        const byName = () => (alt ? matchExercise(alt) || (isNoMatch(alt) ? null : matchExercise(name)) : matchExercise(name))
        const auto = mine ? mine.id : fileId ? null : canonicalExId((source === 'Hevy' ? matchHevyTitle(name) : null) || byName())
        autoOf.set(exact, auto)
        // Your pick for the name beats every guess; "keep it as your own" still finds the one an
        // earlier import made. Our own file names its exercises by id and has nothing to pick.
        const pick = fileId ? undefined : pickFor(matches, name, customEx)
        id = pick === undefined ? auto : pick === null ? (mine ? mine.id : null) : pick
      }
      resolved.set(exact, id)
    }
    let st = stats.get(exact)
    if (!st) stats.set(exact, st = { name, sets: 0, sessions: new Set() })
    st.sets++
    st.sessions.add(sessionKeyOf(when, r))
    // An exercise you unticked stays out, and so does the exercise of your own it would have made.
    if (skip && skip.has(nameKey(name))) { excluded++; continue }
    if (warmup) warmups++
    if (id) matched++
    else {
      let c = created.get(key)
      if (!c) {
        c = {
          id: fileId || importId('im', source + '|' + name.toLowerCase()), n: own ? name : name.toLowerCase(), custom: true, eq: 'custom', tg: '', desc: '',
          bp: CATEGORY_BP[cell(r, 'category').toLowerCase()] || (km ? 'cardio' : null)
            // Seconds with nothing else is a hold when the name says what it is (a plank is
            // core work); a name that says nothing keeps being read as cardio, as before.
            || (mins && !reps ? (secs > 0 ? bpFromName(name.toLowerCase()) : null) || 'cardio' : null)
            || bpFromName(name.toLowerCase()) || 'upper legs',
        }
        created.set(key, c)
        unmatched.add(name)
      }
      id = c.id
    }

    // A Seconds column with no distance and no reps, on an exercise that is not cardio, is a
    // timed hold (Strong's "Plank, 60 s"): a set of seconds, the way the app logs one — not a
    // minute of cardio at zero speed. Strong's Seconds is always the set's own time, so its
    // catalogue match decides; any other file also needs the name to say what it is, because a
    // loose match ("Walking" → walking lunge) would turn a walk into a hold.
    const nameBp = bpFromName(name.toLowerCase())
    const exCardio = isCardioEx(id) || (created.get(key) || prior.get(key))?.bp === 'cardio' || nameBp === 'cardio'
    // Ours says it outright: a cardio row always has a distance, "0" included, a timed one none.
    // A carry or a sled of ours (Reddit, #1011): a distance with no seconds on an exercise that is
    // not cardio is metres with a load, not a run at zero minutes.
    const ownDistance = own && cell(r, 'distanceKm') !== '' && cell(r, 'seconds') === '' && !reps && !exCardio && km > 0
    const ownCardio = own && cell(r, 'distanceKm') !== '' && !ownDistance
    // Liftosaur's set timer is the set's own time too (lib/import-apps.js).
    const timed = own ? secs > 0 && !reps && !ownCardio
      : (secs > 0 && !km && !reps && !exCardio && (source === 'Strong' || source === 'Liftosaur' || source === 'Anneal' || !!nameBp))
        || (fnSecs > 0 && !km && !reps && !exCardio)
    const isCardio = own ? ownCardio && !timed : !timed && (km > 0 || mins > 0) && !reps
    // `u` carries the row's own unit into the conversion pass below and is dropped there —
    // it never reaches the stored set.
    const set = ownDistance
      ? { m: Math.round(km * 1000), w, done: true, u: rowUnit, ...(warmup ? { phase: 'warmup' } : {}) }
      : timed
      ? { sec: Math.round(secs || fnSecs), w, done: true, u: rowUnit, ...(warmup ? { phase: 'warmup' } : {}) }
      : isCardio
        ? { min: mins || 0, speed: mins > 0 ? Math.round(km / (mins / 60) * (own ? 100 : 10)) / (own ? 100 : 10) : 0, ...inclineFrom({ incline: clampIncline(num(cell(r, 'incline'))) }), ...levelFrom({ level: clampLevel(num(cell(r, 'level'))) }), done: true, ...(warmup ? { phase: 'warmup' } : {}) }
        : { w, r: reps || 0, done: true, u: rowUnit, ...(warmup ? { phase: 'warmup' } : {}) }
    const tempo = !timed && !isCardio ? normalizeTempo(cell(r, 'tempo')) : null
    if (tempo) set.tempo = tempo
    if (own && !timed && !isCardio && map.bands !== undefined && cell(r, 'bands')) {
      const b = bandsFromCell(cell(r, 'bands'), bandList, 1_700_000_000_000 + addedBands.length * 100)
      if (b.ids.length) set.bands = b.ids
      bandList.push(...b.added)
      addedBands.push(...b.added)
    }
    if (own) {
      const tag = cell(r, 'setColor').trim().toLowerCase()
      if (SET_TAG_IDS.has(tag)) set.tag = tag
      const ownNote = keepNotes ? cell(r, 'setNote').trim() : ''
      if (ownNote) set.note = ownNote.slice(0, SET_NOTE_MAX)
    }
    // A "failure" set type (Hevy's CSV writes one) is the app's set taken to failure; not on
    // cardio, which has no effort to read it as.
    if (!warmup && !isCardio && (/^(f|fail|failure)$/i.test(String(cell(r, 'setType') || '').trim()) || order === 'f')) set.failure = true
    // Timed holds have no effort field. Weighted reps can carry RIR or RPE; cardio can carry
    // RPE (not RIR) so the fatigue estimate can use the exported session effort. A set is kept
    // on one scale, so a file carrying both columns is read as RIR for reps work.
    if (!timed) {
      // Cardio has no reps-in-reserve, but an exported RPE is useful to weight its
      // duration-based fatigue estimate. Keep RIR reserved for reps-mode exercises.
      const rir = isCardio ? null : effortNum(cell(r, 'rir'), true)
      const rpe = rir == null ? effortNum(cell(r, 'rpe'), false) : null
      if (rir != null || rpe != null) effortSeen++
      if (!keepEffort) { /* left behind on purpose */ }
      else if (rir != null) { set.rir = rir; rirSets++ }
      else if (rpe != null) { set.rpe = rpe; rpeSets++ }
    }

    // Strong and Hevy write the workout's start on every row, so two sessions on one day are
    // told apart by it (and by the name) and stay two workouts (#505). FitNotes has no times, and
    // a generic file may stamp each set with its own, so everything else stays one per day. Ours
    // writes the start on every row the way those two do.
    const sessionKey = sessionKeyOf(when, r)
    let day = byDate.get(sessionKey)
    if (!day) {
      day = { d: when.d, ex: new Map(), name: cell(r, 'workoutName') || '', start: when.t, end: null, note: '', notes: new Map(), sg: new Map(), groups: new Map() }
      byDate.set(sessionKey, day)
    }
    if (!day.name) day.name = cell(r, 'workoutName') || ''
    const workoutNote = source === 'Hevy' ? hevyNote(cell(r, 'workoutNote')) : cell(r, 'workoutNote')
    if (workoutNote && !day.seenNote) { day.seenNote = true; notesSeen++ }
    if (!day.note && keepNotes) day.note = workoutNote
    // The end is kept as time since the start day's midnight, so a session that runs past
    // midnight ends on the next day's clock plus 24 h rather than before it began.
    if (map.endTime !== undefined) { const e = parseWhen(cell(r, 'endTime')); if (e && e.t != null) day.end = e.t + daysBetween(when.d, e.d) * 86400000 }
    else if ((map.workoutDuration !== undefined || map.workoutDurationSec !== undefined) && day.end == null) {
      const len = map.workoutDurationSec !== undefined
        ? num(cell(r, 'workoutDurationSec')) / 60
        : toMinutes(cell(r, 'workoutDuration'))
      if (len > 0) day.end = (day.start ?? 18 * 3600000) + Math.round(len * 60000)
    }
    if (!day.ex.has(id)) day.ex.set(id, [])
    const list = day.ex.get(id)
    const prev = list[list.length - 1]
    const side = own ? cell(r, 'side').toUpperCase() : ''
    const setNo = cell(r, 'setNo')
    // A drop is a row of its own in our file, under the set it belongs to (and its side).
    if (own && /^drop$/i.test(cell(r, 'setType')) && prev && !isCardio && !timed) {
      const into = (side === 'L' || side === 'R') && prev.sides ? prev.sides[side] : prev
      into.type = 'dropset'
      into.drops = [...(into.drops || []), { w, r: reps || 0 }]
      continue
    }
    if (own && (side === 'L' || side === 'R') && !isCardio && !timed) {
      const half = { w, r: reps || 0, done: true, ...(set.rir != null ? { rir: set.rir } : {}), ...(set.rpe != null ? { rpe: set.rpe } : {}) }
      // The other side of the set the previous row started: same set number, side not yet filled.
      if (prev && prev._sides && prev._no === setNo && !prev._sides.includes(side)) {
        prev.sides[side] = half
        prev._sides.push(side)
        continue
      }
      const row = { done: true, u: rowUnit, sides: { L: { w: 0, r: 0, done: false }, R: { w: 0, r: 0, done: false } }, _no: setNo, _sides: [side] }
      row.sides[side] = half
      if (set.tempo) row.tempo = set.tempo
      if (set.phase) row.phase = set.phase
      if (set.failure) row.failure = true
      if (set.tag) row.tag = set.tag
      if (set.note) row.note = set.note
      list.push(row)
    } else list.push(set)
    // A note written against a set belongs to the exercise that day; the app keeps one per entry.
    if (setNoteRaw) notesSeen++
    if (setNote) {
      const list = day.notes.get(id) || []
      if (!list.includes(setNote)) list.push(setNote)
      day.notes.set(id, list)
    }
    const ss = cell(r, 'superset')
    if (ss && !day.sg.has(id)) {
      if (!day.groups.has(ss)) day.groups.set(ss, importId('is', sessionKey + '|' + ss))
      day.sg.set(id, day.groups.get(ss))
    }
    sets++
  }

  // The exercise's own note goes first, before the notes written against its sets. One for an
  // exercise with no sets in that workout has no entry to go to.
  for (const [sk, list] of rowNotes) {
    const day = byDate.get(sk)
    if (!day) continue
    const exNotes = new Map()
    for (const [exact, key, text] of list) {
      const id = resolved.get(exact) || created.get(key)?.id
      if (!id || !day.ex.has(id)) continue
      if (!exNotes.has(id)) exNotes.set(id, [])
      if (!exNotes.get(id).includes(text)) exNotes.get(id).push(text)
    }
    for (const [id, texts] of exNotes) day.notes.set(id, [...texts, ...(day.notes.get(id) || []).filter(n => !texts.includes(n))])
  }

  // lb -> kg only where a row disagrees with the profile. The app never converts units on
  // its own, so importing unconverted would silently rewrite someone's numbers.
  // Converting PER ROW matters: apps like FitNotes write the unit next to every set, and a
  // history recorded partly in lb and partly in kg used to be taken over as-is, turning
  // "185 lb" into 185 kg.
  const fileUnit = sawLb && !sawKg ? 'lb' : sawKg && !sawLb ? 'kg' : ''
  const mixedUnits = sawLb && sawKg
  const toKg = x => roundWeight(x * LB_TO_KG)
  const toLb = x => roundWeight(x / LB_TO_KG)
  // A row without its own unit follows the file's, and a file that says nothing is taken
  // to already be in the profile's unit.
  const convRow = s => {
    const u = s.u || fileUnit
    if (!u || u === unit) return s.w
    return u === 'lb' ? toKg(s.w) : toLb(s.w)
  }
  const converted = (!!fileUnit && fileUnit !== unit) || mixedUnits

  // By day, and within a day by start, the order the history keeps (sync-merge byDayStart).
  const days = [...byDate.values()].sort((a, b) => (a.d === b.d ? (a.start ?? 0) - (b.start ?? 0) : a.d < b.d ? -1 : 1))
  const dates = days.map(day => day.d)
  const workouts = days.map(day => {
    const d = day.d
    const entries = [...day.ex.entries()].map(([id, ss]) => {
      // Drops and sides are in the row's unit too. Per-side rows get their summary from the sides.
      const conv2 = ss.map(({ u, _no, _sides, ...s }) => {
        if (s.w === undefined && !s.sides) return s
        const c = x => convRow({ w: x, u })
        const drops = d => (Array.isArray(d) ? { drops: d.map(x => ({ ...x, w: c(x.w) })) } : {})
        if (s.sides) {
          const side = x => ({ ...x, w: c(x.w), ...drops(x.drops) })
          return syncSideAggregate({ ...s, sides: { L: side(s.sides.L), R: side(s.sides.R) } })
        }
        return { ...s, w: c(s.w), ...drops(s.drops) }
      })
      const mx = Math.max(0, ...conv2.filter(s => !isWarmupRow(s)).map(s => s.w || 0))
      const note = (day.notes.get(id) || []).join(' · ').slice(0, NOTE_MAX)
      return { id, sets: conv2, topW: mx || null, ...(day.sg.has(id) ? { sg: day.sg.get(id) } : {}), ...(note ? { note } : {}) }
    })
    // A superset is exercises next to each other; one left without a neighbour sharing its
    // tag is not a superset (the same rule history.js's cleanupSg applies).
    entries.forEach((e, i) => { if (e.sg && entries[i - 1]?.sg !== e.sg && entries[i + 1]?.sg !== e.sg) delete e.sg })
    const base = new Date(d + 'T00:00:00').getTime()
    const start = base + (day.start ?? 18 * 3600000)
    const end = day.end != null ? base + day.end : start
    const w = {
      id: importId('iw', JSON.stringify([source, d, start, day.name || '', entries.map(e => [e.id, e.sets])])), d, start, end: end > start ? end : start,
      routineId: null, name: day.name || 'Imported', entries, prs: [],
      ...(day.note ? { note: day.note } : {}),
    }
    // Work sets only, like `workoutVolume` for a workout finished in the app: warm-ups are
    // promised to stay out of the volume, and this number is stored with the workout for good.
    // completedVolumeOf counts a drop-set's drops and each side of a per-side set at its own load.
    w.vol = entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + (isWarmupRow(s) ? 0 : completedVolumeOf(s)), 0), 0)
    return w
  })

  // Only what lands in the history counts: an exercise you unticked was resolved, but brings nothing.
  const used = new Set(workouts.flatMap(w => w.entries.map(e => e.id)))
  const matchedIds = [...new Set([...resolved.values()].filter(id => id && used.has(id)))]
  const names = [...stats.entries()].map(([exact, st]) => {
    const id = resolved.get(exact) || created.get(keyOf(st.name))?.id || null
    return { key: nameKey(st.name), name: st.name, id: id || null, auto: autoOf.has(exact) ? autoOf.get(exact) || null : id || null, sets: st.sets, workouts: st.sessions.size }
  })
  return {
    kind: 'workouts', source, workouts, customEx: [...created.values()],
    ...(addedBands.length ? { bands: addedBands } : {}),
    // distinct library exercises behind the matched rows — the summary calls this
    // "exercises matched", and counting rows there made three exercises read as five
    matched: matchedIds.length,
    matchedIds,
    matchedSets: matched,
    created: created.size, unmatchedNames: [...unmatched].sort(),
    sets, skipped, warmups, fileUnit, mixedUnits, converted, rpeSets, rirSets,
    from: dates[0] || null, to: dates[dates.length - 1] || null,
    // For the summary's choices: every name with its match, what was left out, what could be.
    names: own ? [] : names, excluded, notesSeen, effortSeen,
  }
}

/* ------------------------------------------------------- body weight ------ */

/**
 * Body-weight history from Apple Health, or any CSV with a date and a weight.
 *
 * Health's own export is one big `export.xml` — often several hundred MB, nearly all of
 * it step counts and heart rate. Building a DOM would blow up the tab, so the body-mass
 * records are pulled out with a scan instead. Health writes weights in the unit the
 * phone is set to and labels each record, so the unit is read per record.
 */
export function parseBodyweight(text, { unit = 'kg' } = {}) {
  const s = String(text)
  // iso date -> [{ w, unit, t, at }]: every weigh-in with a time of day (#859); of the ones
  // without a time, the day's last, as before.
  const out = new Map()
  const put = (d, b, hm) => {
    const at = hm != null ? `${p2(Math.floor(hm / 3600000))}:${p2(Math.floor(hm % 3600000 / 60000))}` : null
    const day = (out.get(d) || []).filter(x => (at ? x.at !== at : x.at))
    day.push({ ...b, at })
    out.set(d, day)
  }
  let fileUnit = '', source = 'Apple Health', measurements = []
  // The export's runs, rides and matches come along as activities (lib/activities.js, gm-hooks):
  // they used to be dropped on the floor, every one of them.
  const activities = activitiesFromHealthExport(s)

  if (s.includes('HKQuantityTypeIdentifierBodyMass')) {
    const re = /<Record[^>]*type="HKQuantityTypeIdentifierBodyMass"[^>]*>/g
    let m
    while ((m = re.exec(s))) {
      const tag = m[0]
      const val = /value="([\d.]+)"/.exec(tag)
      const dt = /startDate="([^"]+)"/.exec(tag) || /creationDate="([^"]+)"/.exec(tag)
      const u = /unit="([^"]+)"/.exec(tag)
      if (!val || !dt) continue
      const when = parseWhen(dt[1])
      if (!when) continue
      // Each record keeps its own unit: Health labels every one, and a file can mix kg and lb (#432).
      const recUnit = u ? (/lb/i.test(u[1]) ? 'lb' : 'kg') : ''
      // `[\d.]+` lets a bare "." through, which parseFloat reads as NaN, and a zeroed record is
      // no weigh-in either — the same gate the CSV branch below applies with `!w`.
      const w = parseFloat(val[1])
      if (!isFinite(w) || !w || !bodyOk(w, recUnit || unit)) continue
      put(when.d, { w, unit: recUnit, t: new Date(dt[1]).getTime() || null }, when.t)
    }
  } else if (activities.length) {
    // An export with workouts and no weigh-in at all: the activities alone.
  } else {
    const rows = parseCSV(s)
    if (rows.length < 2) return { error: 'empty' }
    const map = mapHeader(rows[0])
    // Strong's measurements export: one row per measurement, "Measurement Type" saying which
    // ("Weight", "Body Fat Percentage", a waist…), the number in "Value" and its own "Unit".
    if (map.measurementType !== undefined && map.value !== undefined && map.date !== undefined) {
      source = 'Strong'
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        if (String(r[map.measurementType] ?? '').trim().toLowerCase() !== 'weight') continue
        const when = parseWhen(String(r[map.date] ?? ''))
        const w = num(r[map.value])
        const u = String(r[map.weightUnit] ?? '').trim().toLowerCase()
        const recUnit = u.startsWith('lb') ? 'lb' : u.startsWith('kg') ? 'kg' : ''
        if (!when || !w || !bodyOk(w, recUnit || unit)) continue
        put(when.d, { w, unit: recUnit, t: new Date(when.d).getTime() + (when.t ?? 0) }, when.t)
      }
      return finishBodyweight(out, unit, source)
    }
    // a weight-only CSV: whichever weight column it has
    const wCol = map.weightKg ?? map.weightLb ?? map.weight
    const dCol = map.date ?? map.startTime
    if (wCol === undefined || dCol === undefined) return { error: 'unrecognised' }
    measurements = bodyCsvMeasurements(rows)
    if (map.weightKg !== undefined) fileUnit = 'kg'
    else if (map.weightLb !== undefined) fileUnit = 'lb'
    for (let i = 1; i < rows.length; i++) {
      const when = parseWhen(String(rows[i][dCol] ?? ''))
      const w = num(rows[i][wCol])
      if (!when || !w || !bodyOk(w, fileUnit || unit)) continue
      put(when.d, { w, t: new Date(when.d).getTime() + (when.t ?? 0) }, when.t)
    }
  }

  return finishBodyweight(out, unit, source, fileUnit, measurements, activities)
}

// Our own body CSV (lib/export-csv.js bodyCSV) carries the measurements too (#718): a column per
// built-in field (`waist_cm`) and per custom field ("Muscle ratio (%)", lib/measurements.js). Only
// a file with our header is read this way, so another app's Notes column never turns into a
// measurement. Values stay in their column's unit here; mergeImport files them.
function bodyCsvMeasurements(rows) {
  const head = rows[0].map(h => String(h ?? '').trim())
  if (head[0]?.toLowerCase() !== 'date' || !/^weight_(kg|lb)$/.test(head[1] || '')) return []
  const builtin = new Map(MEASUREMENT_FIELDS.map(f => [builtinCsvColumn(f), f.key]))
  const cols = head.slice(2).map((h, i) => builtin.has(h) ? { i: i + 2, key: builtin.get(h) } : { i: i + 2, ...parseCustomCsvColumn(h) })
    .filter(c => c.key || c.name)
  const days = []
  for (const r of rows.slice(1)) {
    const when = parseWhen(String(r[0] ?? ''))
    if (!when) continue
    const values = {}, other = []
    for (const c of cols) {
      const raw = String(r[c.i] ?? '').trim()
      const v = parseFloat(raw.replace(',', '.'))
      if (raw === '' || !Number.isFinite(v)) continue
      if (c.key) values[c.key] = v; else other.push({ name: c.name, unit: c.unit, value: v })
    }
    if (Object.keys(values).length || other.length) days.push({ d: when.d, values, other })
  }
  return days
}

/** The weigh-ins collected per day, converted to `unit` — each in its own record's unit if it
 *  had one, else the file's. Measurements from our own body CSV ride along as they are. */
function finishBodyweight(out, unit, source, fileUnit = '', measurements = [], activities = []) {
  if (!out.size && !measurements.length && !activities.length) return { error: 'unrecognised' }
  const units = new Set([...out.values()].flat().map(b => b.unit || fileUnit).filter(Boolean))
  fileUnit = [...units].sort().join(' / ')
  const converted = [...units].some(sourceUnit => sourceUnit !== unit)
  const conv = b => {
    const sourceUnit = b.unit || fileUnit
    const w = sourceUnit && sourceUnit !== unit
      ? (sourceUnit === 'lb' ? b.w * LB_TO_KG : b.w / LB_TO_KG)
      : b.w
    return roundWeight(w)
  }
  const dates = [...out.keys()].sort()
  const all = [...new Set([...dates, ...measurements.map(m => m.d), ...activities.map(a => a.d)])].sort()
  return {
    kind: 'bodyweight', source,
    // One entry per weigh-in, several on a day that has them, each with its time (`at`) when the
    // file gave one; mergeImport files them by day.
    bodyweight: dates.flatMap(d => out.get(d).slice().sort((x, y) => (x.at || '') < (y.at || '') ? -1 : 1)
      .map(b => ({ d, w: conv(b), t: b.t || new Date(d).getTime(), ...(b.at ? { at: b.at } : {}) }))),
    ...(measurements.length ? { measurements } : {}),
    ...(activities.length ? { activities } : {}),
    fileUnit, converted, from: all[0], to: all[all.length - 1],
  }
}

/** A weigh-in a person could have: above zero and below MAX_BODY_KG in the given unit. */
const bodyOk = (w, u) => w > 0 && w <= (u === 'lb' ? MAX_BODY_KG / LB_TO_KG : MAX_BODY_KG)

// The custom fields the imported days need, by lower-cased name: the profile's own first, then
// one made for each column that has none yet (with the column's unit).
function measurementFieldsFor(S, days) {
  const byName = new Map((S.customMeasurements || []).map(c => [String(c.name).toLowerCase(), c]))
  const made = []
  for (const m of days) for (const o of m.other) {
    if (byName.has(o.name.toLowerCase())) continue
    const field = { id: uid(), name: o.name.slice(0, 60), enabled: true, unit: o.unit }
    byName.set(o.name.toLowerCase(), field)
    made.push(field)
  }
  return { byName, made }
}

// One record per date: rows that share one are halves of the same check-in, and the first
// non-empty value of a field wins (the way measurements.js mergeMeasurementEntries folds them).
function groupMeasurementDays(days) {
  const byDay = new Map()
  for (const m of days) {
    const cur = byDay.get(m.d)
    if (!cur) { byDay.set(m.d, { d: m.d, values: { ...m.values }, other: [...m.other] }); continue }
    for (const [key, v] of Object.entries(m.values)) if (cur.values[key] == null) cur.values[key] = v
    const seen = new Set(cur.other.map(o => o.name.toLowerCase()))
    for (const o of m.other) if (!seen.has(o.name.toLowerCase())) { seen.add(o.name.toLowerCase()); cur.other.push(o) }
  }
  return [...byDay.values()]
}

// What the file's rows for one date amount to as a check-in against the given custom fields.
// Normalizing drops what no field could hold (a 140 % or a negative).
function measurementEntryFrom(m, custom, byName) {
  const entry = emptyMeasurement(m.d, custom)
  for (const [key, v] of Object.entries(m.values)) entry[key] = v
  for (const o of m.other) {
    const field = byName.get(o.name.toLowerCase())
    if (!sameMeasurementKind(field.unit, o.unit)) continue
    const item = entry.other.find(x => x.id === field.id)
    if (item) item.value = fromCsvUnit(o.value, o.unit)
  }
  return normalizeMeasurementEntry(entry, custom)
}

// A check-in that is already here keeps every value it has; the file's go only where it has
// none (#1206). The entries are normalized against the same custom fields, so `other` ids line up.
function fillCheckIn(have, entry) {
  const out = { ...have, other: have.other.map(o => ({ ...o })) }
  for (const key of MEASUREMENT_KEYS) if (out[key] == null && entry[key] != null) out[key] = entry[key]
  for (const o of entry.other) {
    if (o.value == null) continue
    const item = out.other.find(x => x.id === o.id)
    if (!item) { out.other.push({ ...o }); continue }
    if (item.value == null) { item.value = o.value; if (o.unit) item.unit = o.unit }
  }
  if (!out.note && entry.note) out.note = entry.note
  return out
}

// Whether filling brought the day anything at all: same values, field by field.
function sameCheckIn(a, b) {
  for (const key of MEASUREMENT_KEYS) if ((a[key] ?? null) !== (b[key] ?? null)) return false
  if ((a.note || '') !== (b.note || '')) return false
  const vals = x => new Map((x.other || []).map(o => [o.id, o.value ?? null]))
  const A = vals(a), B = vals(b)
  for (const [id, v] of A) if ((B.has(id) ? B.get(id) : null) !== v) return false
  for (const [id, v] of B) if ((A.has(id) ? A.get(id) : null) !== v) return false
  return true
}

/**
 * Measurements read from our own body CSV (bodyCsvMeasurements), into state the way weigh-ins
 * go: a check-in keeps the values it has, and the file fills the ones it has not (#1206) — a day
 * with some measurements no longer swallows the rest of its row. A custom column goes to the
 * field of the same name, made with the column's unit if there is none; one whose unit is
 * another kind than that field's (kg into a % field) is left out rather than relabelled.
 * Returns how many days came in or gained a value.
 */
function mergeMeasurements(S, days) {
  normalizeMeasurementsState(S)
  const { byName, made } = measurementFieldsFor(S, days)
  if (made.length) { S.customMeasurements.push(...made); normalizeMeasurementsState(S) }
  let n = 0
  for (const m of groupMeasurementDays(days)) {
    const entry = measurementEntryFrom(m, S.customMeasurements, byName)
    const i = S.measurements.findIndex(e => e.d === m.d)
    if (i < 0) {
      if (!measurementEntryHasValues(entry)) continue
      S.measurements.push(entry)
      n++
      continue
    }
    const filled = normalizeMeasurementEntry(fillCheckIn(S.measurements[i], entry), S.customMeasurements)
    if (sameCheckIn(filled, S.measurements[i])) continue
    filled.t = Date.now() // an edit of the day, stamped so the sync carries it (lib/sync-merge.js)
    S.measurements[i] = filled
    n++
  }
  normalizeMeasurementsState(S)
  return n
}

/**
 * What importing the measurement `days` would do to each of their dates, without touching the
 * state: 'add' a check-in where the day has none, 'fill' one where the day's check-in is empty,
 * or 'keep' the day as it is (the file brings it nothing). The import summary counts the days
 * that are kept as already here (#1206).
 */
export function measurementImportPlan(S, days) {
  const st = normalizeMeasurementsState({ measurements: S?.measurements || [], customMeasurements: S?.customMeasurements || [] })
  const { byName, made } = measurementFieldsFor(st, days)
  const custom = [...st.customMeasurements, ...made]
  const plan = new Map()
  for (const m of groupMeasurementDays(days)) {
    const entry = measurementEntryFrom(m, custom, byName)
    const have = st.measurements.find(e => e.d === m.d)
    if (!have) { plan.set(m.d, measurementEntryHasValues(entry) ? 'add' : 'keep'); continue }
    const filled = normalizeMeasurementEntry(fillCheckIn(have, entry), custom)
    plan.set(m.d, sameCheckIn(filled, have) ? 'keep' : 'fill')
  }
  return plan
}

/**
 * Whether the profile already has an imported weigh-in: the same import again (its id), one at
 * the same time on its day, or — for one without a time — one of the same weight on its day.
 * A different weight that day is another weigh-in, not a duplicate (#1206).
 */
export function importHasWeighIn(S, b) {
  const day = (S?.bodyweight || []).find(x => x && x.d === b?.d)
  if (!day) return false
  return readingsOf(day).some(r =>
    r.id === importReadingId(b) || (b.at ? r.at === b.at : Number(r.w) === Number(b.w)))
}
// The same imported weigh-in gets the same id on every device that imports the file.
const importReadingId = b => 'i' + hashId(`${b.d}|${b.at || ''}|${b.w}`)

/** Sniff the file and parse it as whatever it is. */
export function parseImport(text, opts) {
  const s = String(text)
  if (s.includes('HKQuantityTypeIdentifier') || /^\s*</.test(s)) return parseBodyweight(s, opts)
  // Strava's activities.csv: its runs, rides and matches as activities (lib/activities.js). Sniffed
  // on the first line before anything parses the file, which can hold years of rows.
  if (isStravaExport(parseCSV(s.slice(0, s.search(/[\r\n]/) + 1 || s.length))[0])) {
    return finishBodyweight(new Map(), opts?.unit || 'kg', 'Strava', '', [], activitiesFromStravaExport(parseCSV(s)))
  }
  const asWorkouts = parseWorkoutCSV(s, opts)
  if (!asWorkouts.error) return asWorkouts
  const asWeights = parseBodyweight(s, opts)
  return asWeights.error ? asWorkouts : asWeights
}

/* --------------------------------------------------------------- merge ---- */

/**
 * Merge into state. Existing days win — importing twice never duplicates a workout. A day the
 * file has two sessions on brings both (they are checked against the state before the merge,
 * not against each other); a day already in the history brings neither.
 */
export function mergeImport(S, parsed) {
  if (parsed.kind === 'bodyweight') {
    // Marked as imported (`src`, as lib/health-read.js marks what it reads): mostly another app's
    // or the health hub's own export, so it is never written back to Apple Health or Health
    // Connect (lib/health-connect.js healthRecords), where it would land a second time.
    // Each weigh-in joins its day (#859); one the day already has (importHasWeighIn) is skipped,
    // so importing the same file twice adds nothing.
    let added = 0
    for (const b of parsed.bodyweight) {
      if (importHasWeighIn(S, b)) continue
      if (addWeighIn(S, { d: b.d, at: b.at || null, w: b.w, t: b.t, src: b.src || 'import', id: importReadingId(b) })) added++
    }
    const res = { added, skipped: parsed.bodyweight.length - added }
    if (parsed.measurements?.length) res.measurements = mergeMeasurements(S, parsed.measurements)
    if (parsed.activities?.length) res.activities = mergeImportedActivities(S, parsed.activities)
    return res
  }
  // A session that was only sport (Hevy's "Padel", Strong's "Football", minutes and nothing else)
  // comes in as an activity, not as a workout with no sets worth the name (lib/activities.js).
  const named = e => parsed.customEx?.find(c => c.id === e.id)?.n || EXIDX[e.id]?.n || e.ex?.n || ''
  const split = splitSportWorkouts(parsed.workouts, named)
  const sportIn = split.activities.length ? mergeImportedActivities(S, split.activities) : 0
  parsed = { ...parsed, workouts: split.workouts }
  const have = new Set(S.workouts.map(w => w.d))
  // Every parse invents fresh ids for the names it cannot match, and a later export of the same
  // account names those exercises again. So a custom exercise is looked up by name among the ones
  // already here — from an earlier import or made by hand — and the new days are pointed at it,
  // the way mergeHevyRoutines and mergePlan do; otherwise the Library lists "Grip Trainer" twice,
  // each with half the history. Only a name with no match becomes a new exercise.
  S.customEx = S.customEx || []
  const exIdMap = {}
  parsed.customEx.forEach(c => {
    const same = S.customEx.find(x => x.id !== c.id && nameKey(x.n) === nameKey(c.n))
    if (same) exIdMap[c.id] = same.id
  })
  const fresh = parsed.workouts.filter(w => !have.has(w.d))
    .map(w => ({ ...w, entries: w.entries.map(e => (exIdMap[e.id] ? { ...e, id: exIdMap[e.id] } : e)) }))
  const used = new Set(fresh.flatMap(w => w.entries.map(e => e.id)))
  // (one an earlier import of the same name already made has the same id now: kept once)
  const known = new Set(S.customEx.map(c => c?.id))
  const customs = parsed.customEx.filter(c => used.has(c.id) && !EXIDX[c.id] && !known.has(c.id))
  S.customEx = [...S.customEx, ...customs]
  // Bands the file named that this profile did not have yet (lib/bands.js bandsFromCell).
  if (parsed.bands?.length) S.bands = cleanBands([...(Array.isArray(S.bands) ? S.bands : []), ...parsed.bands])
  S.workouts = [...S.workouts, ...fresh].sort((a, b) => (a.d === b.d ? (a.start || 0) - (b.start || 0) : a.d < b.d ? -1 : 1))
  // seed the weight suggestions from the newest imported set of each lift
  fresh.forEach(w => w.entries.forEach(e => {
    const mx = Math.max(0, ...e.sets.map(s => s.w || 0), e.topW || 0)
    if (mx > 0) { const cur = S.exWeights[e.id]; if (!cur || w.d >= cur.d) S.exWeights[e.id] = { w: mx, d: w.d } }
  }))
  return { added: fresh.length, skipped: parsed.workouts.length - fresh.length, ...(split.activities.length ? { activities: sportIn } : {}) }
}
