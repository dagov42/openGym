# Collapse a finished exercise, then swipe without touching its sets

Status: implemented 2026-11-18. The lifter's calls stand: the button toggles a visual fold only (no
data changes), it lives in Cards and Focus, it is enabled only once every set is ticked, and the fold
survives leaving and returning to the workout screen.

## Why

In the Cards layout a horizontal swipe turns to the next or previous exercise (`components/SwipeCards.jsx`).
Every set row opts out of that swipe (`data-swipe-ignore`, `components/SwipeRow.jsx`): on a set row a
swipe toward the start deletes the set (with an Undo) and a swipe toward the end copies it. So a gesture
meant for "next exercise" that happens to start on a set row deletes or copies a set instead. On a long
exercise the rows cover most of the card, and leaving an exercise you have just finished is exactly when
people swipe.

The List and Compact layouts already solve the visual half of this: a finished exercise folds into one
line (`S.collapseCompleted`, the `wl-summary` button). Cards has no fold, and the one thing on the card
that owns a sideways swipe is the set row. Folding the card away removes the rows from under the finger,
so the same swipe that used to hit a set now turns the card.

## Goals

1. A **Collapse sets** row in the bottom block of the workout screen, directly under **Add exercise**
   and above the session-note row.
2. It is enabled only when the current unit is finished by the rule the List already uses: every member
   of the unit has at least one set and every set (warm-ups included) is ticked.
3. Pressing it replaces the current card with the one-line summary the List uses: the exercise name(s),
   a check tag and the set count. No set data changes: `done`, weights, reps, effort and progress stay
   exactly as they were. The sets remain done; they are only visually collapsed.
4. The row and the summary are reversible: once folded, the row reads **Show the sets** and tapping
   either it or the summary unfolds the sets again. The summary is a plain button, so a swipe that
   starts on it turns the card and cannot delete or copy a set.
5. The fold is per workout and per app session: no new `S` field, no sync, no backup, no new
   dependency. It survives leaving the workout screen and coming back; a reload starts unfolded.
6. Works in Cards and Focus, for a single exercise and for a superset.

## Non-goals

- Ticking, deleting or otherwise changing sets; changing the progress counter.
- Removing or changing the set swipe (`SwipeRow`) or the card swipe's rules, including the
  `data-swipe-ignore` opt-out and the `swipeSets` setting.
- Folding in List or Compact, or changing `collapseCompleted` and its setting.
- Persisting the fold across a reload or syncing it between devices.
- Changing navigation: no auto-advance on finishing an exercise, no skip-completed interaction, no
  new Settings toggle.
- A confirmation sheet or a toast: the summary that replaces the card is the feedback.

## Decisions

- **What it means.** "Collapse sets" means "I have finished this exercise and want its rows out of the
  way for now". It does not tick, delete or complete anything: it is enabled only once every set is
  ticked, and after the fold the same sets remain ticked underneath. Leaving an exercise early stays a
  swipe or Next, as today.
- **Where.** Cards and Focus only (the layouts the card swipe navigates). The row sits between
  **Add exercise** and **Add session note** in the existing `wk-end` inset list.
- **Not in the editor.** A saved workout being edited (`editingWorkoutId`) has no session to navigate,
  so the row is hidden there. A backfill session keeps it: it is a live screen with a card that swipes.
- **Per workout, across screens.** The fold lives in a module-level map keyed by the workout id and the
  unit key. Leaving the workout screen and coming back keeps it; a reload starts fresh, like the List's
  `openedState`.
- **Reversible.** While folded, the row says `Show the sets` and the summary is the other way back. The
  row is never a dead "finish" action after it has been used.
- **Wording.** English: `Collapse sets` while open, `Show the sets` while folded. Russian: «Свернуть
  подходы» and the existing «Показать подходы». The translation batch adds both new keys to every pack;
  `Show the sets` already exists in all of them.
- **Disabled row explains itself.** While sets remain, the row is visible but disabled and carries the
  subtitle `Tick every set first`. It does not disappear, so the layout is stable and the action is
  discoverable before it is usable.

## Implementation

### State and readiness

`views/Workout.jsx` already has `units`, the current `unit` and the local `finished(u)` helper (every
member has at least one set, every set is done). The change adds:

```js
const foldedUnits = new Map()          // module level: survives leaving the workout screen
const folded = foldedUnits.get(A.id) || new Set()
const [, bumpFolded] = useState(0)
const setFolded = (key, on) => {
  const keys = new Set(foldedUnits.get(A.id) || [])
  if (on) keys.add(key); else keys.delete(key)
  if (keys.size) foldedUnits.set(A.id, keys); else foldedUnits.delete(A.id)
  bumpFolded(n => n + 1)
}
const unitKey = unit.join('-')
const unitReady = unit.length > 0 && finished(unit)
const isFolded = folded.has(unitKey)
```

`A.id` is the workout key, so a different workout with the same number of exercises starts
unfolded. `unit` is the current unit (one exercise or a whole superset), so the row always acts on
what the card shows. Pairing or unpairing changes the unit key, so a stale key simply stops matching.
The map is UI state, not profile data: nothing is written to `S`, the server or a backup.

### The row

In the existing `wk-end` block, only when `!listMode && !editing && A.entries.length > 0`:

```jsx
<button type="button" className="lrow tap wk-end-row" disabled={!isFolded && !unitReady}
  aria-expanded={isFolded}
  onClick={() => (isFolded ? setFolded(unitKey, false) : foldCurrentUnit())}>
  <Icon name={isFolded ? 'chevronDown' : 'checkCircle'} className="wk-end-i" />
  <span className="lrow-m">
    <span className="lrow-t">{isFolded ? t('Show the sets') : t('Collapse sets')}</span>
    {!isFolded && !unitReady && <span className="lrow-s">{t('Tick every set first')}</span>}
  </span>
</button>
```

Order in `wk-end`: Add exercise, Collapse/Show sets, Add/Edit session note. `.lrow:disabled` already gives
the disabled look and `.wk-end-row` already keeps the 46 px row, so no new CSS is needed apart from a
one-line check that the disabled row keeps the tap-target height in the existing tests.

### Folding

```js
const foldCurrentUnit = () => {
  if (!unitReady || !unit.length) return
  closeOpenRow()                                   // new import from lib/use-swipe-row.js
  setUI({ swipeHint: null, setFlash: null })
  setFolded(unitKey, true)
}
```

No profile write: the sets, `S.active.cur`, the set counters and the session object are untouched. The
fold itself is in the module-level UI map. Closing the open row first keeps a pending delete/copy
animation from outliving the row it belongs to (the same reason `Workout.swipe` tests call
`closeOpenRow` in teardown).

### Rendering the fold

In the non-list branch, when `folded.has(unitKey)`, the card body renders the summary instead of
`FocusView` / the superset card / the single `ExerciseBlock`:

- One line per member, exactly the List's markup (`views/Workout.jsx`, the `isCollapsed` branch):
  the exercise name in its own name class, and `<Icon name="check" />{t('{0} sets', n)}` in a tag.
- A `<button type="button" className="wl-summary" aria-expanded="false" title={t('Show the sets')}>`
  whose click calls `setFolded(unitKey, false)`. The List and Cards/Focus paths share one local helper
  so the two summaries cannot drift.
- The row in `wk-end` becomes the second way back: it says `Show the sets` while folded.
- `CircuitCard` stays where it is (above `SwipeCards`) and is not folded: it is the circuit player,
  not the set list.
- No `data-swipe-ignore` anywhere in the summary, and no `SwipeRow`: `SwipeCards`'s
  `IGNORED_TARGETS` does not list buttons, so a swipe starting on the summary turns the card, and the
  click a commit leaves behind is swallowed by `SwipeCards` as it already is for any button.

The chip row, Prev/Next, the header and the bottom block keep working while folded. Leaving the workout
screen and coming back keeps the unit folded; tapping the summary or the row unfolds it. Unfolding
restores the normal card (Focus returns to the first unfinished set, which for a finished exercise is
the last one). A reload starts unfolded.

### Focus

`FocusView` is one set on screen and has no `SwipeRow`, so the accidental-delete half of the problem
does not exist there. The fold is still offered for consistency: "finished, collapse" is the same
action in both card layouts, and the folded summary is the same one-line card. `pointerEpoch` and the
component's own pointer map are dropped with the view; unfolding remounts it with a fresh one.

## Edge cases

- **A set is unticked right after folding** (through the menu, the watch, or another tab): the card
  stays folded until tapped; the row now says `Show the sets`, so it is the way back. Unfolded, the row
  goes back to disabled with `Tick every set first`, and the summary still shows the real set count.
  Nothing is lost; the fold is presentation only.
- **A hold is running** (`working`): its set is not ticked yet, so the row is disabled. Folding never
  hides a running timer.
- **A rest is running** after the last set: folding does not stop it; the timer is global, not part of
  the card.
- **The last exercise**: folding it shrinks the only card; swiping does nothing (count is 1) and the
  summary's tap is the way back. No special case.
- **A superset**: `finished` requires every member to be complete, so the whole unit folds and unfolds
  as one; a partially done superset keeps the row disabled.
- **An exercise with zero sets** (a freestyle exercise before its first set): `finished` is false, so
  the row is disabled.
- **The editor and List/Compact**: the row is absent, as decided.
- **Reload**: the fold is gone and the sets are back; the row is enabled again because the sets are
  still ticked.
- **RTL**: the summary is ordinary flow layout; the card swipe already mirrors (`nextSide`), and the
  row's row layout uses logical properties as the other `lrow`s do.

## Tests

New `views/Workout.finish-exercise.test.jsx` (happy-dom, the same harness as
`Workout.swipe.test.jsx`):

- The row is disabled while any set is unticked (including a warm-up), with the `Tick every set first`
  subtitle; it is enabled once every set is ticked.
- Pressing it leaves `entries[].sets`, the done count and `S.active` otherwise unchanged, and replaces
  the card with the summary: the exercise name and `{n} sets`.
- The row toggles to `Show the sets`; tapping the row or summary unfolds, and the sets render again.
- Leaving the workout screen and mounting it again with the same workout id keeps the fold; a reload
  starts unfolded.
- A superset folds as one unit and its summary has one line per member.
- The row is absent in the editor and in List/Compact.
- Accessibility: the row has an accessible name; the summary is a button with `aria-expanded` and the
  `Show the sets` title; the tap target keeps the 46 px height while disabled.

## Where the logic lives

- `frontend/src/views/Workout.jsx`: the module-level folded map, `setFolded`, `unitReady`,
  `foldCurrentUnit`, the summary helper shared with the List branch, the row in `wk-end`, and the fold
  condition in the cards/focus branch.
- `frontend/src/views/Workout.finish-exercise.test.jsx`: the tests above.
- `frontend/src/index.css`: only if a disabled-state tweak turns out to be needed; `.lrow:disabled`
  and `.wk-end-row` already cover the row.
- No `S`, no API, no sync, no new module.

## Open questions

Resolved in the design interview; recorded here so the spec is self-contained.

1. **Data on press:** none — fold only. (Auto-ticking was rejected: it can log sets that were not
   done.)
2. **Layouts:** Cards and Focus, row in the bottom block. (List/Compact already fold finished
   exercises through `collapseCompleted`.)
3. **Partial exercise:** the row is disabled until every set is ticked. This is what makes the title
   honest; the way out early is a swipe or Next, as today.
4. **Persistence:** a module-level UI map per workout id, so leaving and returning keeps the fold. A profile or session field would put transient UI state into the synced object, against the roadmap's "no new `S` field unless derivable" rule.
5. **Label:** `Collapse sets` (RU «Свернуть подходы») and `Show the sets` for the reverse action. "Finish exercise" was rejected: the action is reversible, so it must not read as a one-way completion.
