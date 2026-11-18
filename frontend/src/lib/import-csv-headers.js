// Header dialect of the CSV import: which delimiter a file uses, which column name maps to which
// field, and which app the header looks like. The row parser in import-csv.js owns the values;
// this module owns the vocabulary every exporter writes.

// Strong's current export (and any spreadsheet saved in a comma-decimal locale) separates
// fields with ';'. The header line decides: it holds no numbers, so a ';' there is a separator.
export function delimiterOf(s) {
  const nl = s.search(/[\r\n]/)
  const head = (nl < 0 ? s : s.slice(0, nl)).replace(/"[^"]*"/g, '')
  const count = ch => head.split(ch).length - 1
  return count(';') > count(',') ? ';' : ','
}

// '#' reads as "no": Strong's "Workout #" is the session number, and stripped to "workout" it
// took the place of the workout's name.
const norm = h => h.toLowerCase().replace(/#/g, ' no ').replace(/[^a-z0-9]+/g, ' ').trim()

// header text -> the field we care about. Specific names first; first match wins.
const COLUMNS = [
  ['exercise', ['exercise', 'exercise name', 'exercise title']],
  // Our own export's catalogue id, which makes a re-import lossless (lib/export-csv.js).
  ['exerciseId', ['exercise id']],
  ['date', ['date', 'workout date']],
  ['startTime', ['start time', 'start date']],
  ['endTime', ['end time']],
  ['workoutNo', ['workout no']],
  ['workoutName', ['workout name', 'title', 'workout']],
  ['category', ['category', 'body part', 'muscle group', 'muscle']],
  ['weightKg', ['weight kg']],
  ['weightLb', ['weight lbs', 'weight lb']],
  ['weight', ['weight']],
  ['weightUnit', ['weight unit', 'unit']],
  ['reps', ['reps', 'repetitions']],
  // Hevy and Strong both write an RPE per set. Nothing mainstream exports RIR, but read it
  // when it is there rather than dropping the column on the floor.
  ['rpe', ['rpe', 'rpe rating']],
  ['rir', ['rir', 'reps in reserve']],
  ['distanceKm', ['distance km']],
  ['distanceM', ['distance meters', 'distance m', 'distance metres']],
  ['distance', ['distance']],
  ['distanceUnit', ['distance unit']],
  // gravl writes a treadmill's grade per set; "Incline (%)" normalises to the same name.
  ['incline', ['incline', 'incline percent']],
  // A bike's or rower's resistance knob, 1 to 30 (ours writes resistance_level).
  ['level', ['resistance level']],
  ['seconds', ['seconds', 'duration seconds', 'set duration sec', 'duration s']],
  ['time', ['time', 'duration']],
  // Strong's current export: the whole workout's length, in seconds, on every row.
  ['durationSec', ['duration sec', 'duration secs']],
  ['setType', ['set type']],
  // Anneal's export (anneal.fit/import/anneal-csv/): Warmup is Yes/No, and a timed set keeps its
  // seconds in Reps with Logging_Mode saying so. Its Weight_LBS / Weight_KG land on the lb / kg
  // columns above (kg is the rounded copy, so lb wins when both are read).
  ['warmup', ['warmup', 'is warmup']],
  ['loggingMode', ['logging mode']],
  // The set's number and, for a set logged per side, which side the row is (our own export).
  // Strong's Set Order is a number, or W (warm-up), D (drop), F (failure); "Rest Timer" and "Note" rows are not sets.
  ['setNo', ['set', 'set order', 'set index']],
  ['side', ['side']],
  // Hevy numbers the supersets of a workout; rows sharing a number were done as one.
  ['superset', ['superset id']],
  // The session's note, before the per-set one: Strong writes both, "Notes" first, and a
  // shared alias list handed the session note's column to nobody. Hevy calls it the workout's
  // description.
  ['workoutNote', ['workout notes', 'workout note', 'description']],
  // Strong's measurements export (body weight among other measurements).
  ['measurementType', ['measurement type']],
  ['value', ['value']],
  ['note', ['comment', 'comments', 'notes', 'note', 'exercise notes']],
  // The lifting tempo of a set, "3-1-1-0" (ours writes it, #572).
  ['tempo', ['tempo']],
  // The bands of a set, by name (ours writes it, lib/bands.js).
  ['bands', ['bands']],
  // A set's own note and its colour tag (ours writes them: lib/set-notes.js, lib/set-tags.js).
  ['setNote', ['set note']],
  ['setColor', ['set color', 'set colour']],
]

export function mapHeader(header) {
  const map = {}
  header.forEach((h, i) => {
    const n = norm(h)
    for (const [field, names] of COLUMNS) {
      if (map[field] === undefined && names.includes(n)) { map[field] = i; return }
    }
  })
  return map
}

/** Name of the app a header looks like — shown back to the user so they can sanity-check. */
export function detectSource(header) {
  const h = header.map(norm)
  if (h.includes('exercise id') && h.includes('set type')) return 'openGym'
  if (h.includes('weight lbs') && h.includes('weight kg') && h.includes('unit entered')) return 'Anneal'
  if (h.includes('exercise') && h.includes('est 1rm kg')) return 'GymMane'
  if (h.includes('exercise title') && h.includes('set index')) return 'Hevy'
  if (h.includes('exercise name') && h.includes('set order')) return 'Strong'
  if (h.includes('exercise') && h.includes('kind')) return 'FitNotes (iOS)'
  if (h.includes('exercise') && h.includes('weight unit')) return 'FitNotes'
  if (h.includes('exercise') && h.includes('category')) return 'FitNotes'
  return null
}
