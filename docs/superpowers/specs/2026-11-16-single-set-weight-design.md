# One working set's weight without the cascade

Status: candidate, designed 2026-11-16 (issue #1166). Open questions at the end must be answered before an
implementation plan. Nothing implemented.

## Why

Today, changing a work set's weight in a live workout cascades down to the following inherited work sets
(`Workout.jsx:1600`, `cascadeWeight` in `frontend/src/lib/history.js:1142`). That is usually right: a
correction carries through without retyping every row, and a row marked manual or already done stays put.

It is wrong when the sets are intentionally different — a heavy top set then lighter back-offs, or one set
deloaded on the spot. The workaround is to edit every following row by hand so each becomes manual, which is
the thing the issue asks to avoid.

## Goals

1. A way to edit one working set's weight without touching any later set, without making every later row
   manual first.
2. The default stays today's cascade. Nobody's existing habit changes silently.
3. The choice is available where the edit happens (the set row/sheet), not buried in Settings.
4. Warm-ups, done rows, back-off sets, pyramids and per-side rows keep their existing rules.

## Non-goals

- A redesign of the weight cell or the stepper.
- Automatic back-off calculation beyond what `cascadeWeight` already does with `backoffStep`.
- Bulk-editing several sets at once.
- Changing the routine's target weight (that is the exercise settings sheet, not a session edit).

## Proposal

Two layers, the first one enough for v1:

1. **A Settings switch (v1):** Settings → During a workout → "Weight changes apply to the following sets",
   on by default. Off makes `setField` mark the edited row manual and skip `cascadeWeight`. One switch, one
   code path, easy to explain and test. Stored as `S.weightCascade` (absent = on), synced like a setting.
2. **A per-edit action (phase 2 if wanted):** after a cascaded edit, a toast "Applied to the following sets"
   with an **Only this one** action that restores the previous rows and keeps the edit on the edited row only.
   The mutation can capture the rows from before the edit for that undo; the store's update callback is the
   place to keep that local snapshot, so no new history is stored after the toast is gone.

The alternative — a per-set "Only this set" toggle that changes the *next* edit — is more UI state for the
same result. The switch is the smaller promise and matches the issue's wording.

## Where the logic lives

- `frontend/src/lib/history.js` `cascadeWeight` is unchanged; the caller decides whether to call it.
- `frontend/src/views/Workout.jsx` `setField` (`:1589`): read `S.weightCascade !== false` before the
  `cascadeWeight` call. The edited row is marked `WEIGHT_ORIGIN_MANUAL` in both cases, so a later edit still
  behaves like a manual exception.
- A tiny pure helper (or just the boolean) so the tests can read the decision without a view.
- No change to `buildWorkSets`, back-off seeding or the watch's weight path.

## Edge cases

- Cascade off, editing set 1: set 2–N keep their own values; later edits of set 2 do not touch set 1 or 3.
- Cascade on: today's behaviour, including skipping done and manual rows and the `backoffStep` ladder.
- Per-side sets: the switch disables the cascade for both sides of the edit; a later manual side stays manual.
- Warm-ups: never cascaded; the switch does not change that.
- A pyramid: the plan owns each set's target; the switch only affects a live edit's propagation.
- Back-off sets: with the switch off, the explicit edit still applies to the edited row only; with it on, the
  existing `backoffStep` ladder is unchanged.
- A re-opened saved workout: the switch is a live-session behaviour; editing history uses the session editor,
  which has its own rules.
- Sync: `weightCascade` is one setting; the last change wins whole, like other settings.
- A hostile state file with `weightCascade: "false"` (a string): treated as on; only `false` turns it off.

## Tests

- Current cascade cases still pass with the switch absent or on.
- Switch off: one set's weight changes, the following rows keep their values, the edited row is manual, a
  second edit of that row still does not propagate.
- Per-side, warm-up, back-off and done-row cases with the switch off.
- Settings row persists and syncs; a backup round-trip keeps it.
- The phase 2 toast, if built: the action restores the exact previous rows.

## Open questions

1. **Switch vs per-edit action:** the switch first (proposed) or the toast first? Proposal: the switch; it is
   the smallest change and covers the issue. The toast is a nice follow-up.
2. **Default:** on (proposed, preserves today) or off (the issue's preference, but it changes everyone's
   behaviour). Proposal: on.
3. **Where in Settings:** "During a workout", next to the workout-controls switches (proposed).
