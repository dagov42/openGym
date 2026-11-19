#!/usr/bin/env node
// Read-only status of the fork against upstream. It answers the four questions the sync checklist
// asks before any merge or cherry-pick, and it never writes to git, GitHub or the working tree:
//
//   1. upstream commits the fork does not have yet;
//   2. merged upstream PRs whose files the fork has also changed since the last sync point;
//   3. local commits upstream does not have (with the PR numbers already in FORK_CHANGELOG.md);
//   4. files both sides touched, i.e. likely merge conflicts.
//
//   node scripts/fork/upstream-status.mjs             human-readable checklist
//   node scripts/fork/upstream-status.mjs --json      the same data as JSON
//   node scripts/fork/upstream-status.mjs --fetch     git fetch the upstream remote first
//
// The last sync point is the topmost "Базовая точка: `<sha>`" line in FORK_CHANGELOG.md. Only the
// PR list asks GitHub (GITHUB_TOKEN or GH_TOKEN is optional; unauthenticated allows 60 requests
// an hour). A network or rate-limit error drops that section and keeps the git-only output.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CHANGELOG = 'FORK_CHANGELOG.md'
const DEFAULTS = {
  upstream: 'origin/main',
  fork: 'fork/main',
  base: null,
  token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
  fetch: false,
  json: false,
  help: false,
  limit: 50,
}

const USAGE = `Usage: node scripts/fork/upstream-status.mjs [options]

Read-only: prints upstream commits, overlapping merged PRs, local commits and likely conflicts.
Nothing is fetched, merged, cherry-picked or written unless --fetch is passed.

  --upstream <remote/branch>  upstream ref (default origin/main)
  --fork <remote/branch>      the fork's base ref (default fork/main)
  --base <sha>                last sync point (default: topmost "Базовая точка" in FORK_CHANGELOG.md)
  --fetch                     run "git fetch <remote> <branch>" for the upstream ref first
  --json                      print the report as JSON
  --token <token>             GitHub token (default: GITHUB_TOKEN or GH_TOKEN)
  --limit <n>                 most merged PRs to inspect (default 50)
  -h, --help                  this text

Exit codes: 0 report printed, 1 git/API failure, 2 bad arguments.`

export function parseArgs(argv) {
  const options = { ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.indexOf('=')
    const flag = eq === -1 ? arg : arg.slice(0, eq)
    const inline = eq === -1 ? undefined : arg.slice(eq + 1)
    const value = () => {
      if (inline !== undefined) return inline
      const next = argv[++i]
      if (next === undefined) throw new Error(`${flag} needs a value`)
      return next
    }
    switch (flag) {
      case '--json': options.json = true; break
      case '--fetch': options.fetch = true; break
      case '-h':
      case '--help': options.help = true; break
      case '--upstream': options.upstream = value(); break
      case '--fork': options.fork = value(); break
      case '--base': options.base = value(); break
      case '--token': options.token = value(); break
      case '--limit': {
        const n = Number(value())
        if (!Number.isInteger(n) || n < 1) throw new Error('--limit needs a positive integer')
        options.limit = n
        break
      }
      default: throw new Error(`unknown option ${arg}`)
    }
  }
  return options
}

// "Базовая точка: `<sha>`" is how every sync entry in FORK_CHANGELOG.md starts. The newest entry
// is at the top, so the first match is the current sync point.
export function parseBase(changelog) {
  const match = /^\s*(?:[-*]\s*)?(?:Базовая точка|Base(?: point)?)\s*:\s*`([0-9a-f]{7,40})`/im.exec(String(changelog || ''))
  return match ? match[1] : null
}

export function parseRemoteUrl(url) {
  const clean = String(url || '').trim().replace(/\.git$/, '')
  if (!clean) return null
  let match = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+)$/.exec(clean)
  if (match) return { owner: match[1], repo: match[2] }
  match = /^(?:ssh:\/\/)?(?:[^@/]+@)?[^/:]+\/([^/]+)\/([^/]+)$/.exec(clean)
  if (match) return { owner: match[1], repo: match[2] }
  match = /^(?:[^@/]+@)?[^:]+:([^/]+)\/([^/]+)$/.exec(clean)
  if (match) return { owner: match[1], repo: match[2] }
  return null
}

// `git log --oneline` uses "sha subject", `--format=%h%x09%s` uses a tab. Both are accepted.
export function parseGitLog(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t')
      if (tab !== -1) return { sha: line.slice(0, tab).trim(), subject: line.slice(tab + 1).trim() }
      const space = line.indexOf(' ')
      return space === -1 ? { sha: line, subject: '' } : { sha: line.slice(0, space), subject: line.slice(space + 1).trim() }
    })
}

export function parseNameOnly(text) {
  return [...new Set(String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort()
}

export function intersect(left, right) {
  const other = new Set(right)
  return [...new Set(left.filter((file) => other.has(file)))].sort()
}

export function splitRef(ref) {
  const slash = String(ref).indexOf('/')
  return slash === -1 ? { remote: null, branch: ref } : { remote: ref.slice(0, slash), branch: ref.slice(slash + 1) }
}

export function mergedSince(pulls, since) {
  const cutoff = since ? new Date(since).getTime() : -Infinity
  return (pulls || []).filter((pull) => {
    if (!pull || !pull.merged_at) return false
    const merged = new Date(pull.merged_at).getTime()
    return Number.isFinite(merged) && merged >= cutoff
  })
}

// One page of closed PRs, then one request per merged PR for its changed files. The caller gets
// everything it needs; a non-2xx answer throws so the caller can fall back to git-only output.
export async function fetchMergedPrFiles({
  owner, repo, since, baseBranch = 'main', token = '', fetchImpl = globalThis.fetch,
  maxPages = 3, maxPrs = 50,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('no fetch implementation')
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'opengym-fork-status' }
  if (token) headers.Authorization = `Bearer ${token}`
  const pulls = []
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&base=${encodeURIComponent(baseBranch)}&sort=updated&direction=desc&per_page=100&page=${page}`
    const response = await fetchImpl(url, { headers })
    if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}${response.status === 403 ? ' (rate limit? set GITHUB_TOKEN)' : ''}`)
    const batch = await response.json()
    pulls.push(...batch)
    if (batch.length < 100) break
    const oldest = batch[batch.length - 1]?.updated_at
    if (since && oldest && new Date(oldest).getTime() < new Date(since).getTime()) break
  }
  const merged = mergedSince(pulls, since).slice(0, maxPrs)
  const result = []
  for (const pull of merged) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull.number}/files?per_page=100`
    const response = await fetchImpl(url, { headers })
    if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}`)
    const files = await response.json()
    result.push({
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      merged_at: pull.merged_at,
      files: parseNameOnly(files.map((file) => file.filename).join('\n')),
    })
  }
  return result
}

export function makeGit(cwd = process.cwd()) {
  return (args, { allowFail = false } = {}) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
    } catch (error) {
      if (allowFail) return null
      const detail = String(error.stderr || error.message || '').trim()
      throw new Error(`git ${args.join(' ')} failed: ${detail}`)
    }
  }
}

// The four sections, with the git runner injected so tests can use fixtures and the API/network
// path can fail without touching a real repository.
export async function collectStatus({ git, options = {}, changelog = '', fetchImpl = globalThis.fetch }) {
  const notes = []
  const hasRef = (ref) => git(['rev-parse', '--verify', '--quiet', ref], { allowFail: true }) !== null
  const head = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }) || '(detached)'
  const upstream = options.upstream || DEFAULTS.upstream
  const fork = options.fork || DEFAULTS.fork
  const upstreamHere = hasRef(upstream)
  const forkHere = hasRef(fork)
  if (!upstreamHere) notes.push(`upstream ref ${upstream} is not available locally (pass --fetch or --upstream)`)
  if (!forkHere) notes.push(`fork ref ${fork} is not available locally (pass --fetch or --fork)`)

  const base = options.base || parseBase(changelog)
  let baseDate = null
  if (!base) {
    notes.push(`no sync point: add "Базовая точка: \`<sha>\`" to ${CHANGELOG} or pass --base`)
  } else {
    baseDate = git(['show', '-s', '--format=%cI', base], { allowFail: true })
    if (!baseDate) notes.push(`sync point ${base} is not a commit in this repository`)
  }

  const upstreamCommits = upstreamHere && forkHere
    ? parseGitLog(git(['log', '--format=%h%x09%s', '--no-decorate', `${fork}..${upstream}`], { allowFail: true }) || '')
    : []
  if (upstreamHere && !forkHere) notes.push('skipped upstream commits: no fork ref to compare with')

  const changelogPrs = new Set([...String(changelog).matchAll(/#(\d+)/g)].map((match) => match[1]))
  const localCommits = upstreamHere
    ? parseGitLog(git(['log', '--format=%h%x09%s', '--no-decorate', `${upstream}..HEAD`], { allowFail: true }) || '')
      .map((commit) => ({
        ...commit,
        inChangelog: [...commit.subject.matchAll(/#(\d+)/g)].some((match) => changelogPrs.has(match[1])),
      }))
    : []
  if (!upstreamHere) notes.push('skipped local commits: upstream ref is not available')

  let localFiles = []
  if (baseDate) {
    const committed = parseNameOnly(git(['diff', '--name-only', base], { allowFail: true }) || '')
    const untracked = parseNameOnly(git(['ls-files', '--others', '--exclude-standard'], { allowFail: true }) || '')
    localFiles = [...new Set([...committed, ...untracked])].sort()
  }

  let likelyConflicts = []
  if (baseDate && upstreamHere) {
    const upstreamFiles = parseNameOnly(git(['diff', '--name-only', `${base}...${upstream}`], { allowFail: true }) || '')
    likelyConflicts = intersect(localFiles, upstreamFiles)
  }

  let overlappingPrs = []
  let checkedPrs = 0
  const remote = splitRef(upstream).remote
  const remoteUrl = remote ? git(['remote', 'get-url', remote], { allowFail: true }) : null
  const repo = parseRemoteUrl(remoteUrl)
  if (!baseDate) {
    notes.push('skipped merged PRs: needs the last sync point')
  } else if (!repo) {
    notes.push(`skipped merged PRs: cannot read the GitHub remote from ${remote || 'the upstream ref'}`)
  } else if (!options.token) {
    notes.push('GITHUB_TOKEN/GH_TOKEN is not set: asking GitHub unauthenticated (60 requests/hour)')
  }
  if (baseDate && repo) {
    try {
      const pulls = await fetchMergedPrFiles({
        owner: repo.owner,
        repo: repo.repo,
        since: baseDate,
        baseBranch: splitRef(upstream).branch || 'main',
        token: options.token || '',
        fetchImpl,
        maxPrs: options.limit || DEFAULTS.limit,
      })
      checkedPrs = pulls.length
      overlappingPrs = pulls
        .map((pull) => ({ ...pull, overlap: intersect(localFiles, pull.files) }))
        .filter((pull) => pull.overlap.length > 0)
    } catch (error) {
      notes.push(`merged PRs skipped: ${error.message}`)
    }
  }

  return {
    refs: { upstream, fork, head },
    base: baseDate ? { sha: base, date: baseDate } : null,
    upstreamCommits,
    localCommits,
    likelyConflicts,
    overlappingPrs,
    checkedPrs,
    notes,
  }
}

function list(items, empty, format) {
  return items.length ? items.map(format) : [`  ${empty}`]
}

export function formatReport(data) {
  const lines = []
  lines.push('Fork status against upstream (read-only)')
  lines.push(`  upstream: ${data.refs.upstream}    fork: ${data.refs.fork}    HEAD: ${data.refs.head}`)
  lines.push(`  sync point: ${data.base ? `${data.base.sha} (${data.base.date})` : 'not found'}`)
  for (const note of data.notes) lines.push(`  note: ${note}`)
  lines.push('')

  lines.push(`1. Upstream commits not in the fork (${data.upstreamCommits.length})`)
  lines.push(...list(data.upstreamCommits, 'none', (commit) => `  ${commit.sha} ${commit.subject}`))
  lines.push('')

  lines.push(`2. Merged upstream PRs overlapping the fork's changes (${data.overlappingPrs.length} of ${data.checkedPrs})`)
  lines.push(...list(data.overlappingPrs, 'none', (pull) => [
    `  #${pull.number} ${pull.title} — ${pull.url}`,
    ...pull.overlap.map((file) => `      ${file}`),
  ].join('\n')))
  lines.push('')

  lines.push(`3. Local commits not upstream (${data.localCommits.length})`)
  lines.push(...list(data.localCommits, 'none', (commit) =>
    `  ${commit.sha} ${commit.subject}${commit.inChangelog ? ' [already in FORK_CHANGELOG.md]' : ''}`))
  lines.push('')

  lines.push(`4. Files both sides touched, likely conflicts (${data.likelyConflicts.length})`)
  lines.push(...list(data.likelyConflicts, 'none', (file) => `  ${file}`))
  lines.push('')

  lines.push('Checklist (docs/dev/FORK_SYNC.md):')
  lines.push('  1. Read the upstream commits and the overlapping PRs above; open each diff before porting it.')
  lines.push('  2. Merge the upstream branch into integration; resolve conflicts with the fork decision in mind.')
  lines.push('  3. Cherry-pick the planned PRs; keep a fuller local implementation over a weaker upstream one.')
  lines.push('  4. Fix bugs inside a ported PR, with tests (FORK_CHANGELOG.md has the pattern).')
  lines.push('  5. Run the targeted suites, then the full baseline; judge Windows against docs/dev/WINDOWS_TESTS.md.')
  lines.push('  6. Update FORK_CHANGELOG.md: base point, merged/ported/fixed, commits, what is left for next time.')
  lines.push('  7. Push the branch; do not force-push over a review in progress.')
  return lines.join('\n')
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`fork-status: ${error.message}\n\n${USAGE}`)
    process.exit(2)
  }
  if (options.help) {
    console.log(USAGE)
    return
  }
  const git = makeGit(process.cwd())
  if (options.fetch) {
    const { remote, branch } = splitRef(options.upstream)
    if (!remote) {
      console.error(`fork-status: --fetch needs a remote/branch upstream ref, got ${options.upstream}`)
      process.exit(2)
    }
    try {
      git(['fetch', remote, branch])
    } catch (error) {
      console.error(`fork-status: ${error.message} (continuing with the local refs)`)
    }
  }
  let changelog = ''
  try {
    changelog = readFileSync(CHANGELOG, 'utf8')
  } catch {
    console.error(`fork-status: ${CHANGELOG} not found; pass --base to set the sync point`)
  }
  const data = await collectStatus({ git, options, changelog })
  console.log(options.json ? JSON.stringify(data, null, 2) : formatReport(data))
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entry) {
  main().catch((error) => {
    console.error(`fork-status: ${error.message}`)
    process.exit(1)
  })
}
