# Left/right asymmetry

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented.

## Why

The app already logs a unilateral set per side (`sides.L` / `sides.R`, issue #60) and shows the two numbers in
history. It never compares them. A persistent left/right gap is one of the few training signals a lifter can
act on — from a returning injury to a dominant side carrying the load — and it is already in the data, free.

## Goals

1. In an exercise's detail (Stats → exercise), a small "Left / Right" card for unilateral exercises only.
2. Two values (the latest best per side) and the gap as a percentage of the stronger side.
3. A trend over the last sessions, not a single session: a one-off difference is noise.
4. A neutral flag when the gap is at least 10 % across at least three sessions with both sides.
5. No new profile field, no sync change, no server call. Pure function over history.

## Non-goals

- Recommendations ("add a set on the left"), automatic volume changes, or injury diagnosis.
- A body-map heatmap of asymmetry.
- Comparing different exercises, or a gym-wide "balance score".
- A new module or a Settings switch in v1.

## Data and metric

- Unilateral exercises only: `isPerSide(cfg)` on the exercise's own config, or a history row that is a
  per-side set. Ignore bilateral rows.
- Reps mode: a side's best set in a session is the highest estimated 1RM for that side
  (`estimate1RM(w, r)`, `frontend/src/lib/onerm.js`). A side with no completed set is missing.
- Time mode (per-side holds): a side's value is its longest completed hold in seconds; no 1RM.
- Per session with both sides and at least one completed set each:
  `gap = (strong - weak) / strong`, where `strong = max(L, R)`.
- The displayed gap is the median of the last five sessions that have both sides, and only when there are at
  least three such sessions; fewer means "not enough sessions yet" (or nothing at all).
- The flag is on when the median gap is `>= 0.10` and the sign is the same in at least two of the last
  three sessions (a side that keeps swapping is noise, not an asymmetry).
- Units are the profile's; the two values are always shown in the same unit.

## Where it shows

- Stats → exercise detail, below the existing 1RM/effort chart: a compact row `Left 42.5 kg · Right 45 kg ·
  6 %` and, when flagged, one neutral line: `A 12 % gap across 4 sessions. Worth watching.` No advice.
- Nothing on Home, nothing on the watch, nothing in the share card in v1.

## Edge cases

- A per-side timed hold logs two rows with `side: 'L'|'R'`; group them by session and take the best each.
- A per-side reps set stores both sides in one row; `doneSides` (`per-set.js`) is the model.
- Warm-ups excluded; a drop/rest-pause main set counts as its main set.
- Imported sessions often have no per-side data; they simply do not contribute.
- Bodyweight or assisted exercises: the 1RM of an added/assisted load is not comparable across sides when
  one side is assisted differently; skip assisted exercises in v1.
- A session where only one side was done (an injury day) does not contribute.
- A side with 0 reps/0 seconds is missing, not "zero strength".

## Tests

- Both sides equal; one side missing; one session (no card); three sessions with a stable 12 % gap (flag).
- Sign flipping across sessions (no flag).
- Reps vs time mode; warm-up exclusion; assisted skipped; imported rows without sides.
- Unit display and rounding (one decimal, as the rest of the app).

## Open questions

1. **Metric:** estimated 1RM per side (proposed) or the top set's weight × reps? e1RM is comparable across
   rep counts but noisy at high reps; the top set is simpler. Proposal: e1RM for reps, longest hold for time.
2. **Threshold:** 10 % over three sessions is a guess. Proposal: keep it and show the raw numbers, so the flag
   is secondary to the data.
3. **Placement:** Stats → exercise detail (proposed) or a new section in the Muscle balance card? Proposal:
   the exercise detail, where the history already lives.
