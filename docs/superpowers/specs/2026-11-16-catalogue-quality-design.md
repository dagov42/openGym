# Catalogue quality: audit, Russian names, invariants

Status: candidate, designed 2026-11-16. Open questions at the end must be answered before an implementation
plan. Nothing implemented. Three related workstreams; they can land as separate PRs.

## Why

The catalogue is the app's most visible data and its most frequent source of reports: "wrong muscles" (#1034),
"wrong body parts" (#1263), "the jump rope is not cardio" (#1296), "dumbbell incline breeding" (#1302), Russian
names capitalising prepositions (#1247). `scripts/catalogue/validate.mjs` checks structure (ids, required
fields, `assisted` since #1222) and `build.mjs --check` catches stale generated data, but nothing checks
**meaning**, and the UI's casing rule is English-shaped.

Every one of those reports was found by a person. The point of this work is to make the next one fail in CI or
never happen.

## A. Semantic audit (`scripts/catalogue/audit.mjs`)

A read-only script over `catalogue/exercises/*.json` and the generated data. Findings are warnings by default;
`--ci` fails only on findings not in `catalogue/audit-baseline.json`, so the first run does not block every PR.

Rules, each a pure function with fixtures:

1. **Name ↔ muscles/equipment.** Token lists per movement family:
   - `calf`/`heel raise` should name the calves in `target`/`synergists`;
   - `curl` should name an elbow flexor (biceps/brachialis/forearm), except leg curls;
   - `row` should name the back; `press` should name chest/shoulders/triceps depending on the angle;
   - `squat`, `deadlift`, `lunge`, `plank`, `crunch`, `raise`, `pushdown`, `extension`, `pull-up`, `dip`.
   A hit is a warning with the exercise id, the token and the missing muscle. The lists live in the script,
   not in the app.
2. **Cardio classification.** A name/equipment that is unmistakably cardio (rope, treadmill, bike/cycle,
   elliptical, rower, stair/stepmill, ski erg) but `bodyPart !== 'cardio'` and `isCardio(id)` false is a
   warning. This is the #1296 class: eight rope exercises were `full body` and the app refused their minutes.
3. **Duplicates and typos.** Names equal after normalisation (case, punctuation) or within a small edit
   distance, per language. Warn, do not merge automatically; merging is a human decision (`exercise-merge`).
4. **Casing per language.** Per locale: a Russian/Ukrainian name with a capital on an interior preposition
   (`Жим Лёжа В Наклоне`), an ALL-CAPS name, or a title-cased German noun is reported. The catalogue stores
   names lower-case; the check is for hand-edited exceptions.
5. **`assisted` consistency.** `assisted: true` only on assisted machines/movements; a name containing
   "assisted" without the flag is a warning, and vice versa.
6. **Required semantics.** Every exercise has at least one muscle in `target`; `bodyPart` is in the known list;
   an equipment with no matching catalogue value is reported.

Output: a JSON summary and a CSV (`id, rule, message, name, language`) for contributors. The baseline file
holds accepted findings (with a reason), and `--ci` reports only new ones. `npm run audit:catalogue` (or the
existing script convention) documents it.

## B. Russian and Ukrainian name casing (#1247)

Today names are stored lower-case and shown through `capWords` (`frontend/src/lib/format.js:63`), which
capitalises every word, and through CSS `text-transform: capitalize` on several containers. For English that
is right; for Russian it produces `Жим Лёжа В Наклоне`.

- Replace `capWords` with a language-aware `capName(name, lang)`:
  - Latin-script languages: today's per-word behaviour;
  - `ru`, `uk` (and any other language that declares sentence case in a small map): capitalise the first
    letter only, leave the rest as stored. Names starting with a digit or a Latin brand (`3/4 присед`,
    `EZ-бар`) keep their first letter where it is.
- `exerciseNameText` uses `capName`; the CSS `capitalize` on name containers is removed or scoped to the
  languages it serves, so the text is not re-capitalised after the fact.
- No catalogue data migration: the stored lower-case names are correct; only the presentation changes.
- Tests: `жим лёжа в наклоне` → `Жим лёжа в наклоне`, `приседания со штангой` → `Приседания со штангой`,
  an English name unchanged, a name with a leading digit, a name in an RTL locale, an unknown language
  falling back to the English rule.
- The catalogue audit's rule 4 catches names that were stored title-cased by hand; the UI fix handles the
  rest.

## C. Regression invariants

- A catalogue-wide test that every exercise whose name/equipment is cardio is classified cardio (the rope
  list, treadmill, bike, elliptical, rower, stair, ski erg). It fails with the ids, so the next #1296 is
  caught before release.
- A test for `assisted`: the flag and the name agree on the known assisted exercises; `validate.mjs` keeps
  validating the field.
- A test that `build.mjs --check` output matches the generated `exercises-data.js` / coach library (the
  existing check, wired into CI).
- Optional: a test that every catalogue exercise id used by the starter plans, programmes and muscle-map
  batches exists and has the expected muscles.

## Where the logic lives

- `scripts/catalogue/audit.mjs` + `scripts/catalogue/audit/` for rule functions and fixtures; no app import
  beyond the catalogue readers the other scripts already use.
- `frontend/src/lib/format.js` `capName`, tests beside it; CSS changes in `frontend/src/index.css`,
  `coach.css` and `Community.css` where names are rendered.
- Catalogue invariants as vitest tests under `frontend/src/lib/` (they already read the catalogue in tests),
  or in the catalogue script's test suite with the same commands CI runs.

## Non-goals

- Rewriting the catalogue or auto-fixing findings.
- Translating names.
- A UI for browsing audit findings in the app.
- Changing the exercise ids or the generated data format.

## Tests

- Each audit rule: a hit, a near miss, a clean exercise, a baseline entry suppressing a known finding.
- The audit is read-only: running it twice changes no file.
- Casing: the cases in B, plus an English regression test and a CSS/class check that names are not
  double-capitalised.
- Invariants: a deliberately broken fixture fails with the id; the real catalogue passes.

## Open questions

1. **Rule authority:** the token lists in A are heuristics. Who owns them, and how is a false positive
   suppressed? Proposal: the baseline file with a reason; a contributor adds an entry rather than weakening
   the rule.
2. **CI strictness:** fail on new findings from day one (proposed) or warn for a few releases? Proposal: fail
   on new findings, warn on the baseline.
3. **Casing scope:** only `ru`/`uk` (proposed) or also `bg`, `pl`, `cs`, `sk`? Proposal: start with the two
   the issue names, extend the map when a report arrives.
4. **Where the invariants live:** frontend vitest (proposed) or the catalogue script's own test runner? The
   frontend suite already reads the catalogue and runs in CI.
