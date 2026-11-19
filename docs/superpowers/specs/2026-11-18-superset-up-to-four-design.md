# Supersets of up to four exercises

Status: implemented 2026-11-19. The lifter's calls stand: groups can be built in the live
session, in the routine editor and by the Coach, up to four members; imported and older larger groups
are left alone; circuit groups are not capped; the group header's Unpair dissolves the group, and its
members get their own "Remove from superset". The new labels are translated in all 25 locale packs.

## Why

The model already describes a superset of any length: consecutive entries (session) or routine slots
sharing one `sg`, `supersetUnits` grouping any contiguous run, and `pairAdjacent` merging the runs on
both sides of a newly linked boundary — group with a single exercise, or group with group. `sgName`,
`sgRest` and `sgCircuit` ride on every member (`lib/superset-meta.js`), and circuits are already one
group of any size that runs everywhere: rounds, the rest after a round, the Focus sequence, chips,
print, plan share, imports, the watch and the live surfaces. The round-robin (`supersetFlowStep`) and
the rest rules (`restSecFor`, `transitionRestFor`) are written for a unit, not for a pair.

What limits it today is the interface, not the data:

- In a session the "Make superset with previous/next" actions are offered only while the current
  exercise is **not** in a superset (`!isSuperset`), and a group's members get no pair actions at all.
  Growing a group is possible only by selecting the *neighbouring single exercise* and pairing it
  toward the group — undiscoverable, and impossible from the group itself.
- Nothing caps the size: the routine editor's link chain, a group-to-group merge, an import or the
  Coach can build five or more. (A test already merges two pairs into four.)
- The group header's **Unpair** removes only the current member, so on a group of three it leaves a
  two-member group and an exercise nobody chose to detach.

## Goals

1. A live session can grow a superset to three and four members from the group itself.
2. The routine editor's link and the Coach's superset action may also grow a group, and stop at four.
3. Four is a hard cap for creating and growing groups in the app. Asking for a fifth shows a toast;
   nothing is hidden, disabled or silently ignored.
4. The group header's **Unpair** dissolves the whole group; a member's own menu offers **Remove from
   superset** for shrinking a group one member at a time.
5. Circuits (`sgCircuit`) and groups that arrived from an import, a plan bundle or an older profile
   are preserved as they are; the cap governs what the app itself creates.
6. No new `S` field, no data migration, no sync change: the `sg` model stays as it is.

## Non-goals

- Capping or rewriting circuit groups, which have their own type and can hold any number of
  exercises.
- Splitting an imported or existing five-member group, or refusing to run it. It keeps working.
- A new group editor sheet or a per-member checkbox list; the existing menu, header buttons and link
  toggle are enough.
- Changing rest, round-robin, skip-completed, the Focus sequence, chips, print or share logic: they
  are already unit-based; this feature adds tests that lock three- and four-member units.
- Per-locale wording beyond the four new labels; the labels themselves are in every pack.

## Decisions

- **All creation places.** Session, routine editor and Coach obey the same `MAX_SUPERSET = 4`.
- **Grow from the group.** Each member's ⋯ menu carries "Add previous exercise to this superset" and
  "Add next exercise to this superset", which merge the group with the adjacent unit. With Settings →
  Workout controls' "Make superset" buttons on (`wc.pairButtons`), the same two actions appear as
  buttons in the group's header, where the lone exercise already shows its pair buttons.
- **The menu is always the way in.** The header buttons are the existing opt-in convenience, not a
  new setting.
- **Unpair means the group.** The header button dissolves every member. Shrinking a group of four to
  two, or three to two, is the member menu's "Remove from superset", which detaches that one entry.
  For a group of two both end states are the same as today.
- **The cap is a toast.** The action stays visible; pressing it at the cap shows
  `A superset holds up to {0} exercises`. No disabled controls, no disappearing options.
- **Circuits are out.** A unit carrying `sgCircuit` offers no merge actions and no Unpair; the
  routine type owns that group. The routine editor hides the link toggle on a circuit row (today it
  can split the circuit).
- **Imports are preserved.** A five-member group from Hevy, a CSV, a plan bundle or another client is
  shown and run as it is. The app never grows it further.

## Implementation

### The cap and its helpers

In `lib/history.js`, beside `pairAdjacent` and `unpairSuperset`:

```js
export const MAX_SUPERSET = 4

// The size the merged run would have: the contiguous `sg` runs around each boundary entry, unioned.
// `canPairSuperset` also refuses a boundary with a circuit marker; `pairAdjacent` itself only caps
// the size, so imports and older groups are never rewritten.
export function mergedSupersetSize(items, first, second) { ... }

export function canPairSuperset(items, first, second, max = MAX_SUPERSET) {
  return mergedSupersetSize(items, first, second) <= max
}

// A new array with `sg` taken off every member of the contiguous run around `idx`.
export function dissolveSuperset(items, idx) { ... }
```

`pairAdjacent` gains the same cap: when the merged run would exceed `MAX_SUPERSET`, it throws a
`RangeError` instead of returning a five-member group. Every caller checks `canPairSuperset` first and
turns a refusal into the toast, so the throw is a contract for future callers, not a user-facing path.
Existing calls (four or fewer) are unchanged.

Circuits are detected through `circuitOf` (already imported where the session and the editor decide
what to show); `pairAdjacent` itself does not need to know about them because no caller passes a
circuit boundary.

### The live session

`views/Workout.jsx`:

- `pairAt(first, second)` checks `canPairSuperset` on the live entries; when it refuses, it toasts
  `t('A superset holds up to {0} exercises', MAX_SUPERSET)` and writes nothing.
- `dissolveAt(idx)` replaces the header's per-member `unpairSuperset` call; `unpairAt(idx)` stays for
  "Remove from superset".
- The current unit's pair actions are computed from its **boundary**, not from `cur`: previous is
  `pairAt(unit[0] - 1, unit[0])`, next is `pairAt(unit.at(-1), unit.at(-1) + 1)`. They are no longer
  gated by `!isSuperset`; they are null only at the list ends and for a circuit unit.
- `blockProps(idx)` carries `inGroup`, `onPairPrev`, `onPairNext` and `onUnpairSelf`. For a member of
  the current unit they address the unit's boundaries; for a lone exercise they keep today's meaning
  (`cur - 1`/`cur`, `cur`/`cur + 1`). In List mode each unit's members get that unit's boundaries.
- `ExerciseBlock` shows the member labels when `inGroup`: `Add previous exercise to this superset`,
  `Add next exercise to this superset`, and a `Remove from superset` item in the same "Order and
  supersets" section; a lone exercise keeps `Make superset with previous/next`.
- The group header (the `.ss-hd` in Cards, the `wl-hd` unit header in List) shows the two merge
  buttons when `wc.pairButtons` is on, next to the Unpair that now dissolves the group. They wrap the
  way the lone exercise's header buttons already do.
- `FocusView` receives `inGroup` and the same pair actions; its inline superset header's Unpair
  dissolves the group and its menu gains the member labels and "Remove from superset". Focus has no
  header pair buttons (the lone exercise never had them there either), so its menu is the way in. Its
  own per-set prev/next stay untouched.
- Swipe previews keep passing the same wiring; a preview is inert, so nothing new can be pressed
  there.
- A unit with `circuitOf(entries, unit)` gets no merge actions and no Unpair buttons.

Rendering, rounds, rest and navigation need no change: `supersetUnits`, `supersetFlowStep`,
`nextUnfinishedUnit`, `restSecFor` and the Focus sequence already walk the whole unit. `ssTitle` and
the chip row are unit-based and read the same for three or four members.

### The routine editor

`views/RoutineEdit.jsx`:

- `toggleLink(i)` stays an edge toggle (link the row to the one above, or split at that edge). When
  linking would exceed `MAX_SUPERSET`, it toasts and writes nothing; it uses the same message and
  `canPairSuperset` with the routine's slots.
- The link button is not rendered for a row whose unit is a circuit (`circuitOf(r.ex, unit)`) — its
  cell keeps the existing empty placeholder, so the rail does not shift.
- The A1/A2/A3/A4 badges, the group label (name, rest, circuit line), the group sheet, moving a member
  inside or out (`moveRoutineEntry`) and the swipe-to-remove already work for any length and are
  covered by the new tests rather than changed.

### The Coach

`lib/coach.js`'s `superset` action becomes group-aware:

- The anchor's unit is found first; the partner is moved next to the anchor's group boundary (after
  its last member when the link is "after"), and the partner's group (or itself) joins the anchor's
  `sg`, instead of tagging only the two rows with a new id. The merge goes through
  `canPairSuperset` before it writes.
- When the merged run would exceed `MAX_SUPERSET`, the action fails like the missing-partner case
  (an invalid adjustment), and the routine is left untouched.
- Unlinking (`after.link` false) still detaches the anchor row, as today; the group's remaining
  members are tidied by `cleanupSg`.

### Preserved data

- Imports (`lib/import-hevy.js`, `lib/import-apps.js`, `lib/import-csv.js`) and plan bundles
  (`lib/plan-share.js`) write `sg` directly and are not capped. A group of five imports, prints,
  runs and syncs as before; the app simply will not grow it.
- `sgName`, `sgRest` and `sgCircuit` keep riding on every member (`superset-meta.js`), so a new
  member takes the group's name and rest, and the first member with a value still speaks for all.

## Edge cases

- **A group of four next to an exercise:** the merge action is visible; pressing it toasts and changes
  nothing. The same applies in the routine editor's link and to the Coach.
- **Two groups meeting:** merging a three and a two is refused (five); a three and a one is allowed
  (four). Both sides' group names and rests merge as `syncSupersetMeta` already does; the first value
  wins. The "Add previous/next exercise" label stays short even when the neighbour is itself a
  group.
- **The cap after a sync or an import:** a five-member group may exist underneath the user; Unpair
  dissolves it, "Remove from superset" shrinks it, but no merge can add to it.
- **A circuit row in the routine editor:** no link toggle; the group label and the type sheet own it.
- **A circuit unit in a session:** no merge and no Unpair; today's circuit player and rounds continue.
- **Head/edge of the list:** the previous action is absent at the first unit, the next at the last.
- **A member removed from a three:** the other two stay grouped (`cleanupSg` only dissolves a group
  left with one member), and the header's Unpair would now dissolve those two.
- **A timed hold or a running work timer:** pairing is a structural change; it does not stop the
  timer (the existing pair path does not), and the held row keeps its owner through the entry moves.
- **The coach action while a session is running:** it edits routines, not the live session; nothing
  observable changes on the workout screen until the next session.
- **RTL and narrow screens:** the header buttons wrap like the existing pair buttons; the menu items
  are text and need no new layout.

## Tests

- `lib/history.test.js` (extend): `canPairSuperset` allows 2+2=4 and 3+1=4, refuses 3+2, 4+1 and a
  circuit boundary; `pairAdjacent` throws over the cap; `dissolveSuperset` clears the whole run and
  leaves the neighbours alone; `unpairSuperset` still detaches one member of four.
- `lib/supersetFlow.test.js` (extend): a three- and a four-member unit's round order and the wrap
  (the round end and rest-after-round paths are already unit-based).
- `views/Workout.superset-four.test.jsx` (new): grow 2→3→4 from a member's ⋯ menu; the fifth attempt
  toasts `A superset holds up to 4 exercises` and leaves the entries untouched; the header Unpair
  dissolves all four; "Remove from superset" shrinks 4→3 and the rest stay grouped; a lone neighbour
  still merges into the group; a circuit unit offers neither; the card and the list header show three
  members and the group's name.
- `views/RoutineEdit` (extend `RoutineEdit.move.test.jsx` or a new file): link to four, the fifth
  toasts, a circuit row has no link button, and the A-badges read A1–A4.
- `lib/coach.test.js` (extend): the link action joins a group and refuses a fifth; it does not split
  an existing group when the anchor is already grouped.
- `lib/watch-sync` or `lib/live-activity.test.js` (extend): a three-member group still presents the
  next member in turn and the rest after the round.
- Locale packs: the four new labels are translated in all 25 packs, not left as English fallback.

## Where the logic lives

- `frontend/src/lib/history.js`: `MAX_SUPERSET`, `canPairSuperset`, `dissolveSuperset`, the cap in
  `pairAdjacent`; tests beside it.
- `frontend/src/views/Workout.jsx`: boundary pair actions, `dissolveAt`, `blockProps` additions, the
  group-header buttons, labels and toast.
- `frontend/src/views/FocusView.jsx`: `inGroup`, the pair actions, the menu item and the dissolving
  Unpair.
- `frontend/src/views/RoutineEdit.jsx`: the link cap, the toast and the circuit row.
- `frontend/src/lib/coach.js`: the group-aware, capped link action.
- `frontend/src/views/Workout.superset-four.test.jsx` and `views/RoutineEdit.superset.test.jsx`:
  the session/card/list/focus and editor coverage; `lib/supersetFlow.test.js` locks three- and
  four-member round order.
- `frontend/src/sheets.jsx`: no signature change; the group sheet already names and rests a group of
  any size.
- No `S` field, no API, no sync change.

## Open questions

Resolved in the design interview; recorded here so the spec is self-contained.

1. **Where:** all in-app creation paths (session, routine editor, Coach); four everywhere.
2. **Growing:** each member's menu, plus header buttons when the existing "Make superset" control
   setting is on.
3. **Unpair:** the header dissolves the group; a member's menu detaches that member.
4. **At four:** the action stays visible and a toast explains the limit.
5. **Imports, plan bundles, older profiles, circuits:** preserved as they are; the cap is about what
   the app builds.
