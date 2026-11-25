# Challenge medals: bronze, silver and gold per month

Status: **Agreed**, ready for implementation  
Date: 2026-11-25  
Part of: [Challenge system plan](2026-11-16-feature-plan-index.md), stage 0

## Why

The monthly challenges already have three goals per month, but medals are attached to individual
challenges and a gold month paints every badge gold. That makes the reward hard to read: the user
cannot tell whether the medal is for one challenge, for three, or for the whole month.

The new rule is one medal per month, earned by the number of completed challenges:

| Completed | Medal |
|---:|---|
| 0 | none |
| 1 | bronze |
| 2 | silver |
| 3 | gold |

This matches the tiered monthly challenges used by iFIT and BODY BIKE: the medal is the month's
result, while the individual challenges are the steps that build it.

## Goals

- One month, one medal, one clear sentence in the UI.
- Bronze/silver/gold are **derived**, never stored as another source of truth.
- Existing stored months keep their progress and gain the correct medal without migration.
- The Home card, the party after a completion, the Stats trophy shelf and the widget all use the
  same tier function.
- The rule works in every locale and with the existing `Medal` component.

## Non-goals

- No new challenge definitions, themes or bingo here. Those are stages 1 to 3.
- No points, coins, shop or streak freeze.
- No server field and no change to `mergeChallenges`.

## Decisions

### One medal per month

`tierOf(done)` returns `'bronze' | 'silver' | 'gold' | null`:

```js
export const tierOf = done =>
  done >= 3 ? 'gold' : done === 2 ? 'silver' : done === 1 ? 'bronze' : null
```

`done` is the number of **distinct completed challenge ids** in the stored month, capped at the
number of picked challenges. That is already what `done.length` means today.

`isGold(m)` stays as a compatibility helper and becomes `tierOf(m.done.length) === 'gold'` when a
month has at least one picked challenge. Existing callers do not need to change in this stage.

### The shelf shows one medal

`shelfOf(S)` returns, for each month with at least one done challenge:

```js
{ key, done, total, tier }
```

`total` is the number of picked challenges, normally three. `gold` may stay as a derived boolean
for older widget code, but new UI reads `tier`.

The trophy shelf draws **one** `Medal` per month, not one per completed challenge. Next to it:

- `1 / 3`, `2 / 3`, `3 / 3`;
- a short medal name: «Бронза», «Серебро», «Золото»;
- an accessible label with the month, tier and count.

The three challenge rows stay as they are: each one is a step, not a medal.

### Copy

English keys and Russian copy:

| Key | Russian |
|---|---|
| `Bronze month` | «Бронза месяца» |
| `Silver month` | «Серебро месяца» |
| `Gold month` | «Золото месяца» |
| `{0} of {1} challenges` | «{0} из {1} челленджей» |
| `Bronze month. Two to go.` | «Бронза месяца. Осталось два шага до золота.» |
| `Silver month. One to go.` | «Серебро. Остался один шаг.» |
| `Gold month. All three done.` | «Золото месяца. Все три готовы.» |

The existing gendered praise line stays for the gold state. It is shown only at three completed
challenges, not after one or two.

`ChallengeParty` changes from “new badge for every completion” to a tier result:

- first completion: bronze particle and «Бронза месяца. Осталось два шага до золота.»;
- second: silver and «Серебро. Остался один шаг.»;
- third: gold, crown and the existing praise line.

The party still shows once per newly completed challenge id, so editing or importing a workout
cannot replay it.

### Legacy months

Old months with `done: ['workouts', 'newex']` gain silver. Old months with all three gain gold.
No stored data is rewritten. The change is visible the first time the shelf is drawn.

## UI details

### Home card

The header keeps the month and `doneLine`. Add a small medal chip after the count:

```text
Ноябрь 2026 · 2 из 3        [silver] Серебро
```

Fold state, hide action, bars, check marks and party behaviour stay as they are.

### Stats trophy shelf

```text
[Bronze medal] Ноябрь 2026    1 / 3
[Silver medal] Октябрь 2026   2 / 3
[Gold medal]   Сентябрь 2026  3 / 3
```

`Medal tier="locked"` remains for the empty state. The empty-state sentence changes to explain
the bronze/silver/gold ladder once.

### Widgets

`lib/widgets.js` currently shows a text line for challenges. It should use the same `tierOf` and
show `Бронза · 1/3`, `Серебро · 2/3`, `Золото · 3/3` instead of a generic done line. No new
widget kind.

## Files

- `frontend/src/lib/challenges.js`: `tierOf`, `shelfOf` return shape, optional `medalName`.
- `frontend/src/lib/challenge-copy.js`: tier labels and short copy.
- `frontend/src/components/Challenges.jsx`: header chip, party text, one medal per shelf month.
- `frontend/src/components/Streak.jsx`: verify `Medal` accepts the three tiers; no visual change.
- `frontend/src/lib/widgets.js`: challenge tier line.
- `frontend/src/locales/*.js`: new strings in all packs; pt-BR fingerprint updated.
- Tests: `challenges.test.js`, `Challenges.test.jsx`, `widgets.test.js`, `pt-br-locale.test.js`.

## Tests and acceptance

- `tierOf(0) === null`, `tierOf(1) === 'bronze'`, `tierOf(2) === 'silver'`, `tierOf(3) === 'gold'`,
  `tierOf(4) === 'gold'` if a future month ever has more steps.
- A month with one done challenge renders exactly one bronze medal in Stats.
- Two done renders one silver medal, not two medals.
- Three done renders one gold medal and the existing praise line.
- An old stored month with two done gains silver without a write.
- The party names bronze, silver and gold on the first, second and third completion.
- The widget line matches the shelf tier.
- The 25 locale packs stay in sync and pt-BR inheritance passes.
- `npm test` and CI pass.

## Risks

- **Visual change:** users who liked three medals per month lose that display. The medal now
  answers the month's result, which is the requested model.
- **Gold month definition:** keep `isGold` based on all picked challenges being done, not a
  hard-coded three, so an imported or older month with a different `picked` length still works.
- **Accessibility:** a medal must not be the only signal; the `1 / 3` text and the accessible label
  carry the same information.

## Implementation order

1. Add `tierOf`, tests and the new `shelfOf` shape.
2. Update Home header and party copy.
3. Update the trophy shelf to one medal.
4. Update widget copy.
5. Add locale strings, run the locale checker and the pt-BR fingerprint.
6. Run the focused tests, then the full suite and CI.
