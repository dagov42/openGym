# Testing

The suites and the coverage floor, so a green run means the same thing on a laptop and in CI.

## Suites

```bash
cd frontend && npm test      # vitest with coverage + native localization check
cd frontend && npm run test:unit       # the same tests, without coverage
cd api && npm test           # node --test
cd mcp && npm test
```

`npm test` in `frontend/` runs the component/lib/views tests under coverage, enforces the floor
below, and then runs `scripts/check-native-localizations.mjs`. Use `npm run test:unit` for the
quick loop while developing. The shared checks (locales, catalogue, coach assets, API docs,
Garmin) are in `node scripts/verify.mjs --checks-only`; the full `node scripts/verify.mjs` adds
the three suites.

## Coverage

```bash
cd frontend && npm run test:coverage   # same as npm test's coverage step
```

Coverage is measured for `src/lib` only: `vite.config.js` includes `src/lib/**/*.js` and excludes
tests, `exercises-data.js` and `hevy-id-map.js` (generated data, not hand-written logic). Views and
components have their own behaviour tests; a whole-app percentage would mostly measure the
generated catalogue.

The floor was set on 2026-11-18 from a clean run:

| Metric | Baseline | Floor |
|---|---:|---:|
| Statements | 91.64% | 88% |
| Branches | 83.93% | 80% |
| Functions | 92.28% | 87% |
| Lines | 95.27% | 92% |

The floor is intentionally a little below the baseline: it catches a real regression, not a
rounding difference between Node/V8 versions. Raise it when the baseline moves up; do not lower it
to make a feature pass without a reason in the PR.

## Flaky tests

`History.grow.test.jsx` imports the store and History under the full parallel run and can exceed
Vitest's default 10 s hook timeout on a loaded machine; its `beforeEach` carries a 30 s timeout.
Other source-reading tests use `api/test/route-sources.js` for the route-module list, so moving a
route out of `server.js` updates one place rather than three test files.
