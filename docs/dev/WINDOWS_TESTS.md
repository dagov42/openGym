# Windows test baseline

Status of the fork's test suite on a Windows developer machine. CI (Linux) remains the source
of truth; this file records what Windows skips, normalises, or may flake on, so a red run here
can be judged against a known list.

Last measured: 2026-11-17, Node 24.16.0, Windows 10.0.19045, branch `integration`.

## Current result

| Suite | Command | Tests | Failed | Skipped |
|---|---|---|---|---|
| frontend | `cd frontend && npx vitest run` | 10,237 | 0 stable (1 flake, see below) | 11 |
| api | `cd api && npm test` | 1,098 | 0 (confirmed, exit 0) | 5 + conditional mode asserts |
| mcp | `cd mcp && npm test` | 172 | 0 | 1 |

The frontend's only failure in the last full run was `src/views/GymReminder.test.jsx` ("search
asks once you pause typing"), which passes in isolation — a timing flake under full parallel
load, not OS-specific.

## What made it pass

1. **`NODE_ENV=test` at config-load time.** `frontend/vite.config.js` and
   `mcp/vitest.config.js` set `process.env.NODE_ENV = 'test'` when `VITEST` is set, before Vite
   resolves the config. A `test.env` block alone is too late: the shell may export
   `NODE_ENV=production`, and Vite reads it when it computes `import.meta.env.DEV`/`PROD` and how
   to treat `node:` builtins. The consequences before this fix were: React lacked `act`
   (component tests), `import.meta.env.DEV` was false (`season-clock`), and `await
   import('node:fs')` inside a happy-dom file threw `No such built-in module: node:`. Production
   builds do not set `VITEST`, so they are unaffected.
2. **LF checkout.** `.gitattributes` declares `* text=auto eol=lf`. Byte-for-byte checks
   (`api/*-copy.js`, `api/openapi.yaml`, `api/coach/prompts/*.md`, `index.html` CSP,
   `live-native-source`, icon generation) fail on a stale CRLF checkout even though nothing is
   out of date. After pulling, re-checkout the affected paths (`git checkout -- <paths>`) rather
   than regenerating files.
3. **Windows fixes in the test files** (working tree): paths compared as POSIX (`.split(sep)
   .join('/')`), POSIX mode assertions wrapped in `if (process.platform !== 'win32')`, and tests
   that genuinely need POSIX semantics skipped with `skipIf(win32)` and a comment.

## Baseline before the fixes (for the record)

- frontend: 10,237 tests, **20 failed** — 9 path-separator, 9 missing `sh`, 2 flakes.
- api: 1,098 tests, **12 failed** — 8 POSIX mode/`chmod`, 1 path separator, 2 Unix-socket,
  1 flake.
- mcp: 172 tests, **1 failed** — `chmod` in `state.test.js`.

## Skipped on Windows by design (must keep running on Linux)

- `frontend/src/lib/api-base.test.js` — the whole "web container refuses a BASE_PATH" suite (11
  cases) spawns `sh web/05-check-base-path.sh`; a plain Windows shell has no `sh`.
- `api/test/server-health-writable.test.js` — "data directory the server cannot write to is 503"
  (Windows does not deny writes through a 0500 directory).
- `api/test/server-push-prune-save.test.js` — the two "unwritable ./data" cases (same reason).
- `api/test/server-recovery.test.js` — "recover.js asks the running server…" and "the admin
  socket is private…" (no AF_UNIX filesystem socket on Windows).
- `mcp/test/state.test.js` — "a permission failure names the file…" (`chmod 000` does not deny
  reads on Windows).

POSIX mode assertions in `credential`, `durable`, `integrations`, `server-db-unreadable`,
`server-media`, `trainers-core` are conditional rather than skipped: the rest of each test still
runs and only `mode & 0o777` is asserted on non-Windows.

## Known flakes under full parallel load (not OS-specific)

- `frontend/src/views/GymReminder.test.jsx` — debounce/search timing.
- `api/test/server-state-cache-bounds.test.js` — TTL boundary under load.
- `api/test/server-wrapped-push.test.js` — fake-clock timing.
- `frontend/src/lib/backup-media.test.js` — heavy (1,999 PNGs); its timeout was raised to 60 s.

Re-run a flake alone before treating it as a regression.

## Next steps

- De-flaking is deliberately left for a separate change. The three timing tests above use real
  timers; a robust fix is a fake-timer rewrite (`advanceTimersByTimeAsync`) of the debounce/TTL/
  clock assertions, which is invasive and risks weakening what they prove. Until then, re-run a
  flake alone before treating it as a regression.
- Commit the config pin, `.gitattributes`, and the Windows test fixes together, then re-measure.

## Rules

- Do not delete tests or weaken an assertion to make Windows green.
- Skip only genuine POSIX semantics, with `it.skipIf(process.platform === 'win32')` (or
  `test.skipIf`) **and a comment saying why**; the test must keep running on Linux.
- Replace the table when the numbers move; do not append stale runs.
