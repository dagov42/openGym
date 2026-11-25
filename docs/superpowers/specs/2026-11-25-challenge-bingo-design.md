# Challenge bingo: a bonus card after two completed quests

Status: **Agreed**, ready for implementation
Date: 2026-11-25
Part of: [Challenge system plan](2026-11-16-feature-plan-index.md), stage 2
Depends on: [stage 0 medals](2026-11-25-challenge-tier-medals-design.md), [stage 1 quests](2026-11-25-challenge-quests-design.md)

## Why

Three challenge rows can feel like a checklist. A small bingo card gives the month a second layer
that rewards exploration without turning the app into a points game or a second source of truth.

Bingo is deliberately **not** a medal. The monthly medal stays bronze/silver/gold for one, two and
three completed quests. Bingo is a cosmetic bonus, unlocked only after the month already has two
completed quests, so it cannot distract a new user or make the medal ambiguous.

## Goals

- A 3×3 bingo card of small, measurable actions from the existing workout history.
- Every cell is derived, so switching devices or editing a workout does not create server state.
- Completing a row, column or diagonal gives a small “spark”; a full card gives a brighter spark.
- The bonus never changes the bronze/silver/gold medal.
- The card is hidden by default until it unlocks and folds with the rest of the challenge card.

## Non-goals

- No points, coins, shop, loot boxes or paid rewards.
- No teams, public leaderboard or sharing.
- No new `S` field and no API change. There is no separate hide switch: hiding or folding the
  challenge card hides the bonus with it.
- No nutrition, sleep, water or step cells; the app cannot read those reliably.
- No hidden fourth quest in this stage. Bingo is the bonus layer.

## Unlock rule

`bingoOn(S, key)` is true when both of the following hold:

1. monthly challenges are on;
2. the month has a stored challenge object with at least two distinct completed ids.

The card appears at the bottom of the Home challenge card after the two completed quests. Before
that it is absent, not greyed. Folding the main challenge card hides the grid with the rows; the
grid has no separate persistence switch.

## The grid

The grid is fixed for every month. Cells are not random because deterministic output is easier to
explain, sync and test.

| Cell | Copy | Completed when |
|---|---|---|
| `week3` | **Three in a week** | one calendar week has at least three workouts |
| `cardio` | **One cardio** | at least one cardio session |
| `new` | **New move** | at least one exercise never done before |
| `weigh` | **Log weight** | at least one weigh-in |
| `pr` | **New PR** | at least one PR |
| `morning` | **Morning start** | at least one workout before 09:00 |
| `weekend` | **Weekend set** | at least one Saturday or Sunday workout |
| `sets10` | **Ten sets** | at least ten completed working sets |
| `variety5` | **Five moves** | at least five distinct exercises |

All thresholds are intentionally small. The bingo is about noticing the month, not about a second
training target.

```text
┌─────────────┬─────────────┬─────────────┐
│ Three in a  │ One cardio  │ New move    │
│ week        │             │             │
├─────────────┼─────────────┼─────────────┤
│ Log weight  │ New PR      │ Morning     │
├─────────────┼─────────────┼─────────────┤
│ Weekend set │ Ten sets    │ Five moves  │
└─────────────┴─────────────┴─────────────┘
```

A cell is done when its fact is at least one, except `week3` (3), `sets10` (10) and `variety5` (5).

## Progress and rewards

`bingoProgress(S, key)` returns:

```js
{
  cells: [{ id, title, done }],
  lines: 0,        // completed rows, columns and diagonals, 0..8
  full: false,     // all nine cells
  sparks: 0        // 0, 1 (one line), 2 (two or more lines), 3 (full card)
}
```

- first line: a small **Spark** on the month;
- second line: a **Bright spark**;
- full card: a **Constellation** mark.

Spark is a visual marker in the trophy shelf and in the month's aria-label. It does not alter the
bronze/silver/gold medal, the shelf tier or the widget's challenge line.

The bonus is derived, not stored. Deleting a workout can remove a cell and a line; this is
acceptable because it is a cosmetic bonus. A future stage may store a “once earned” mark if the
product needs it, but that would add a field and is out of scope here.

## Data

Stage 1 already adds `morningWorkouts`, `weekendWorkouts`, `variety`, `workSets` and
`cardioSessions` to `monthFacts`. Stage 2 adds one fact:

| Fact | Definition |
|---|---|
| `maxWeekWorkouts` | the largest number of workouts in any counted week of the month |

`weeksOfMonth` already gives the counted weeks. `maxWeekWorkouts` is the maximum of the number of
workouts whose local day belongs to that week. It is derived, like the other facts.

No new storage. `bingoProgress` reads `factsFor(S, [key])[key]` and the stored month only to know
the done count.

## UI

### Home

Below the three challenge rows, only when unlocked:

```text
Бонус: бинго месяца                  2 линии · Искра
[ 3 в неделю ] [ кардио ] [ новое ]
[  вес    ] [  PR    ] [ утро  ]
[ выходные ] [ 10 подходов ] [ 5 упражнений ]
```

- The card is a normal `Section` row that expands to the grid, not a new page.
- On a narrow phone the grid is 3×3 with 8 px gaps and a short label in each cell.
- A done cell gets the existing green check treatment, not a new colour.
- The header says how many lines are complete and the spark name.
- The card has no separate ×; folding the challenge card folds the bonus too.
- A screen reader reads the whole grid as a list of nine cells with done/not done, then a summary
  “2 lines, Bright spark”.

### Trophy shelf

A month with a spark shows a small `sparkles` icon next to its medal. A full card uses a crown-like
spark, but the medal stays silver/gold/whatever the monthly tier says. The accessible label adds
“Spark” or “Constellation”.

### Widget

No widget change in this stage. The widget keeps showing the medal tier and `1 / 3`, `2 / 3`,
`3 / 3`. A bonus on a widget would compete for the one line it has.

## Copy

| Key | Russian |
|---|---|
| `Month bingo` | «Бинго месяца» |
| `Bonus` | «Бонус» |
| `Three in a week` | «Три в неделю» |
| `One cardio` | «Одно кардио» |
| `New move` | «Новое движение» |
| `Log weight` | «Отметка веса» |
| `New PR` | «Новый рекорд» |
| `Morning start` | «Утренний старт» |
| `Weekend set` | «Выходные» |
| `Ten sets` | «Десять подходов» |
| `Five moves` | «Пять упражнений» |
| `{0} lines` | «{0} линии» |
| `Spark` | «Искра» |
| `Bright spark` | «Яркая искра» |
| `Constellation` | «Созвездие» |

Use the same Russian plural helper as `tn()` for line counts. No shaming copy.

## Tests

- `bingoProgress` returns zero lines for an empty month and ten cells done for a full month.
- `week3` counts a week with exactly three workouts; two does not count.
- `cardio`, `new`, `weigh`, `pr`, `morning`, `weekend` toggle from their facts.
- `sets10` ignores warm-ups and unticked sets.
- `variety5` counts distinct exercise ids.
- `bingoOn` is false with zero or one completed challenge, true with two.
- Folding the main challenge card hides the bonus without writing a new profile field.
- The medal tier and shelf `1 / 3` remain unchanged with a full bingo card.
- A month without bingo renders no empty grid.
- Screen-reader summary has the same line count as the visual.
- Locale checker and pt-BR fingerprint pass; full suite and CI pass.

## Acceptance

- Bingo appears only after two completed challenges.
- It is clearly labelled “Bonus”, never “Medal” or “Gold”.
- Completing a line gives a spark and changes no challenge pick, no medal and no sync document.
- The card remains readable at 320 px and with large text.
- No new server calls.

## Risks

- **Clutter:** keep it collapsed by default and below the three quests; do not add it to Stats
  until the user opens the month.
- **Derived undo:** deleting a workout can remove a spark. That is honest and acceptable for a
  cosmetic layer; if it becomes confusing, a later migration can store the earned mark.
- **Two systems:** users may think bingo is required for gold. The “Bonus” label, the copy and the
  tests that leave the medal unchanged are the guard.

## Implementation order

1. Add `maxWeekWorkouts` to `monthFacts` with tests.
2. Add `lib/challenge-bingo.js` with cells, progress and spark names.
3. Add the Home bonus section and its hide action.
4. Add the shelf spark and aria label.
5. Add locale keys and the pt-BR fingerprint.
6. Run focused tests, the full suite and CI.
