# Rest suggestion from logged effort

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

Rest is set per exercise (a wheel up to 15 minutes) and mostly stays where it was set. Effort is logged
(RIR or RPE, `frontend/src/lib/effort.js`), and a run of sets rated RIR 0–1 at a 90-second rest is a strong
signal that the rest is short for that lift. Today the app neither notices nor says anything; the lifter has
to remember to open the exercise settings after a hard session.

## Goals

1. In an exercise's settings sheet, one plain line when the recent effort says the rest is too short:
   "Last 5 sessions: mostly RIR 0–1 at 1:30. Try 2:00." with a one-tap **Use 2:00**.
2. It only ever suggests **more** rest, in 30-second steps, capped at the wheel's 15:00.
3. Nothing changes automatically. The timer keeps running exactly as configured until the lifter taps.
4. No new profile field: the history is the source; the current rest setting is the target.
5. Visible only with the Effort module on (no ratings, no suggestion).

## Non-goals

- A live nag during a set or on the rest bar. The suggestion lives in the settings sheet.
- Shorter-rest suggestions: under-resting is not something the app should encourage.
- Per-set rest surgery or automatic rest for supersets.
- Using heart rate, sleep or the daily check-in to guess recovery.

## Data and rule

- Read the exercise's last `LOOKBACK` (5) sessions that contain at least `MIN_RATED` (3) completed work sets
  with a logged rating (not an estimated RIR: `rirOf` returns `{ rir, estimated }`, and estimated ones are
  excluded).
- Convert RPE to RIR through the same helpers the rest of the app uses (`effort.js`), so the rule works for
  either scale.
- `hard` = a set with RIR ≤ 1 (RPE ≥ 9). The suggestion fires when:
  - at least 70 % of those rated sets in the window are hard, and
  - the exercise's current rest (`ownExerciseRest(cfg) ?? S.restSec`) is under `REST_CAP` (180 s) and above 0
    (0 = "no timer" is a deliberate choice, not a mistake).
- Suggested rest = current + 30 s, rounded to the wheel's step, capped at 900 s. If the result equals the
  current value, nothing is shown.
- The line says how many sessions and which scale it read; it does not claim the rest is "wrong".
- For a per-side exercise the main set's rating is used; timed holds and cardio are skipped (no load to
  recover from in the same sense).

## Where it shows

- `frontend/src/sheets.jsx` exercise settings sheet, under the rest row: a quiet line with the sentence and a
  **Use {0}** button. After the tap, the line disappears for that exercise until the history changes.
- No Home card, no workout-screen chip, no notification in v1.
- The same suggestion can be surfaced in the exercise detail (Stats) later; not in v1.

## Edge cases

- Fewer than 5 sessions or fewer than 3 rated sets: nothing.
- A mix of RIR and RPE in the window: both are normalised; the count is of rated sets, not sessions.
- An assisted or bodyweight exercise: allowed; the effort rating is still meaningful.
- An exercise with rest "No timer": no suggestion.
- A user who deliberately trains to failure with short rest (rest-pause style): the 70 % rule may fire; the
  line is only a suggestion and the setting can be ignored. A future switch can turn the hint off.
- Imported effort ratings count if they are on the same scale; estimated RIR does not.
- Changing the rest setting by hand makes the line disappear on the next render.

## Tests

- Pure: RIR-only window, RPE-only window, mixed, 2/5 hard (no), 4/5 hard (yes), rest 0 (no), rest 80 (yes,
  propose 110), rest 180 (no), cap at 900.
- Estimated RIR excluded; timed/cardio skipped; per-side uses the main rating.
- Settings sheet: the line and the button set `restSec` and persist through the normal exercise settings path
  (which already keeps changes when the sheet closes, #1213).

## Open questions

1. **Placement:** settings sheet only (proposed) or also a quiet chip on the rest bar? Proposal: settings
   sheet first; a live chip risks nagging mid-set.
2. **Turning it off:** no switch (the line is rare and passive) or a Settings row under Effort? Proposal: no
   switch in v1; add one only if it annoys people.
3. **Threshold:** 70 % hard at RIR ≤ 1 is a guess. Proposal: start there and log nothing; tune from feedback.
