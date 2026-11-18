// Matching a foreign exercise name to the catalogue: curated aliases, a word bag, the Hevy
// title table, and the body part read off a name when the file has no category.
import { EXDB, EXIDX, canonicalExId } from './exercises.js'
import { HEVY_TITLE_MAP } from './hevy-id-map.js'

/* ------------------------------------------------------ exercise matching -- */

// Other apps bolt qualifiers onto names — Hevy writes "Leg Press (Machine)", Strong
// "Snatch (Barbell)", FitNotes "Lat Pulldown (Pulley)" — while the dataset writes
// "barbell snatch". Strip the parentheses, expand the shorthand, then compare as a
// sorted bag of words so word order stops mattering.
const SYN = [
  [/\bbb\b/g, 'barbell'], [/\bdb\b/g, 'dumbbell'], [/\bkb\b/g, 'kettlebell'],
  [/\bohp\b/g, 'overhead press'], [/\bbw\b/g, 'body weight'], [/\bbodyweight\b/g, 'body weight'],
  // 'smith machine' first: the generic machine->lever rule would otherwise eat the word
  // and leave 'smith lever', which matches no entry in the dataset.
  [/\bsmith machine\b/g, 'smith'], [/\bmachine\b/g, 'lever'], [/\bez bar\b/g, 'ez barbell'],
  [/\bpull ups?\b/g, 'pull up'], [/\bchin ups?\b/g, 'chin up'], [/\bpush ups?\b/g, 'push up'],
  [/\bsit ups?\b/g, 'sit up'], [/\bdips?\b/g, 'dip'], [/\braises?\b/g, 'raise'],
  [/\bcurls?\b/g, 'curl'], [/\bpresses\b/g, 'press'], [/\bextensions?\b/g, 'extension'],
  [/\bcables?\b/g, 'cable'], [/\bseated\b/g, 'seated'], [/\bassisted\b/g, 'assisted'],
]
// Words that say nothing about which exercise this is, so they shouldn't stop a match.
const FILLER = new Set(['the', 'a', 'with', 'and', 'v', 'variation', 'version', 'pulley', 'weighted'])

function wordsOf(name) {
  // Parentheses are unwrapped rather than dropped: "Bench Press (Barbell)" carries its
  // equipment in there, and the dataset writes that as "barbell bench press".
  let k = String(name || '').toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  SYN.forEach(([re, to]) => { k = k.replace(re, to) })
  return k.split(' ').filter(w => w && !FILLER.has(w))
}
export const keyOf = name => wordsOf(name).sort().join(' ')

let INDEX = null
function buildIndex() {
  if (INDEX) return INDEX
  INDEX = { exact: new Map(), all: [] }
  EXDB.forEach(e => {
    const w = wordsOf(e.n)
    const k = w.slice().sort().join(' ')
    if (!INDEX.exact.has(k)) INDEX.exact.set(k, e.id)
    INDEX.all.push({ id: e.id, set: new Set(w), n: w.length, k })
  })
  return INDEX
}

// Curated: the names people actually log, mapped by hand to the dataset id they mean.
//
// Other apps let you name a lift "Bench Press"; the dataset only has qualified names
// like "barbell bench press". Word-overlap alone can't resolve that — "bench press" sits
// inside thirty-three entries — and where it *is* unique it tends to be wrong, happily
// resolving "Squat" to "weighted squat" and "Leg Press" to "smith leg press". So the
// common vocabulary is spelled out. The convention is that an unqualified name means the
// canonical barbell version, which is what these apps assume when they show it to you.
// Extending this table is the intended way to improve import accuracy.
const ALIAS_EX = {
  'bench press': '0025', 'barbell bench press': '0025', 'flat bench press': '0025', 'flat barbell bench press': '0025',
  'incline bench press': '0047', 'decline bench press': '0033',
  'close grip bench press': '0030', 'close-grip bench press': '0030',
  squat: '0043', 'back squat': '0043', 'barbell squat': '0043', 'front squat': '0042',
  deadlift: '0032', 'romanian deadlift': '0085', rdl: '0085', 'sumo deadlift': '0117',
  'lat pulldown': '2330', 'lat pull down': '2330', pulldown: '2330',
  // Strong names the equipment in brackets; the bag with "cable" in it missed the alias above and
  // fell to five near ties, so the most common pulldown arrived as a new exercise of your own.
  'lat pulldown (cable)': '2330', 'lat pulldown (machine)': '0579',
  shrug: '0095', shrugs: '0095',
  'overhead press': '0091', 'military press': '0091', 'shoulder press': '0091', ohp: '0091',
  'barbell row': '0027', 'bent over row': '0027', 'bent-over row': '0027',
  'dumbbell row': '0292', 'one arm dumbbell row': '0292',
  'leg curl': '0586', 'lying leg curl': '0586', 'seated leg curl': '0599',
  'leg press': '0739', 'leg extension': '0585',
  'calf raise': '1372', 'standing calf raise': '1372', 'seated calf raise': '0088',
  'lateral raise': '0334', 'side raise': '0334', 'reverse fly': '0348', 'rear delt fly': '0348',
  'bicep curl': '0294', 'biceps curl': '0294', 'dumbbell curl': '0294',
  'preacher curl': '0070', 'barbell curl': '0031',
  'tricep pushdown': '0241', 'triceps pushdown': '0241', pushdown: '0241',
  skullcrusher: '0060', 'skull crusher': '0060', 'lying triceps extension': '0061',
  lunge: '0054', lunges: '0054', 'cable crossover': '1269', 'cable cross over': '1269',
  'goblet squat': '1760', 'dumbbell goblet squat': '1760', 'kettlebell goblet squat': '0534',
  // Reported in issue #74: these come out of Hevy under names no word-overlap can reach, so
  // they landed as custom exercises. The catalogue's cardio vocabulary is thin (29 of 1,324
  // entries), so each of these is the *only* candidate rather than the best of several.
  treadmill: '3666', 'treadmill walk': '3666', 'treadmill run': '3666',
  cycling: '2331', 'cross trainer': '2331', elliptical: '2141',
  'stationary bike': '2138', 'exercise bike': '2138', 'stepmill': '2311',
  // The catalogue has only band Pallof presses, so a cable one resolves to the band entry:
  // same movement, wrong equipment label, which beats leaving it uncategorised.
  'pallof press': '0979', 'cable pallof press': '0979', 'vertical pallof press': '1015',
  'cable core pallof press': '0979', 'core pallof press': '0979',
  // Hevy's own vocabulary, from a real export. Hevy writes the equipment in parentheses
  // and uses "bicep"/"chest fly"/"reverse fly" where the dataset says "biceps"/"fly"/
  // "reverse fly", so these are near-misses the word-bag cannot close on its own.
  'bicep curl (dumbbell)': '0294', 'bicep curl (cable)': '0868', 'bicep curl (barbell)': '0031',
  'chest fly (dumbbell)': '0308', 'chest fly (machine)': '0596', 'butterfly (pec deck)': '0596',
  'incline chest fly (dumbbell)': '0319', 'cable fly crossovers': '1269',
  'rear delt reverse fly (dumbbell)': '0383', 'rear delt reverse fly (machine)': '0602',
  'chest supported reverse fly (dumbbell)': '0383',
  'bench press (smith machine)': '0748', 'overhead press (smith machine)': '0766',
  'hack squat (machine)': '0743', 'iso-lateral row (machine)': '0571',
  'seated cable row - bar grip': '0218', 'reverse grip lat pulldown (cable)': '0673',
  'single arm lateral raise (cable)': '0192', 'plate front raise': '0310',
  'back extension (weighted hyperextension)': '0573',
  'behind the back bicep wrist curl (barbell)': '0104',
  // A face pull is a rope rear-delt row; the dataset has no entry under that name.
  'face pull': '0203',
  // More Hevy titles from a real export (906 workouts). The first group arrived as custom
  // exercises; the second the word-bag did resolve, but to a neighbour: an alternating floor
  // press, a side-plank clamshell, a single-leg deadlift on a bench.
  'lu raises': '10858', 'dumbbell squeeze press': '3681', 'triceps kickback (dumbbell)': '0333',
  'single arm lat pulldown': '1204', 'lateral band walks': '6607', 'frog pumps (dumbbell)': '3182',
  'rear delt reverse fly (cable)': '0225',
  'single arm cross cable extension': '8614', 'bayesian curl': '2656',
  'floor press (dumbbell)': '3668', 'clamshell': '2461',
  'single leg romanian deadlift (dumbbell)': '1757',
  // Cardio again: the only candidates in a 29-entry cardio vocabulary.
  'jumping jack': '3220', 'jumping jacks': '3220', 'battle ropes': '0128',
  'stair machine (steps)': '2311', 'stair machine': '2311',
  // The apps added in 1.4.4 (lib/import-apps.js). Each group was checked name by name against
  // the catalogue: a word-bag miss, or a word-bag hit on a neighbour, put right by hand.
  // Liftosaur (github.com/astashov/liftosaur, src/models/exercise.ts): its built-in names, with
  // the default equipment written in front the way import-apps.js matches them.
  'bench dip': '0129', crunch: '0274', 'cable crunch': '0175', plank: '0463', 'oblique crunch': '0635',
  'lever calf press on leg press': '1391', 'lever calf press on seated leg press': '2335',
  'dumbbell chest press': '0289', 'dumbbell incline chest press': '0314', 'flat knee raise': '8194',
  'lever hip abductor': '0597', 'lever hip adductor': '0598', 'pistol squat': '1759',
  'barbell press under': '4966', 'dumbbell reverse curl': '0429', 'dumbbell reverse grip concentration curl': '0403',
  'single leg hip thrust': '2071', 'barbell snatch pull': '0776', 'barbell stiff leg deadlift': '1543',
  'wide pull up': '1429', 'knee push up': '1182', 'hollow body hold': '1246', 'band shoulder pass through': '8365',
  'barbell power clean': '0648', 'ez barbell skullcrusher': '5873', 'dumbbell shoulder press': '0405',
  'dumbbell triceps extension': '0430', 'dumbbell tricep extension': '0430', 'barbell behind the neck press': '0788',
  'elliptical machine': '2141',
  // Fitbod (its names as the Fitbod-to-Hevy converter github.com/sinan92/fitbod-to-hevy-converter maps them).
  'single arm dumbbell tricep extension': '4343', 'vertical leg raise': '0826', 'air squats': '3948', 'bodyweight squat': '3948',
  'barbell shoulder press': '0091', 'seated barbell shoulder press': '0091', 'smith machine overhead shoulder press': '0766',
  'mid cable crossover fly': '1269', 'cable crossover fly': '1269', 'cable row': '0180', 'machine row': '1350',
  'hammerstrength iso row': '0571', 'machine fly': '0596', 'machine rear delt fly': '0602', 'machine leg press': '0739',
  'machine hip abductor': '0597', 'machine tigh abductor': '0597', 'machine hip adductor': '0598',
  'machine bench press': '0577', 'triceps pressdown': '0241', 'straight-arm pulldown': '0238',
  'dumbbell shoulder raise': '0334', 'side lateral raise': '0334', 'dumbbell bent over reverse fly': '0383',
  'lying hamstrings curl': '0586', dip: '0814', crunches: '0274', 'hammer curl': '0313', 'hammer curls': '0313',
  // JEFIT (its names as the JEFIT-to-Hevy converter github.com/sondrealf/JeFit2Hevy maps them).
  'back hyperextension': '0573', 'hyperextensions - back extensions': '0573',
  'barbell ab rollout on knees': '0857', 'barbell ab rollout (kneeling)': '0857', 'barbell deep squat': '0043',
  'barbell tricep extension (supine)': '0060', 'cable mid chest crossover': '1269', 'cable mid chest crossovers': '1269',
  'cable high cross over': '1269', 'cable rope face pull': '0203',
  'cable rope tricep pushdown': '0200', 'cable rope triceps pushdown': '0200', 'cable tricep pushdown (rope)': '0200',
  'cable triceps pushdown': '0241', 'cable tricep pushdown (v-bar)': '0241', 'triceps pushdown v bar': '0241',
  'cable up right row': '0246', 'calf press on leg press machine': '1391',
  'dumbbell alternating bicep curl': '0294', 'dumbbell one-arm bicep curl': '0294',
  'dumbbell alternating hammer curl': '0313', 'dumbbell alternate hammer curl': '0313', 'dumbbell one-arm hammer curl': '0313',
  'dumbbell alternating incline curl': '0318', 'dumbbell incline bench curl': '0318', 'dumbbell bent-over reverse fly': '0383',
  'dumbbell calf raise': '0417', 'dumbbell decline press': '0301', 'dumbbell incline bench row': '0327',
  'dumbbell palm in bent-over row': '0293', 'dumbbell seated side lateral raise': '0396', 'dumbbell side lateral raise': '0334',
  'dumbbell shoulder shrug': '0406', 'dumbbell step ups': '0431', 'elliptical training': '2141',
  'leverage machine iso row': '0571', 'machine iso lateral high row': '0581',
  'machine assisted pull up': '0017', 'machine assisted pull-up': '0017', 'machine assisted dip': '0009',
  'machine hip abduction': '0597', 'thigh abductor': '0597', 'machine hip adduction': '0598', 'thigh adductor': '0598',
  'machine leg curl': '0586', 'machine leg curl (prone)': '0586', 'prone leg curl': '0586', 'prone leg curls': '0586',
  'leg press machine': '0739', 'machine reverse flye': '0602', 'machine reverse flyes': '0602',
  'machine tricep extension': '0607', 'reverse grip lat pull down': '0673', 'weighted crunches': '0832',
  'cable standing curl': '0868', 'cable straight arm push down': '0238', 'leverage chest press': '0577',
  'machine deltoid raise': '0584', 'machine lat pull down': '0579',
}

// Names that must stay the user's own exercise: the word-bag finds a neighbour for them (a wide
// grip turned into a reverse grip, a plain reverse lunge into one from a deficit), and no
// catalogue entry is the same lift. Checked the same way as the aliases above.
const NO_MATCH = new Set([
  'barbell bench press wide grip', 'barbell incline bench press wide grip', 'dumbbell reverse lunge',
  'assisted squat', 'dumbbell snatch', 'barbell chest supported row', 'barbell deadlift high pull',
  'dumbbell lying bicep curl', 'barbell safety squat bar squat',
].map(n => keyOf(n)))
/** True when a name is one of those: matching it must not fall back to a looser name either. */
export const isNoMatch = name => NO_MATCH.has(keyOf(name))

let ALIAS_IDX = null
const aliasIndex = () => {
  if (!ALIAS_IDX) {
    ALIAS_IDX = new Map()
    for (const k in ALIAS_EX) ALIAS_IDX.set(wordsOf(k).sort().join(' '), ALIAS_EX[k])
  }
  return ALIAS_IDX
}

/**
 * Find the dataset exercise a foreign name refers to, or null.
 *
 * Curated alias first, then an exact word-bag match, then entries that contain every
 * word of the query — but only when exactly one candidate is that close. Guessing
 * between "barbell bench press" and "dumbbell bench press" would file years of training
 * under the wrong lift, which is worse than leaving it as a custom exercise the user can
 * see and fix.
 */
export function matchExercise(name) {
  const idx = buildIndex()
  const w = wordsOf(name)
  if (!w.length) return null
  // Compared as a sorted bag of words, so "Squat (Barbell)" finds the 'barbell squat'
  // alias — the exporters disagree about whether the equipment leads or trails.
  const sorted = w.slice().sort().join(' ')
  const aliased = aliasIndex().get(sorted)
  if (aliased && EXIDX[aliased]) return aliased
  if (NO_MATCH.has(sorted)) return null
  const exact = idx.exact.get(sorted)
  if (exact) return exact
  const q = new Set(w)
  let best = null, bestExtra = Infinity, ties = 0
  for (const c of idx.all) {
    let ok = true
    for (const word of q) if (!c.set.has(word)) { ok = false; break }
    if (!ok) continue
    const extra = c.n - q.size
    if (extra > 2) continue
    if (extra < bestExtra) { best = c.id; bestExtra = extra; ties = 1 }
    else if (extra === bestExtra) ties++
  }
  return ties === 1 ? best : null
}

/**
 * What a name could mean, for a caller that must not guess (the MCP's log_workout): the one
 * catalogue id it names, or every candidate when it names more than one, so the user picks.
 *
 * The same steps as matchExercise, which an import keeps using unchanged: there a near miss is
 * worth a custom exercise the user can fix later, and the first of two same-named entries is as
 * good as the other. Logging one session by name has no such fallback, so here an exact name the
 * catalogue spells twice ("lever chest press" is 0576 and 0577) is a question, not an answer.
 * With nothing close, the entries sharing the most words are offered instead. `kind` says which
 * step answered: 'alias', 'exact', 'near', or 'none' (nothing close; the candidates only share a word).
 */
export function exerciseCandidates(name, limit = 5) {
  const idx = buildIndex()
  const w = wordsOf(name)
  if (!w.length) return { id: null, candidates: [] }
  const sorted = w.slice().sort().join(' ')
  const aliased = aliasIndex().get(sorted)
  if (aliased && EXIDX[aliased]) return { id: canonicalExId(aliased), candidates: [], kind: 'alias' }
  const uniq = ids => [...new Set(ids.map(canonicalExId))]
  const exact = uniq(idx.all.filter(c => c.k === sorted).map(c => c.id))
  if (exact.length === 1) return { id: exact[0], candidates: [], kind: 'exact' }
  if (exact.length > 1) return { id: null, candidates: exact.slice(0, limit), kind: 'exact' }
  const q = new Set(w)
  const near = []
  for (const c of idx.all) {
    let ok = true
    for (const word of q) if (!c.set.has(word)) { ok = false; break }
    if (ok && c.n - q.size <= 2) near.push(c)
  }
  near.sort((a, b) => a.n - b.n)
  const closest = uniq(near.filter(c => c.n === near[0]?.n).map(c => c.id))
  if (closest.length === 1) return { id: closest[0], candidates: [], kind: 'near' }
  if (near.length) return { id: null, candidates: uniq(near.map(c => c.id)).slice(0, limit), kind: 'near' }
  const shared = idx.all
    .map(c => ({ id: c.id, hits: w.filter(word => c.set.has(word)).length, n: c.n }))
    .filter(c => c.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.n - b.n)
  // `kind: 'none'`: these only share a word with the name, and are offered as such.
  return { id: null, candidates: uniq(shared.map(c => c.id)).slice(0, limit), kind: 'none' }
}

/**
 * Exact Hevy English title → catalogue id (from the generated title map).
 * Used when a CSV is detected as Hevy: same deterministic table as the API import,
 * keyed by title because Hevy's CSV has no template id column.
 */
export function matchHevyTitle(name) {
  const id = HEVY_TITLE_MAP[String(name || '').trim().toLowerCase()]
  return id && EXIDX[id] ? id : null
}

// Hevy exports no category column, so every invented exercise fell through to the
// 'upper legs' default and a third of an imported history was attributed to the legs in
// the muscle map. When there is no category, read the body part off the name instead.
// Order is the rule: the first match wins, so the specific word has to come before the broad one.
// A grip is a modifier on a row or a pulldown, never the movement ("Chest Supported T Row Neutral
// Grip" is a back exercise); a wrist or reverse curl is a forearm exercise that happens to say
// "curl"; a leg curl is not an arm curl; and a Romanian or stiff-leg deadlift trains the legs where
// the conventional pull is filed under the back. "grip" alone still reads as forearms — last.
const NAME_BP = [
  [/\b(wrist|forearm|forearms|reverse curl)\b/, 'lower arms'],
  [/\b(leg curl|leg curls|hamstring curl|nordic)\b/, 'upper legs'],
  [/\b(romanian|rdl|stiff leg|stiff legged|straight leg)\b.*\bdeadlifts?\b|\brdl\b/, 'upper legs'],
  [/\b(curl|curls|bicep|biceps|tricep|triceps|skullcrusher|pushdown)\b/, 'upper arms'],
  [/\bchest supported\b/, 'back'],   // where the chest rests, not what it trains
  [/\b(bench|chest|pec|fly|flye|crossover|crossovers|dip)\b/, 'chest'],
  [/\b(row|rows|pulldown|pullup|pull up|chin up|lat|lats|back|deadlift|deadlifts|shrug)\b/, 'back'],
  [/\b(shoulder|delt|delts|overhead|lateral raise|front raise|face pull|press up)\b/, 'shoulders'],
  [/\b(calf|calves)\b/, 'lower legs'],
  [/\b(squat|lunge|leg|glute|hamstring|quad|hip thrust)\b/, 'upper legs'],
  [/\b(ab|abs|core|plank|crunch|sit up|oblique|russian twist)\b/, 'waist'],
  [/\b(run|running|jog|bike|cycling|rope|ropes|jump|jacks|burpee|sprint|treadmill|stair)\b/, 'cardio'],
  [/\bneck\b/, 'neck'],
  [/\bgrip\b/, 'lower arms'],
]
// Hyphens, underscores and slashes read as spaces first: "Stiff-Legged Deadlift" and
// "Chest-Supported Row" are the same names the rules above spell with a space, and the
// matcher (wordsOf) already treats the two spellings as one exercise — the body part has to agree.
export const bpFromName = name => {
  const n = String(name || '').toLowerCase().replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (NAME_BP.find(([re]) => re.test(n)) || [])[1] || null
}

