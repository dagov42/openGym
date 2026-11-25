# Challenge quests: themes and more interesting monthly goals

Status: **Agreed**, ready for implementation
Date: 2026-11-25
Part of: [Challenge system plan](2026-11-16-feature-plan-index.md), stage 1
Depends on: [stage 0 medals](2026-11-25-challenge-tier-medals-design.md)

## Why

The current ten challenges are useful but read like database queries: “14 workouts this month”,
“Train every week this month”, “Try 3 exercises you have never done”. They tell the user what to
count, not why it is interesting.

This stage keeps the same local, derived model and makes the month feel like a small themed set:
three short quests with a human title, a one-line reason and a target that still scales from the
profile's own history. No new `S` field, no server call, no third-party data.

## Goals

- Add five new challenges that use facts already in the workout history.
- Give every challenge a short, memorable title and a plain-language secondary line.
- Add a deterministic monthly theme (foundation, drive, endurance, variety, return) that changes
  the card's eyebrow and intro, not the rules.
- Keep the pick stable on every device and for the whole month.
- Keep the bronze/silver/gold result from stage 0 unchanged.

## Non-goals

- Bingo, hidden quests and the return mode. They are stages 2 and 3.
- Nutrition, sleep, water, steps or heart-rate zones: openGym does not record them reliably.
- Public leaderboards, teams, prizes or money.
- New stored profile fields.

## Data additions

All values are computed in `monthFacts` from the month's workouts. They join the existing
`workouts`, `weeks`, `volumeKg`, `prs`, `pullups`, `pushups`, `cardioMin`, `weighDays`, `newEx` and
`groups`.

| Fact | Definition |
|---|---|
| `morningWorkouts` | workouts whose local `start` hour is before 09:00. Missing `start` does not count. |
| `weekendWorkouts` | workouts whose local `workoutDay` is Saturday or Sunday. |
| `variety` | number of distinct exercise ids with at least one completed working set. This is the existing `exDone.size`, exposed as a fact. |
| `workSets` | number of working sets with `doneUnits(s) > 0`, warm-ups excluded. |
| `cardioSessions` | number of distinct workouts with at least one entry where `cardioMinOf(e) > 0`. One long cardio entry counts one session, not one per minute. |

`levelOf(S, key)` averages the same facts over the lookback months. A fact missing from an older
month reads as zero, as the existing facts do.

All five are derived. `S.challenges` still stores only `picked` and `done`.

## Challenge catalogue

Targets use the existing `stretch()` helper. The values below are the initial bounds; the helper
still grows them from the user's usual month.

### Habit

| id | Title | Target | Fits when |
|---|---|---|---|
| `workouts` | **Hold the rhythm**: N workouts this month | `stretch(L.workouts, min 4, max 28)` | always |
| `weeks` | **No empty weeks** | one workout in every counted week | `fresh` or `weekRate < 0.99` |
| `morning` | **The day starts at the gym**: N morning workouts | `stretch(L.morningWorkouts, min 2, max 10)` | `fresh` or `L.morningWorkouts > 0` |
| `weekend` | **Weekend on**: N weekend workouts | `stretch(L.weekendWorkouts, min 2, max 6)` | `fresh` or `L.weekendWorkouts > 0` |

### Effort

| id | Title | Target | Fits when |
|---|---|---|---|
| `volume` | **Build the tonnage**: lift N t | existing `volumeTarget` | `L.volumeKg > 0` |
| `prs` | **Three new highs**: N PRs | `stretch(L.prs, min 2, max 12)` | `L.prs > 0` |
| `pullups` | **The bar is calling**: N pull-ups | existing target | `L.pullups > 0` |
| `pushups` | **No pauses**: N push-ups | existing target | `L.pushups > 0` |
| `cardio` | **Easy cardio**: N minutes | existing target | `L.cardioMin > 0` |
| `workSets` | **Working volume**: N working sets | `stretch(L.workSets, min 20, max 400, step 5)` | `L.workSets > 0` |
| `cardioSessions` | **Four exits**: N cardio sessions | `stretch(L.cardioSessions, min 2, max 12)` | `L.cardioSessions > 0` |

### Explore

| id | Title | Target | Fits when |
|---|---|---|---|
| `newex` | **New ground**: N exercises you have never done | existing target | always |
| `variety` | **Mix it up**: N different exercises | `fresh ? 8 : stretch(L.variety, min 8, max 30)` | always |
| `muscles` | **The whole body** | all six movement groups | `fresh` or fewer than all groups last month |
| `weighins` | **Weight log**: N entries | existing target | `L.weighDays > 0 and < 24` |

Titles are English keys passed to `t()`; Russian copy is below. The existing `challengeTitle`
switch gets the five new ids, and the rest keeps its current text with the new wording from the
table.

### Russian copy

| Key | Russian |
|---|---|
| `Hold the rhythm` | «Держи ритм» |
| `No empty weeks` | «Ни одной пустой недели» |
| `The day starts at the gym` | «Утро начинается в зале» |
| `Weekend on` | «Выходные в деле» |
| `Build the tonnage` | «Собери тоннаж» |
| `Three new highs` | «Три новых максимума» |
| `The bar is calling` | «Турник зовёт» |
| `No pauses` | «Без пауз» |
| `Easy cardio` | «Кардио без спешки» |
| `Working volume` | «Рабочий объём» |
| `Four exits` | «Четыре выхода на кардио» |
| `New ground` | «Новая территория» |
| `Mix it up` | «Разнообразие» |
| `The whole body` | «Всё тело в деле» |
| `Weight log` | «Дневник веса» |

The count/progress line stays numeric and is built by `challengeCount`; the title carries the
story, the count carries the truth.

## Monthly theme

A theme is a cosmetic wrapper. It is selected deterministically from the month key, so every
device shows the same one and a profile with no network still sees it:

```js
const THEMES = ['foundation', 'drive', 'endurance', 'variety', 'return']
const themeOf = key => THEMES[monthIndex(key) % THEMES.length]
```

| id | Russian title | One-line intro |
|---|---|---|
| `foundation` | «Фундамент» | «Три шага, чтобы месяц не рассыпался.» |
| `drive` | «Разгон» | «Чуть больше, чем обычно, но без гонки.» |
| `endurance` | «Выносливость» | «Месяц для сердца и дыхания.» |
| `variety` | «Разнообразие» | «Новые движения и новые группы.» |
| `return` | «Возвращение» | «Сначала ритм, потом рекорды.» |

The Home card eyebrow becomes `theme · month`, for example «Фундамент · Ноябрь 2026». The
heading «Челленджи месяца» and the three rows stay unchanged. `themeOf` is derived and not stored.

The `return` theme is only a title in this stage; the actual return mode arrives in stage 3. While
stage 3 is not shipped, a `return` theme month still uses the normal three challenges.

## Selection and rotation

`pickChallenges` keeps its current rule: one challenge per `kind` where possible, the one at the
month's place in the rotation among challenges that fit. Add the new definitions to `CHALLENGES`
and to `KINDS` as above. No new selection state.

The new pool is large enough that a profile sees a different combination each month, but the
same profile on two devices still picks the same three because the month index and facts are
deterministic.

Targets are stored in `picked` as `{ id, n }` as today. Nothing about the stored format changes.

## UI

- `ChallengeRows`: no new controls. A challenge row uses its existing icon. The title can wrap to
  two lines on a narrow phone; the numeric count stays on the first line.
- Eyebrow: theme + month.
- The old `New month, new challenges.` line becomes the theme's one-line intro during the first
  three days of a month.
- No extra “start” button and no new card. This is the same card, with better words.
- The widget uses `challengeTitle` and `challengeCount`, so the new titles work there automatically.

## Tests

- `morningWorkouts` counts only workouts with a local start before 09:00; missing start is ignored.
- `weekendWorkouts` counts Saturday and Sunday local days, not UTC.
- `variety` counts distinct exercise ids with a completed working set; warm-up-only entries do not
  count.
- `workSets` ignores warm-up rows and sets without `doneUnits`.
- `cardioSessions` counts a workout once even with several cardio entries.
- `levelOf` averages the new facts over the lookback and reads missing months as zero.
- Each new challenge has a target and a fit test; `pickChallenges` never returns duplicates and
  respects one per kind.
- `themeOf` is stable for the same month and rotates across months.
- The Home card shows the theme eyebrow and the new titles in Russian and English.
- The widget copy stays in sync with the card.
- `npm test`, locale checker and CI pass.

## Acceptance

- The month still has exactly three challenges.
- The five new challenges can appear only when their facts exist, except `morning` and `weekend`
  for a fresh profile, where a small starter target is useful.
- No extra network call and no new stored field.
- A month's picks never change after the first render, even when the user starts training.
- Every title is understandable without reading the target: the title says the intent, the count
  says the number.

## Risks

- **Too many challenges:** the rotation pool grows from ten to fifteen. Keep one per kind so the
  user still sees three, and do not add a fourth slot.
- **Morning/weekend guilt:** these are optional because they are excluded for profiles with no
  such history, except a fresh profile where the target is low. Copy never says “you missed”.
- **Variety overlap:** `newex` and `variety` both measure new things. They can appear in different
  months but not as the same month's explore pick because `pickChallenges` chooses one explore
  challenge.
- **Target inflation:** use the existing `stretch` bounds and test the first month after a fresh
  install so a beginner sees a reachable target.

## Implementation order

1. Add the five facts to `monthFacts` and `levelOf` with tests.
2. Add the challenge definitions and titles; run the existing challenge tests.
3. Add `themeOf` and the theme copy.
4. Update `challenge-copy.js`, Home and widget tests.
5. Translate the new keys, run the locale checker and the pt-BR fingerprint.
6. Run the full suite and CI.
