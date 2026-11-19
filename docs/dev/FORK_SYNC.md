# Fork sync checklist

How the fork (`dagov42/openGym`) takes changes from upstream (`DuarteSantos8/openGym`) without
losing its own fixes. The script does the reading; a human makes every merge decision.

## Before you start

- Remotes: `origin` is upstream (`DuarteSantos8/openGym`), `fork` is the fork
  (`dagov42/openGym`). Check with `git remote -v`.
- The last sync point is the topmost `Базовая точка: \`<sha>\`` line in
  [`FORK_CHANGELOG.md`](../../FORK_CHANGELOG.md). Every sync entry starts with it; add it when you
  finish a sync.
- `GITHUB_TOKEN` (or `GH_TOKEN`) is optional. Without it the script asks GitHub unauthenticated
  (60 requests an hour); with it, the overlapping-PR section is cheap and reliable.

## Run the status script

```sh
git fetch origin                                    # or let the script do it
node scripts/fork/upstream-status.mjs --fetch       # human-readable
node scripts/fork/upstream-status.mjs --json        # the same data for a tool
```

Options: `--upstream origin/main`, `--fork fork/main`, `--base <sha>`, `--limit <n>`,
`--token <token>`. The script is read-only: it never merges, cherry-picks, fetches (unless
`--fetch`), or writes to the working tree, git or GitHub.

### What each section means

| Section | What to do with it |
|---|---|
| 1. Upstream commits not in the fork | Read the subjects; open the diffs of anything touching the files section 4 lists. |
| 2. Merged upstream PRs overlapping local changes | The "read the diff before cherry-picking" list: these PRs touch files the fork also changed since the sync point. |
| 3. Local commits not upstream | What the fork already carries. `[already in FORK_CHANGELOG.md]` means the PR number is recorded there. |
| 4. Files both sides touched | Likely merge conflicts. Resolve with the local decision in mind, not by taking upstream wholesale. |

Notes at the top say what was skipped (no upstream ref, no sync point, no GitHub remote) and why.
A GitHub/network failure removes section 2 only; the git-only sections still print.

## Checklist

1. **Fetch and read.** Run the command above. Read the upstream commits and the overlapping PRs.
2. **Merge upstream.** Merge the upstream release branch into `integration`; resolve conflicts
   with the fork's intent in mind. The changelog's 2026-11-16 entry is the example: keep
   `askToUpdate`, add upstream `layoutSheet`.
3. **Cherry-pick planned PRs.** For each, check whether the fork already has a better
   implementation (the `#1118` decision: do not take a weaker version over a fuller local one).
4. **Fix inside the port.** If a ported PR needs a correction, fix it there, with tests, as the
   `#1132`/`#1205` changelog entries do.
5. **Test.** Run the targeted suites first, then the full baseline. On Windows compare against
   [`WINDOWS_TESTS.md`](WINDOWS_TESTS.md); CI on Linux stays the source of truth.
6. **Record.** Update [`FORK_CHANGELOG.md`](../../FORK_CHANGELOG.md): what was merged, what was
   ported, what was fixed on top, the base and result commits, and what is deliberately left for
   next time.
7. **Push.** Push the branch; do not force-push over a review in progress.

## Non-goals

- Automating cherry-picks or merges. The script never changes branches.
- Making the Windows suite pass by deleting tests (see `WINDOWS_TESTS.md`).
- Replacing `FORK_CHANGELOG.md`; the changelog is the human record.

## Tests of the script

```sh
node --test scripts/fork/upstream-status.test.mjs
```

The tests use fixture git output and a fake `fetch`; they never touch this repository or the
network.
