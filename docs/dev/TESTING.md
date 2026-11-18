# Testing

The suites and the coverage floor, so a green run means the same thing on a laptop and in CI.

## Suites

```bash
cd frontend && npm test      # vitest + native localization check
cd api && npm test           # node --test
cd mcp && npm test
```

`npm test` in `frontend/` runs the component/lib/views tests and then
`scripts/check-native-localizations.mjs`. The shared checks (locales, catalogue, coach assets, API
docs, Garmin) are in `node scripts/verify.mjs --checks-only`; the full `node scripts/verify.mjs`
adds the three suites.

## Coverage

```bash
cd frontend && npm run test:coverage
```

Coverage is measured for `src/lib` only: `vite.config.js` includes `src/lib/**/*.js` and excludes
tests, `exercises-data.js` and `hevy-id-map.js` (generated data, not hand-written logic). Views and
components have their own behaviour tests; a whole-app percentage would mostly measure the
generated catalogue.

The floor was set on 2026-11-18 from a clean run:

| Metric | Baseline | Floor |
|---|---:|---:|
| Statements | 89.08% | 88% |
| Branches | 81.37% | 80% |
| Functions | 88.31% | 87% |
| Lines | 93.04% | 92% |

The floor is intentionally a little below the baseline: it catches a real regression, not a
rounding difference between Node/V8 versions. Raise it when the baseline moves up; do not lower it
to make a feature pass without a reason in the PR.

## Flaky tests

`History.grow.test.jsx` imports the store and History under the full parallel run and can exceed
Vitest's default 10 s hook timeout on a loaded machine; its `beforeEach` carries a 30 s timeout.
Other source-reading tests use `api/test/route-sources.js` for the route-module list, so moving a
route out of `server.js` updates one place rather than three test files.
