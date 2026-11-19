# Fork operations: tests, upstream status, sync checklist

Status: task spec, designed 2026-11-16. B and C implemented 2026-11-17 (`scripts/fork/upstream-status.mjs`,
`docs/dev/FORK_SYNC.md`); A landed in the 2026-11-16/17 test-hygiene work and is recorded in
`docs/dev/WINDOWS_TESTS.md`. These are the chores that make every later PR cheaper; they are not
user-facing features.

## A. Test hygiene on Windows

Today `frontend/package.json` runs `vitest run && npm run check:native-localizations`. On the fork owner's
Windows machine the baseline has 33 failures unrelated to any change (`FORK_CHANGELOG.md`, 2026-11-16). They
fall into three groups and each has a different fix:

1. **React `act` missing.** The shell exports `NODE_ENV=production`, which makes React's production build lack
   `act`, so component tests fail. Vitest's default is `test`, but an explicit environment value wins.
   - Fix: set `NODE_ENV=test` in the vitest config (`frontend/vite.config.*` test block or a
     `vitest.config.*`), so the suite does not depend on the caller's shell. If the config cannot override it,
     set it in the npm script before `vitest`.
   - Acceptance: the `act` failures disappear when the shell says `production`.
2. **Asset and native-source checks.** Tests that read files from `android/`, `ios/`, `web/` or the built
   assets assume a path/case that Windows does not match (case-insensitive FS, different separators, missing
   build outputs). Examples are the `android-asset-packs`, CSP, native localisation and live-native-source
   tests.
   - Fix per test: build the path with `path.join`/`new URL`, skip a test that genuinely needs a POSIX file
     system (`it.skipIf(process.platform === 'win32')`) with a comment saying why, and do not require a build
     artifact that is not present.
   - Acceptance: no test fails only because of the OS; a skipped test names the OS in its title.
3. **`chmod`/file-mode tests.** The MCP suite's `state.test.js` uses `chmod`, which Windows ignores.
   - Fix: skip the mode assertion on `win32`, keep the rest of the test.
   - Acceptance: `mcp` suite green on Windows except genuinely unrepresentable POSIX semantics, documented.

Definition of done:

- `frontend`: `npm test` on Windows reports 0 unexpected failures; the known list is either empty or a short
  documented `docs/dev/WINDOWS_TESTS.md` with why each line is expected.
- `api`: `npm test` (node --test) green, or the same documented list.
- `mcp`: `npm test` green except the documented `chmod` line.
- CI (Linux) unchanged; no test is made weaker for Linux to make Windows pass.

## B. `fork-status` script

`scripts/fork/upstream-status.mjs`, read-only, no writes to git or GitHub:

- Inputs: `origin` (upstream `DuarteSantos8/openGym`), `fork` (`dagov42/openGym`), the current branch; optional
  `GITHUB_TOKEN` for the API (unauthenticated 60 req/h is enough for one run).
- Outputs, human-readable and `--json`:
  1. **Upstream commits not in the fork**: `git log --oneline fork/main..origin/main` (refreshed with
     `git fetch` only when `--fetch` is passed).
  2. **Merged upstream PRs that touch files the fork has modified locally**: read the local dirty/committed
     diff against the last sync point (`FORK_CHANGELOG.md` records the base commit), ask the GitHub API for
     PRs merged since that point, and intersect their changed files with the local changed files. This is the
     "read the diff before cherry-picking" list.
  3. **Local commits not upstream**: `git log --oneline origin/main..HEAD`, with the PR numbers already in
     the changelog marked.
  4. **Conflicts likely**: the same file touched both upstream and locally.
- No auto-cherry-pick, no branch changes, no writes. The script prints a checklist the human follows.
- Tests: fixture git logs / API JSON, path intersection, an empty case, a missing token, a network error that
  falls back to git-only output.
- Docs: `docs/dev/FORK_SYNC.md` (the checklist below) mentions the command.

## C. Sync checklist (`docs/dev/FORK_SYNC.md`)

The human process the changelog already follows, written down once:

1. `git fetch origin` and run `fork-status`; read the upstream commits and the overlapping PRs.
2. Merge the upstream release branch into `integration`; resolve conflicts with the local feature in mind
   (the changelog's 2026-11-16 entry is the example: keep `askToUpdate`, add upstream `layoutSheet`).
3. Cherry-pick the merged upstream PRs the plan lists; for each, check whether the fork already has a better
   implementation (the `#1118` decision: do not take a weaker version over a fuller local one).
4. Fix bugs **inside** a cherry-picked PR, with tests, as the changelog's `#1132`/`#1205` entries do.
5. Run the targeted suites first, then the full baseline; compare against `docs/dev/WINDOWS_TESTS.md`.
6. Update `FORK_CHANGELOG.md`: what was merged, what was ported, what was fixed on top, the base and result
   commits, and what was deliberately left for next time.
7. Push the branch; do not force-push over a review in progress.

## Non-goals

- Automating cherry-picks or merges.
- Making the Windows suite pass by deleting tests.
- Replacing `FORK_CHANGELOG.md` with the script; the changelog is the human record.

## Decisions (formerly open questions)

1. **Where the Windows baseline lives:** `docs/dev/WINDOWS_TESTS.md`, so it survives changelog edits.
2. **`--fetch` default:** a flag; the script must not touch the network without being asked.
3. **GitHub API without a token:** the script still asks unauthenticated (60 requests/hour is enough for one
   run). A network or rate-limit error drops the overlapping-PR section and keeps the git-only output, with a
   note saying why.
