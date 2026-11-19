# Map an unknown CSV once

Status: candidate, designed 2026-11-16. Decisions at the end; the sync/tokens/merge behaviour is settled.
Nothing implemented.

## Why

Imports already cover Strong, Hevy (CSV and API), FitNotes, Anneal, GymMane, Liftosaur, LiftLog, JEFIT,
Fitbod-to-Hevy and openGym's own export (`import-csv.js`, `import-apps.js`). Each new app in the long tail is
another hard-coded reader and another set of hostile-input tests. The parser itself already works from a
header-driven column map (`COLUMNS`, `parseWorkoutRows`); what is missing is a way for the person to supply
that map when the app is not one we know.

## Goals

1. When a CSV's header is not recognised, offer "Map the columns" instead of failing or guessing.
2. Ask only for what is needed: a date column and an exercise column, then optional set number, weight, reps,
   time, distance, speed, RPE/RIR, notes, workout duration and unit.
3. Show a 10-row preview (parsed back as a session would be) before importing.
4. Save the mapping under a header signature, so the next export from the same app is one tap.
5. Reuse the existing parsing, exercise matching (`import-choices`), merge (`mergeImport`) and hostile-input
   guards. No second importer.

## Non-goals

- Mapping body measurements or programmes in v1; workouts only.
- Importing JSON or a photo of a paper log.
- Auto-detecting the app by content or a file fingerprint.
- Editing a saved mapping from the UI in v1 (delete and redo is enough).
- A server-side import: this stays on the device, like the current import.

## Data

- A mapping is `{ signature, columns: { date, exercise, set?, weight?, reps?, time?, distance?, speed?, rir?,
  rpe?, note?, duration?, unit? }, options: { delimiter, dateFormat?, unit? } }`.
- `signature` = the header row lower-cased, trimmed, sorted? No: **in order**, joined by `|`, hashed short.
  Order matters because a column map is positional in the file. A different order is a different mapping.
- Storage in v1: `S.csvMaps`, a stamped map keyed by the signature (`{ [signature]: { ...mapping, _ts } }`),
  capped at 10 live entries. It rides in the sync and the backup like other import preferences; a delete is a
  stamped tombstone (`{ _ts }`), so another device cannot bring the mapping back (see "Sync, tokens, merge").
- Column matching: each `<select>` offers the file's headers. Required: date and exercise. A column can be
  used once; the sheet says which are unused.
- Dates: accept the formats the existing parser accepts; when a file's dates are ambiguous (03/04), offer a
  day-first/month-first choice and show the preview in the chosen interpretation.
- Units: a weight unit column or a single unit choice; kg/lb; distance m/km/mi; time in mm:ss or seconds.
  Reuse `fromCsvUnit` and the existing set parsing.
- Exercise matching: the same `import-choices` sheet and aliases; unmatched names appear as "new exercise"
  with the catalogue search, exactly as the known importers do.

## Where it shows

- The import screen (`sheets.jsx`, `import-csv` entry): when `detectSource` returns null or parsing yields
  no rows, the error action becomes **Map the columns**, opening a `CsvMapSheet`.
- The sheet: a small table mapping each field to a header, required fields first; a preview below; then
  **Import**.
- Settings → Data & backup: "Saved CSV mappings" lists signature + date, with a delete action. Optional in v1.
- Strings through `t()`; no locale edits in the PR, and untranslated packs fall back to English. File headers
  are data: shown exactly as the file has them (`Name (column 3)` for duplicates) and never translated. Reuse
  the existing unit and field labels where one exists.

## Sync, tokens, merge

- `S.csvMaps` is a stamped map: every entry carries `_ts`. Add `csvMaps` to `STAMPED_MAPS` in
  `frontend/src/lib/sync-merge.js` and in the hand-copied `api/sync-stamps.js`; the existing parity test
  (for example `ex-unit.test.js`) compares the two lists, so a missed copy fails CI.
- Merge per signature (`mergeStampedMap`): the entry saved last wins, and a signature present on one device
  only is kept. A delete is a tombstone (`{ _ts }`) stamped later than the entry, not a plain removal:
  without it the other device's copy would resurrect the mapping on the next sync.
- The 10-entry cap counts live mappings only; tombstones are kept for the merge and pruned like other stale
  markers.
- Tokens: `csvMaps` gets no `KEY_CATEGORY` entry, so it stays a setting — any token that can read anything may
  read the saved signatures and column choices (they are not personal data), and no token may write it. It is
  not in `NEVER`.
- Backup/export/import and the mobile state file carry the field automatically once it is in `S`; no new
  route, and `api/openapi.yaml` describes the state document generically.

## Edge cases

- A header with duplicate names: the select shows `Name (column 3)`; the mapping stores the index, not the
  name.
- A file with no header row: v1 does not support it; the sheet says so.
- A delimiter other than comma (semicolon, tab): detected from the first line; overridable.
- A file with two header lines (a title above): v1 does not support it; the sheet says so.
- A huge file: the preview reads only the first rows, but the import still parses the whole file with the
  existing size and row guards.
- A mapping whose saved signature no longer matches (the app changed its headers): it simply does not apply;
  the user maps again.
- Hostile cells: formulas, prototype names, impossible dates — the existing hostile-input tests are the
  contract; the mapper feeds the same `parseWorkoutRows`.
- A workout with no set column: one set per row; the set number is optional.
- Two workouts on one date: the existing "complete a day instead of skipping it" logic (#1206) applies.

## Tests

- Pure: signature stability, mapping validation, required fields, preview rows, date ambiguity, units.
- Integration: a small fixture CSV mapped by hand produces the same sessions as a hard-coded importer for the
  same data; hostile cells behave as the existing parser expects.
- Saved mapping: stored, applied on the next import, deleted; a different header order does not apply.
- UI: the "Map the columns" path appears only when detection fails; the preview blocks Import until required
  fields are set.

## Decisions

1. **Where the mapping lives:** `S.csvMaps`, synced and stamped (decided 2026-11-17). A device-local store is
   not used in v1.
2. **Scope:** workouts only in v1. Measurements can reuse the same idea later.
3. **Unknown-header detection:** only when the known readers fail. A manual path on a recognised file invites
   mistakes.
