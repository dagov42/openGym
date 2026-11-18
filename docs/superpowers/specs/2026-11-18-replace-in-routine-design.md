# Replace an exercise in the routine from a session swap

Status: agreed 2026-11-18, not implemented. The lifter's calls stand: the button replaces both today's
session and the routine's slot, the routine is not given an extra backup and there is no undo, and
nothing in history or in a saved workout being edited is touched.

## Why

A session's **Swap exercise** changes one occurrence in today's workout only (`sheets.jsx`,
`swapActiveWorkoutExercise`): the routine keeps the exercise it was built from, so the same swap has to
be made again next week. The routine editor already has its own **Replace exercise** (#110), seeded
with the slot's plan, but reaching it means leaving the workout, opening Plan and finding the routine.

A running session knows which routine slot it was built from: the entry keeps `rid`, and
`routineSlotIndex` finds its position in that routine, twins and combined days included. So the swap's
config sheet can offer both outcomes — this workout, or this workout and the routine — without a second
picker or a second sheet.

## Goals

1. In the swap's config sheet, when the exercise sits in a routine slot, a secondary **Replace in
   routine** button under **Use in this workout**.
2. It does both: swaps today's exercise through the existing path (the confirm when sets are logged, the
   insertion after logged sets, the rest re-pointing, the superset group handling), then replaces the
   routine slot's exercise with the same config.
3. For a planned exercise the sheet opens on the slot's replacement config
   (`replaceSlotExercise(slot, newId, S, rid)`), so sets, reps, weight, rule, rest, note and warm-ups
   carry over to the new exercise; the routine fields reflect the slot's routine.
4. The slot keeps its position, its superset group and the group's name, rest and circuit flags; no
   other slot of the routine changes.
5. A toast names the new exercise and the routine, using the existing string
   `'{0} is in {1} from next time.'`.
6. No new `S` field, no API call: the routine is already part of the synced profile and its change is
   an ordinary routine edit.

## Non-goals

- Touching history: no past workout in `S.workouts`, and no saved workout being edited, ever changes.
  The button is absent in the editor (`editingWorkoutId`) and in a backfill session.
- Replacing in the routine without also swapping today.
- Adding the old exercise to the slot's planned backups (`subs`) automatically; the slot's existing
  backups are carried and the new exercise is removed from them (what the routine editor's Replace
  does).
- An Undo for the routine change. The toast confirms it; the routine editor has no undo either.
- A separate confirmation sheet: the button is the explicit choice, and a logged-set swap already
  confirms before it applies.
- A **Replace in routine** path from a freestyle session (no `rid`), from the picker's quick `+`
  (which skips the sheet), or after a today-only swap in the same session (the entry no longer
  matches the slot).
- Editing locale packs in the feature PR: the new label ships in English only, per the index's
  "Strings and locales" rule; the Russian pack gets «Заменить в программе» later.

## Decisions

- **Both, not either.** The button is an alternative confirm in the same sheet, not a second mode.
- **The slot's plan wins, and the sheet shows it.** Seeding with `replaceSlotExercise` is what keeps
  a 5×5 slot a 5×5 slot. A consequence, accepted: today's planned swap in the same sheet starts from
  the slot's plan instead of the new exercise's last/default config. A freestyle swap is unchanged.
- **Toast only.** No confirmation sheet, no toast action, no undo.
- **Nothing old is rewritten.** "Old workouts" means history and the saved-workout editor; the
  current live session and its routine slot are the only two objects the button writes.
- **The label is `Replace in routine`.** The app's English word for a routine is "routine"; the
  Russian pack calls it «программа», which is where the lifter's wording comes from.

## Implementation

### A pure slot writer

New in `lib/routines.js`:

```js
// The slot with a different exercise and a confirmed config: the identity and the superset group
// come from the slot, everything the sheet saved comes from cfg.
export function replaceSlotWithConfig(slot, id, cfg) {
  const group = slot && slot.sg
    ? { sg: slot.sg, ...(slot.sgName ? { sgName: slot.sgName } : {}),
        ...(slot.sgRest != null ? { sgRest: slot.sgRest } : {}),
        ...(slot.sgCircuit ? { sgCircuit: slot.sgCircuit } : {}) }
    : {}
  return { id, ...group, ...cfg }
}
```

`cfg` is the full, normalized object the config sheet already builds (`sheets.jsx`, `save`): keys it
omits were cleared by the user and must not be resurrected from the old slot, which is why this is a
fresh object rather than a spread over the slot. The superset group is the one part of the old slot
that must survive; `replaceSlotExercise` carries it as well, but the routine editor's current commit
keeps only `sg` and silently loses `sgName`/`sgRest`/`sgCircuit` when an exercise inside a superset is
replaced.

### The sheet

`ExConfig` (and `exConfigSheet`'s `opts`) gains an optional `onReplaceInRoutine`, a function that
receives the stored config. When present it renders, under the primary button and above the existing
Remove:

```jsx
<div style={{ height: 8 }} />
<Button icon="swap" onClick={() => save(out => { close(); onReplaceInRoutine(storedOf(out)) })}>
  {t('Replace in routine')}
</Button>
```

`save` already refuses to run while the progression step is invalid, and still builds the same
normalized `out` and runs it through `storedOf`, so both buttons save the same shape.

### The swap flow

`swapActiveWorkoutExercise(index, { askCoach })` (sheets.jsx):

- Read the live entry and its routine. Eligible when `!active.editingWorkoutId && !active.backfill`,
  the entry has `rid`, the routine exists and `routineSlotIndex(routine, active.entries, index) >= 0`.
- Seed: a planned backup keeps `asBackup(ex)` (it is already the slot's plan for that backup);
  otherwise an eligible entry is seeded with `replaceSlotExercise(slot, ex.id, S(), entry.rid)`, and
  the sheet is given `routine` so its progression fields speak the routine's rule. A freestyle entry
  keeps today's seed (`asBackup(ex)`, else the picker's default).
- Pass `opts.onReplaceInRoutine` only when eligible: `cfg => { picker.close(); commitActiveSwap(index,
  ex, cfg, { replaceInRoutine: true }) }`. The primary button keeps `swapTo`.

### Committing both

`commitActiveSwap(index, ex, cfg, opts = {})` computes, inside the same `update` and **before**
`swapActiveExercise` runs:

- `activeId`, `entryId` (the old id) and `at = routineSlotIndex(target, state.active.entries, index)`
  on the live state, plus the old slot's id.

After `swapActiveExercise` returns a successful swap, and only when `opts.replaceInRoutine` is set,
the same callback writes:

```js
target.ex[at] = replaceSlotWithConfig(oldSlot, ex.id, cfg)
```

The guards fail closed: the active workout's id still matches, the entry at `index` still has the old
id before the swap, the routine still exists, the slot at `at` still holds the old exercise. If any
guard fails, today's swap still lands, the routine is left alone and no toast claims otherwise.
Logged sets do not change `at`: the insertion shifts `state.active.entries`, not `routine.ex`.

The toast `'{0} is in {1} from next time.'` (new exercise name, routine name) is shown only after both
writes happened. The swap's own confirm for logged sets is unchanged and runs first; cancelling it
writes nothing to the routine.

### The routine editor

`views/RoutineEdit.jsx`'s `replace()` commits the new slot through `replaceSlotWithConfig`, so a
replacement inside a superset keeps the group's name, rest and circuit flags. No other behaviour of
that flow changes; it is the same helper the session uses.

## Edge cases

- **Combined day:** only the routine identified by the entry's `rid` changes; the other routine's slots
  are untouched.
- **The same exercise twice in one routine:** `routineSlotIndex` matches by position among twins, so
  the right slot changes and the other stays.
- **A superset slot:** the slot stays in the group with `sg`/`sgName`/`sgRest`/`sgCircuit`; a logged
  superset member's group-disposition choice still decides where today's replacement sits, while the
  routine slot keeps its place in the group.
- **The routine or slot changed while the sheet is open** (sync, another tab, a rename or reorder):
  the apply-time guard fails closed — today's swap applies, the routine is not written, no toast.
- **The slot was deleted:** same fail-closed path; the entry still has `rid`, but no slot at `at`.
- **A planned backup picked as the replacement:** `asBackup` supplies its own plan; the routine slot
  gets the same config, and `replaceSlotExercise` has already dropped the new id from `subs`.
- **Unknown/unresolvable exercise in the slot:** `routineSlotIndex` matches on ids only; a slot whose
  id is not the entry's is never treated as a match.
- **The entry is gone by the time the swap commits** (removed in another tab): `swapActiveExercise`
  reports no swap, the routine is not written, no toast.
- **RTL and layout:** one more ordinary button under the primary; no new layout rules.

## Tests

- `lib/routines.replace.test.js` (extend): `replaceSlotWithConfig` changes the id, keeps `sg`,
  `sgName`, `sgRest` and `sgCircuit`, lets `cfg` override the plan, and does not resurrect keys the
  user cleared (a cleared note stays absent).
- `views/RoutineEdit` coverage: replacing an exercise inside a superset keeps the group's name, rest
  and circuit flags.
- `sheets.swap.test.jsx` (extend or add `sheets.swap-routine.test.jsx`):
  - the button is present for a planned exercise and absent for freestyle, the editor and a backfill;
  - a planned swap's sheet opens on the slot's replacement config (`replaceSlotExercise`), a
    freestyle swap keeps the old seed;
  - pressing it changes both `S.active.entries[index].id` and the routine slot's `id`, with the
    slot's sets/reps/weight/rule (and the edited values when the sheet was edited);
  - cancelling the logged-sets confirmation leaves the routine untouched;
  - a slot changed before the commit leaves the routine untouched while today's swap still lands;
  - the toast names the new exercise and the routine;
  - a slot in a superset keeps its group and group metadata.
- No locale test is extended: the new label ships in English and falls back for other packs until the
  translation PR, per the index's rule.

## Where the logic lives

- `frontend/src/lib/routines.js`: `replaceSlotWithConfig`, tests beside it.
- `frontend/src/sheets.jsx`: the `ExConfig` secondary button, `opts.onReplaceInRoutine`,
  `swapActiveWorkoutExercise`'s eligibility, seed and callback, and `commitActiveSwap`'s routine write.
- `frontend/src/views/RoutineEdit.jsx`: `replace()` uses the helper.
- `frontend/src/sheets.swap.test.jsx` (and the routine replace tests): the coverage above.
- No `S` field, no API, no sync change beyond the routine edit itself.

## Open questions

Resolved in the design interview; recorded here so the spec is self-contained.

1. **Scope:** today and the routine, in one action. A routine-only button was rejected as a second,
   confusing confirm in a sheet opened to swap.
2. **Numbers:** the slot's plan is preserved, and the sheet is seeded with it. "Whatever is in the
   sheet" was rejected because it can silently rewrite the plan; a hybrid was rejected because the
   visible numbers would not match what the routine gets.
3. **Feedback:** a toast naming the routine, no confirmation sheet, no undo.
4. **Old exercise as a backup:** no, matching the routine editor's Replace.
5. **Old workouts:** history and the saved-workout editor are never written; the button is absent
   there.
