# Session length estimate

Status: agreed 2026-11-16 (the lifter's calls: a passive label only; history first, plan until there is
history; Plan rows and the start preview, not Home or print). Nothing implemented yet.

## Why

Before a session, "do I have time for this?" is a real question, and the app already knows the answer: every
finished workout stores `start` and `end`, and `workoutDuration` (`frontend/src/lib/history.js:1019`) reads
them. Today that duration only appears after the fact, in reports and share cards. Nothing predicts it, so a
routine card says "6 exercises" and nothing about the 55 minutes those six usually take.

A rough number is enough. It is a planning aid, not a promise: "≈55 min" makes a routine comparable to the
time you have, and it gets better with every session.

## Goals

1. A label on a routine row in Plan: `6 exercises · ≈55 min · Mon, Thu`.
2. The same label on a plan day that holds one or more routines.
3. The label in the start preview header, next to the exercise count.
4. History first: the median of the last five finished sessions of that exact routine set, once there are
   two. Until then, a plan-based estimate so a new profile still sees a number.
5. Nothing stored: no new field in `S`, no sync stamp, no API change. A corrected or deleted session changes
   the number on the next render.

## Non-goals

- "I have 40 minutes" planning, trimming a routine to fit, or a time budget filter. That is phase 2.
- Home's today card, the widgets, the watches or the performance report.
- A per-exercise or per-set breakdown of where the time goes.
- Storing or syncing an estimate. The history is the source of truth.

## Anti-goals

- A label that contradicts the Clock: a 3-hour "forgotten" session must not become the estimate.
- A label on a routine that has neither history nor an exercise.
- A number that changes between two renders of the same state.
- Loading the Plan screen noticeably slower on a profile with thousands of workouts.

## Data

### Which sessions count

- `S.workouts` only (`S.active` is not in it, so an in-progress session never counts).
- The workout's routine set, normalised the way `history.js` reads it:
  `[].concat(w.routineIds ?? (w.routineId ? [w.routineId] : []))`, de-duplicated and sorted. It must equal
  the requested set exactly: a combined A+B session is not history for A alone.
- `workoutDuration(w)` between `DURATION_MIN` (5 min) and `DURATION_MAX` (4 h). The lower bound keeps a
  two-minute test row out; the upper bound keeps a session left running after the gym out.
- Skip sessions the app already treats as not counting: `w.excludeFromProgression === true`, or every entry
  `noProg === true`. A deload or an injury day is shorter and would pull the median down.
- Sort by `workoutDay(w)` then `start`, newest first; take the last `HISTORY_N` (5).

### History estimate

- With at least `HISTORY_MIN` (2) samples: the median of their durations, in minutes.
- With 0 or 1: the plan estimate below. One session is a poor median, and the plan is usually close enough
  until the second one exists.

### Plan estimate

Built from `routine.ex`, not from a started session, so it is cheap enough for every row in Plan:

- Mode from `modeOf({ ...cfg, id })`; per-side from `isPerSide(cfg)`.
- Work time per set:
  - reps: `REPS_SET_SEC` (40 s), both sides of a per-side set included;
  - time: `set.sec ?? cfg.sec ?? 45`; a per-side timed exercise has `sets × 2` rows;
  - cardio: `(set.min ?? cfg.min ?? 20) × 60`;
  - distance: `DISTANCE_SET_SEC` (60 s).
- Warm-ups: `cfg.warmupSets × WARMUP_SET_SEC` (20 s) plus the warm-up rest between rungs, resolved with
  `warmupRestSecFor` (`frontend/src/lib/supersetFlow.js`) and `S.warmupRestSec`.
- Rest between work sets: `ownExerciseRest(cfg) ?? (S.restSec > 0 ? S.restSec : 90)`, times `sets - 1`.
- Between the sides of a timed per-side set: `sideRestFor(cfg, { timed: true, restAfter: workRest, switchSec })`.
- After the last set of an exercise: `transitionRestFor` (`nextRestSec`/`nextRestOff`, else the profile's,
  else the work rest) plus `SETUP_SEC` (30 s) for walking to the rack and loading.
- Supersets: group consecutive entries sharing `sg` with `supersetUnits` (`history.js`), count the round's
  work as the sum of its members and the round's rest once (`restSecFor`), not once per member. A superset
  that is approximated per exercise would overestimate badly.
- Sum, then round once for display.

The constants are heuristics and live at the top of the module with this note. They matter only until the
second finished session; after that the history median takes over.

### Combined sessions

- A plan day that trains A+B is its own session. If an exact `[A,B]` history exists, use it.
- Otherwise sum the estimates of A and B, each from its own history or plan. The shared warm-up and the
  transition between them make the sum slightly high; it is the honest version of "the two routines you
  do together".

## Where it shows

- `frontend/src/views/Plan.jsx`, the routine subtitle `sub(r)` (`:475`): insert after the exercise count.
- `frontend/src/views/Plan.jsx`, the weekday row `dayRow` (`:300`): insert after the exercise count; for
  several routines use the combined estimate.
- `frontend/src/components/StartSheets.jsx`, the preview header (`:128-134`): insert after the exercise
  count. `buildCombinedEntries` already returns the resolved `routineIds`, which is the key to estimate.
- Nothing else in v1.

## Wording

- Visible: `t('≈{0} min', n)` with `n` rounded by `uiMinutes`: to the nearest 5 above 20 minutes, to the
  nearest 1 below (so 12 stays 12, 53 becomes 55). No "about" in the visible string; `≈` already says it.
- Screen reader: `tn('about {0} minute', 'about {0} minutes', n)` on the label, because "≈" is not announced
  usefully. The same pattern the rest of the app uses for durations (`lib/duration.js`).
- No new locale entries in the PR: the English source string is enough; packs fall back until translated.

## Where the logic lives

- New `frontend/src/lib/session-length.js`, pure, no DOM, no store:
  - `sessionLength(S, ids, { now } = {})` → `{ minutes, source: 'history' | 'plan' | 'mixed', samples } | null`;
  - `routinePlanMinutes(S, routine)` for the fallback;
  - `uiMinutes(minutes)` for the display rounding.
- Tests beside it: `session-length.test.js`.
- Views call it; no view holds its own copy of the formula. In Plan, compute once per render with the
  history index inside the module (`useMemo` on `S.workouts` if it shows up in profiling).

## Edge cases

- A routine that never had a solo session but was only ever trained combined: plan estimate (the exact set
  does not match). That is correct, not a bug.
- Imported sessions with no `start`/`end`: `workoutDuration` is 0, so they are out of the window.
- A session edited to a different date or duration: re-read on the next render.
- A routine edited (an exercise added): old sessions still count; the median adapts within five sessions.
  We do not require the same exercise count, because swaps are normal.
- Multiple routines on a day, trained apart (`weekApart`): each session gets its own estimate.
- A routine with 0 exercises: no label.
- Units do not matter: minutes are minutes.

## Tests

- History median: five sessions, one outlier; two sessions; one session (falls back to plan).
- Exact-set matching: `[A]` vs `[A,B]` vs `[B,A]` (order is irrelevant).
- Filters: 0 duration, 4 h+, `excludeFromProgression`, every entry `noProg`.
- Plan fallback: reps, timed, per-side timed, cardio, distance, warm-up rows, a superset group, an
  exercise with its own `restSec`/`restOff`.
- Combined: exact history wins; otherwise the sum; `source` is `mixed` when one side is plan.
- Display: `uiMinutes` boundaries (19, 20, 22, 53, 57) and the two strings.
- Views: Plan routine row and day row show the label; Preview shows it; no label for an empty routine.
- A quick sanity check with a few thousand workouts, so Plan does not become visibly slow.

## Phase 2 (not this spec)

- "I have N minutes" and a suggestion of what to trim.
- Home's today card, the widget snapshot, the print/PDF plan and the watches.
- A calibration factor learned from the profile's own actual/estimate ratio for routines with unusual
  warm-ups or long transitions.

## Open questions

1. Whether the plan estimate should also apply a profile-wide calibration factor (actual ÷ estimated over
   past sessions). Proposal: no in v1; the history median arrives after two sessions anyway.
2. Whether a label is useful on the routine's own edit screen. Proposal: no; Plan and the preview are the
   decision points.
3. Exact superset approximation in the plan estimate. Proposal: the grouped version above; if it proves
   fiddly, ship per-exercise and note the limitation in the code comment rather than delaying the feature.
