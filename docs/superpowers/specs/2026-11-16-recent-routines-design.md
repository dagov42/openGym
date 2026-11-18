# Recent routines in the start picker

Status: implemented 2026-11-18 (`lib/recent-routines.js`, `StartSheets.jsx` StartPicker; tests:
`recent-routines.test.js`, `StartSheets.test.jsx`). The lifter's calls stand: routines only; the
exercise picker already has "Chosen" by frequency, so no second exercise chip.

## Why

The Start picker (`frontend/src/components/StartSheets.jsx`, `StartPicker`) shows today's planned sessions,
then every other routine with favourites first. Many people rotate through a handful of routines without
starring them; after a week off, those routines are somewhere in a long list, sorted by nothing they
recognise. "Recent" is the order they actually think in: the last one I trained.

The exercise picker already solves its version of this with a "Chosen" filter (`usageMap`, frequency-based).
This spec deliberately does not duplicate it; it is about routines on the start screen.

## Goals

1. In the Start picker, a **Recent** section above "Other routines": up to five routines, newest last-used
   first, excluding the sessions already shown under Today.
2. A routine used in the last `RECENT_DAYS` (90) days qualifies; with fewer than `MIN_RECENT` (2) the section
   is omitted, so a new profile sees no empty header.
3. No duplicate row: a routine in Recent is not repeated in "Your routines".
4. Derived from `S.workouts` on each open; no new field, no sync.
5. Tapping a Recent row goes through the same `startOrPreview` path as every other row.

## Non-goals

- Recent exercises (the picker's Chosen filter covers frequency; a recent sort can be a later, separate
  decision).
- Recent in Plan, Library, History or the widgets.
- Reordering the stored `S.routines` list; this is a view order only.
- A "most used" or "streak" ranking.

## Data

New pure `frontend/src/lib/recent-routines.js`:

- `lastUsedByRoutine(S)` → `Map<routineId, { at, day }>`: for every workout, take
  `[].concat(w.routineIds ?? (w.routineId ? [w.routineId] : []))`, and keep the newest `workoutAt(w)` (fall
  back to `workoutDay(w)` at noon) per id. Skip workouts without a routine id and ids that no longer exist in
  `S.routines`.
- `recentRoutines(S, { limit = 5, days = 90, now = Date.now(), exclude = [] } = {})` → the routine objects,
  newest first, filtered to the window, excluding `exclude` (today's planned ids) and de-duplicated. The
  cutoff uses the routine's last workout date, not the workout array order.
- Ties: the later `start` wins; the stored order breaks a remaining tie for stability.
- A routine used as part of a combined session (`routineIds: ['A','B']`) is recent for both A and B.

## Where it shows

- `StartPicker` (`StartSheets.jsx`): after the Today list and before **Other routines**:
  - `h4` heading **Recent**;
  - up to five `Row`s with the routine's glyph, its favourite star if starred, and the same
    `exCount(r.ex.length)` subtitle as Today/Other;
  - the same `onClick` (`go([r.id])`).
- `others` for the "Other routines" section excludes every id shown in Recent; the existing
  `favRoutinesFirst` order is kept for the remainder.
- If the picker only has Today and Recent rows, no "Other routines" header.
- The Start sheet is opened fresh each time; no state to persist. A workout finished meanwhile changes the
  next open's Recent list.

## Edge cases

- No workouts: no Recent section.
- Only one routine in the window: no section (`MIN_RECENT = 2`).
- A routine deleted after being logged: skipped.
- A routine logged for the first time today and not in Today's plan (freestyle or an extra session): it
  qualifies; it is not excluded unless its id is in Today's planned set.
- Today's planned routine also used last week: excluded from Recent (it is already the big row above); its
  last-used date still counts for the window if it appears elsewhere? It is excluded by id.
- A workout with a routine id that no longer exists: ignored.
- An imported workout with no routine ids: contributes nothing.
- A combined session: both routines get the same date; the tie is broken by the picker's own order.
- A profile with hundreds of routines: the map is one pass; the section is capped at five.
- The day boundary uses local dates through `workoutDay`/`workoutAt`, as the rest of the app does.

## Tests

- `lastUsedByRoutine`: single, combined, deleted routine, workout without ids, newest wins, tie by start.
- `recentRoutines`: window cutoff, limit, exclusion, fewer than two, order, combined sessions, stability.
- View: the Recent header and rows appear; no duplicate in Other routines; tapping starts/previews; no
  section for a new profile or a single recent routine.
- A profile with an empty `S.workouts` and one with many.

## Where the logic lives

- `frontend/src/lib/recent-routines.js` + `recent-routines.test.js`.
- `frontend/src/components/StartSheets.jsx` `StartPicker`: compute in a `useMemo` over `st.workouts`,
  `st.routines`, today's ids; render the section.
- Strings: `Recent` through `t()`. No new `S` field, no API.

## Open questions

1. **Limit and window:** five routines and 90 days (proposed). A routine used once four months ago is not
   "recent" to most people; the window keeps the header honest.
2. **Favourites in Recent:** keep them (proposed) with the existing star; excluding them would surprise
   people who starred one recently.
3. **Placement:** above Other routines (proposed) or a sort of the existing list with no header? Proposal:
   the header; it explains why the order changed.
