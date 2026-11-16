# Backup preview and data health

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

`Settings → Data & backup → Import backup` reads a JSON or zip (`frontend/src/lib/backup-media.js`), quietly
drops rows no reader can use (`backup-sane.js`), and asks whether to replace the profile. The question does
not say what is inside the file: how many workouts, how recent, which routines, whether it is older than the
current profile. For a self-hosted app, "my backup replaced my data" is the highest-stakes button in the
product; it deserves a look before the tap.

The same trust problem shows up in the admin: a state file can hold broken rows, orphan routine ids or
duplicate workout ids, and nothing reports it until a screen fails.

## Goals

1. After picking a backup, a preview sheet before anything is applied: counts, date range, last workout,
   custom exercises, measurements, media files (zip), size, and how many broken rows were dropped.
2. A comparison with the current profile: workouts/routines/measurements added or missing, and whether the
   backup is older or newer (`S._ts`).
3. The final confirmation says plainly that importing **replaces** the current profile and that Export is the
   way to keep a copy first.
4. Admin: a read-only "Data health" report for the chosen user's state file: broken rows, orphan routine ids,
   duplicate workout ids, media references with no file, and the last revision. No auto-repair.
5. Nothing is applied, stored or uploaded by the preview.

## Non-goals

- Merge-on-restore or partial restore (choose which routines/workouts to bring back). Phase 2.
- Repairing a state file in place from the admin.
- A scheduled backup integrity check or a notification when a backup is old.
- Parsing media for dimensions or content.

## Data

The preview is a pure function over what `readBackupFile` already returns (`{ state, files, zip }`) plus the
row count it dropped:

- `workouts`: count, first/last date, count in the last 30 days.
- `routines`, `programmes`, `customEx`, `bodyweight`, `measurements`, `activities`, `planPauses` (once the pause
  spec lands), `gymCards` count.
- Media: the number of media files the state refers to (`files`, already filtered to what the state uses) and
  their total bytes; for a JSON backup, how many media references the state carries.
- `dropped`: what `dropBrokenRows` removed. `readBackupFile` currently discards that count (`:144`); it gains
  a `dropped` field, or the preview calls `dropBrokenRows` on the raw state before the sanitised one is used.
  Prefer the additive `dropped` field: one parse, one number.
- `S._ts` and, when present, the file name's date.
- Diff against `S`: added/removed per list (counts only), and newer/older.
- For the admin report: `dropBrokenRows` counts, plus checks:
  - a workout whose `routineIds`/`routineId` names no existing routine (a deleted routine is allowed; a
    missing one is reported as "orphan reference", not an error);
  - duplicate workout ids;
  - `dayPlan`/`week` pointing at missing routines;
  - media refs (`w.entries[].media`, custom exercise media) with no stored file, where the app can tell.

## Where it shows

- `Settings` → Data & backup → Import backup: after the picker, a preview sheet (`sheets.jsx` or a component
  beside `backup-media.js`) with the summary and the two buttons, Cancel and **Import and replace**.
- `Admin.jsx` data view: a "Check data" button per user, opening a read-only sheet with the report and a
  **Copy report** action. A clean state says "No problems found" and shows the counts, so the button is not a
  red alarm.
- The existing import flow keeps its limits (`readBackupFile` size and count bounds, `storeBackupMedia`
  sniffing) and the same confirmation semantics.

## Edge cases

- A backup with one broken line: the preview says "1 broken row will be skipped", the import still brings the
  rest.
- A backup with zero workouts but routines: valid; the preview says so.
- A file that is not an openGym backup: the existing error (`backupImportError`) and no preview.
- A zip with extra files: only the files the state refers to are taken, as today; the preview says how many
  will be stored and skipped.
- A backup from a newer app with unknown keys: the preview does not interpret them; import keeps them as the
  current import does.
- A current profile with **more** data than the backup: the preview says "This backup has fewer workouts than
  your profile" and the confirmation stays honest.
- Admin on a profile whose state file is unreadable: the report says so; no crash.
- Two users importing at once: unchanged; the import is a client-side state replacement.

## Tests

- Preview counts and dates for a fixture backup; broken rows reported; media counts for a zip.
- The older/newer comparison; equal `_ts` reads as "the same age".
- The confirmation wording and the replace semantics (the current profile is replaced, not merged).
- Admin checks: orphan reference, duplicate id, clean state; a state with a `null` workout.
- Hostile input: a 100 MB zip and a 10,000-entry state are bounded as they already are; the preview must not
  iterate unbounded lists in a way that freezes the UI.

## Open questions

1. **Scope of the diff:** counts only (proposed) or a few named changes ("3 routines added: Push, Pull,
   Legs")? Proposal: counts, plus the last workout's date and name.
2. **Admin placement:** the existing Admin data view (proposed) or a new Diagnostics page? Proposal: the data
   view; it already lists state files.
3. **Merge-on-restore:** explicitly out of scope, but worth a follow-up spec if people ask for it.
