# Injury mode: an exercise that hurts

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

The app has injury-adjacent pieces but nothing at the exercise level: a day note tagged `injured` excuses a
day from the nudge and the streak, a whole session can be excluded from progression (`session-noprog.js`),
and the Coach's intake remembers limitations in free text. None of them says "this exercise hurts my left
shoulder until December, don't progress it and don't prescribe it".

A flag per exercise is small, local, and more useful than a note nobody reads mid-workout.

## Goals

1. In an exercise's ⋯ menu: **Trouble / avoid** with a note, a side (left, right, both), and an optional
   "until" date.
2. While active, the exercise shows a warning line in the workout (calm, not red) with the note.
3. Progression for that exercise is paused while the flag is active: targets stay where they are, no load
   increase, no stall/deload counting.
4. A one-tap offer of the exercise's backup (`backupSuggestions`, `exercise-substitutes`) in the routine
   editor and in the workout's swap sheet.
5. The Coach's context includes active flags, so it does not prescribe the exercise.
6. The routine editor and the start preview show a small marker on the exercise.

## Non-goals

- Medical advice, a diagnosis, or a rehabilitation programme.
- Automatic swapping without a tap.
- A muscle-level "avoid this region" map (phase 2).
- Hiding the exercise from the library, history or stats.
- A new module in v1; the feature is invisible until used.

## Data

`S.exerciseTrouble`, a stamped map keyed by exercise id:

```js
S.exerciseTrouble = {
  '0025': { note: 'left shoulder pinches at the bottom', side: 'L', since: '2026-11-16', until: '2027-01-15', _ts: 1763... }
}
```

- `since` defaults to today; `until` is optional (open-ended), inclusive.
- `side`: `'L' | 'R' | 'both'` (default `both`); used for the warning text and for per-side sets.
- An entry with only `_ts` is a tombstone, as in `dayNotes`.
- Read back with validation: known keys, ISO dates, `until >= since`, note capped like a set note. A flag is
  **active** when `today >= since` and (`until` is missing or `today <= until`); expired entries stay stored
  and read as inactive, so history is kept.
- Sync: add to `sync-merge.js` and `api/sync-stamps.js` as a stamped map; `api/tokens.js` puts it under
  `plans` (a planner may read it; a workouts-only token may not need it).

## Where it shows

- **Workout**: under the exercise's other notes (`Workout.jsx` `exnote` block): a warning icon, the note, and
  "until 15 Jan" when set. The line is informational; the set rows stay editable.
- **Exercise ⋯ menu**: a "Trouble / avoid" item opening a sheet (note, side, until date).
- **Routine editor**: a small warning chip on a flagged exercise's slot.
- **Start preview**: the same chip in the exercise list.
- **Swap/backup sheet**: flagged exercises are suggested for the relevant slot; the existing backup suggestions
  are enough, no new ranking.
- **Stats / library**: no change in v1; a flagged exercise is not hidden.

## Effects

- **Progression:** while active, `applyPrescription`/session building treats the entry like `noProg` for that
  exercise only: the routine's target is shown but no load/reps increase is applied, and missed reps do not
  start a stall. This must not affect other exercises in the same session.
- **Coach context:** `frontend/src/lib/coach-context.js` lists active flags with their notes and dates.
- **MCP:** phase 2; the state is visible to a full read anyway.
- **Recovery hints / muscle map:** phase 2; no change in v1.
- **Finish summary:** no change; a flagged exercise can still be logged and PRs still count, because the
  lifter chose to train it.

## Edge cases

- Flag set for an exercise that is not in any routine: valid; it shows in the exercise detail and the library's
  ⋯ menu.
- Flag with `until` before `since`: rejected on read (inactive) and by the sheet.
- A per-side flag: the warning names the side; a per-side set still logs both sides. No automatic skipping of
  the painful side.
- A timed hold: same rules; no time progression while active.
- A custom exercise: same map, keyed by the custom id.
- A deleted exercise: the entry stays (like other per-id maps) and does nothing; `exercise-merge` carries it
  when two exercises are merged.
- A flag ending mid-session: the session uses the flag state at build time; a change mid-session applies on
  the next build.
- Two devices editing the same exercise's flag: stamped per key, later `_ts` wins.

## Tests

- Pure: read/clean/active/expired/tombstone; `until` inclusive; side parsing.
- Session building: progression paused for the flagged exercise only; other entries unchanged; a flagged
  entry still logs and still counts for volume/PRs.
- Sync: per-key merge, tombstone, backup round-trip, token scoping.
- Views: menu item, sheet, warning line, routine chip, preview chip.
- Coach context: the flag appears with its dates.

## Open questions

1. **Module or setting:** none (proposed) or a switch under a new "Injury" area? Proposal: none; an unused
   feature is invisible, and Modules is for whole areas of the app.
2. **Automatic swap:** offer the backup and let the lifter tap (proposed), or swap automatically when the
   workout builds? Proposal: offer only; automatic swapping hides a choice.
3. **Muscle-level avoidance:** a separate phase 2 ("avoid overhead pressing for two weeks") is tempting but
   needs a movement taxonomy the catalogue does not have yet.
4. **Progression pause semantics:** freeze the target exactly (proposed) or let the lifter keep progressing
   with a warning? Proposal: freeze; the flag is explicit.
