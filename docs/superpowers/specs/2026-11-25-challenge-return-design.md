# Return mode: a softer challenge month after a break

Status: **Agreed**, ready for implementation
Date: 2026-11-25
Part of: [Challenge system plan](2026-11-16-feature-plan-index.md), stage 3
Depends on: [stage 0 medals](2026-11-25-challenge-tier-medals-design.md), [stage 1 quests](2026-11-25-challenge-quests-design.md)

## Why

Someone who has not trained for two weeks should not open the app to “14 workouts this month” and
a target calculated from a stronger previous month. The app already has the data to notice the gap.
Return mode uses it to offer three gentle goals for the first month back, without a separate
onboarding flow and without storing a new “returning” flag.

The medal rule does not change: one, two or three completed return goals give bronze, silver or
gold. Return goals are shorter, not a different reward system.

## Goals

- Detect a real break from the workout history, not from a setting or a manual switch.
- Offer three easier goals for the current month when the first app open after the break creates
  the month's picks.
- Keep the picks fixed once created, even after the first workout, so the goals cannot disappear.
- Use the normal Home card, the normal bronze/silver/gold result, the normal trophy shelf.
- No shame copy and no “you lost your streak” message.

## Non-goals

- No pause mode, holiday mode or injury mode.
- No change to the workout reminder, streak, rotation or progression.
- No new `S` field. The return state is derived and the picked goal ids are stored in the existing
  `S.challenges` shape.
- No return mode for a brand-new profile with no workouts.

## Trigger

A pure helper decides before the month's picks are stored:

```js
returningOn(S, today) // true when the last workout is 14 or more local days before today
```

Rules:

1. The profile must have at least one workout ever.
2. The last completed workout's local `workoutDay` must be 14 or more days before `today`.
3. The current month must have no stored `picked` list yet.
4. Challenges must be on.
5. A stored return month is not re-evaluated; its picks stay even if the gap closes.

A workout today makes `returningOn` false. This is intentional: a person who trains before opening
the app does not need a special card, and the normal month is already a return.

The 14-day boundary is counted on local calendar days, the same `workoutDay` rule used by the
monthly challenges. A workout at 23:30 belongs to its local day.

## Return goals

The return set has three goals with fixed low targets. They are separate ids so a normal month
never picks them by rotation.

| id | Title | Target | Progress |
|---|---|---|---|
| `return-workouts` | **Back on the floor**: 3 workouts | 3 | `facts.workouts` |
| `return-weeks` | **Two weeks in rhythm** | 2 | `facts.weeksTrained` |
| `return-sets` | **Ten working sets** | 10 | `facts.workSets` |

The targets do not use `stretch()`; a return month is deliberately fixed. `workSets` is the stage 1
fact and excludes warm-ups and unticked sets. If stage 1 is not shipped yet, the return spec may
use the existing `volumeKg` or a simpler `return-workouts`/`return-weeks`/`return-newex` set,
but the implementation should ship stage 1 first.

The three ids live in a separate `RETURN_CHALLENGES` array. `challengeOf` includes them so
`progressOf` and `shelfOf` work, but `pickChallenges` excludes them from the normal pool.

## Selection

`monthChallenges(S, key)` currently returns stored picks or `pickChallenges(S, key)`. Change it to:

```js
const stored = storedMonth(S, key)
if (stored?.picked.length) return { ..., stored: true }
const picks = returningOn(S, today) ? pickReturn() : pickChallenges(S, key)
return { key, picked: picks, done: stored?.done || [], stored: false, mode: picks[0]?.id.startsWith('return-') ? 'return' : 'normal' }
```

`today` must be injectable for tests, like `now` on the components. `mode` is derived and can be
used by the card for the eyebrow; it is not written to `S`.

The existing effect in `ChallengesCard` saves the picks on first render, before the user can train.
That keeps the month stable. The same effect already handles the late completion of a previous
month; return mode does not bypass it.

If the current month already has a stored normal month, a late gap does not replace it. This
protects a user who opened the app on the 1st and then had an unrelated 14-day break during the
month.

## UI

The card is the same `ChallengesCard`. Only the eyebrow and the intro change:

```text
Возвращение · Ноябрь 2026           0 из 3
Сначала ритм, потом рекорды.
```

Rows use the return titles and counts. The medal chip and the party behave exactly as stage 0.

After all three are done, the gold line is the normal praise line. No special “welcome back”
confetti is needed; the bronze/silver/gold result is the reward.

The card's hide action and folded state stay. If the user hides the card, the month is not
re-offered with a different mode.

## Copy

| Key | Russian |
|---|---|
| `Return` | «Возвращение» |
| `First rhythm, then records.` | «Сначала ритм, потом рекорды.» |
| `Back on the floor` | «Снова в зале» |
| `Two weeks in rhythm` | «Две недели в ритме» |
| `Ten working sets` | «Десять рабочих подходов» |
| `3 workouts` | «3 тренировки» |
| `2 weeks` | «2 недели» |
| `10 sets` | «10 подходов» |

No “you were away”, “you lost” or “start over” language. The card says what to do next.

## Tests

- `returningOn` is false with no workouts, false at 13 days, true at exactly 14 and at 30.
- It uses local days across a month boundary and across a timezone offset.
- A profile that trains today is not in return mode.
- A stored normal month is never replaced by return picks.
- A stored return month stays after the first workout.
- `pickReturn` returns the three fixed ids and targets; `pickChallenges` never returns them.
- `progressOf` reads `workouts`, `weeksTrained` and `workSets` for the return ids.
- The Home eyebrow and intro are the return copy; the medal tier still follows stage 0.
- The previous month's late-completion path still works during a return month.
- No new `S` field is written; a return month is a normal stored `picked`/`done` object.
- Full suite and CI pass.

## Acceptance

- After 14 days without a workout, the first monthly card shows three gentle return goals once.
- The goals stay after the first workout and cannot be swapped by a re-render.
- The bronze/silver/gold result and the shelf use the same rules as any other month.
- A fresh profile sees the normal starter challenges, not return mode.
- A normal active month is never converted to return mode.

## Risks

- **Gap detection feels intrusive:** it only changes the three goals, not the rest of the app, and
  only when the month has no stored picks. No banner and no extra modal.
- **Too easy for an advanced lifter:** the return month lasts one month; the next month uses the
  normal level-based targets again.
- **Stage coupling:** stage 1 must land first for `workSets`. If the phases are split, use the
  existing `workouts`, `weeksTrained` and `newEx` facts and replace `return-sets` with a small
  `return-newex` goal; keep the same three-step medal.

## Implementation order

1. Add `returningOn` and `pickReturn` with tests, keeping `challengeOf` aware of return ids.
2. Change `monthChallenges` to select return picks only when no stored picks exist.
3. Change the Home eyebrow and intro for the return mode.
4. Add locale keys and the pt-BR fingerprint.
5. Run the focused tests, the full suite and CI.
