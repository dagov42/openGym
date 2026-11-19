import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectStatus, fetchMergedPrFiles, formatReport, intersect, mergedSince, parseArgs, parseBase,
  parseGitLog, parseNameOnly, parseRemoteUrl,
} from './upstream-status.mjs'

const BASE = '0b8eaa1f0'
const CHANGELOG = [
  '# Журнал',
  '',
  '## 2026-11-16 — синхронизация',
  '',
  'Базовая точка: `0b8eaa1f0` (v1.4.6 форка). Итог: `020f09731`.',
  'Портирован PR #1234.',
  '',
  'Старая точка: `1111111` не должна выбираться.',
].join('\n')

// A git runner backed by a map of "arg1 arg2 ..." -> stdout. Missing commands fail unless the
// caller passed allowFail, exactly like the real runner.
function fakeGit(outputs) {
  return (args, { allowFail = false } = {}) => {
    const key = args.join(' ')
    if (Object.prototype.hasOwnProperty.call(outputs, key)) return outputs[key]
    if (allowFail) return null
    throw new Error(`unexpected git ${key}`)
  }
}

const GIT = {
  'rev-parse --abbrev-ref HEAD': 'integration',
  'rev-parse --verify --quiet origin/main': 'aaaaaaa',
  'rev-parse --verify --quiet fork/main': 'bbbbbbb',
  [`show -s --format=%cI ${BASE}`]: '2026-11-16T20:00:00+03:00',
  'log --format=%h%x09%s --no-decorate fork/main..origin/main': 'aaa1111\tupstream fix one\nbbb2222\tupstream fix two',
  'log --format=%h%x09%s --no-decorate origin/main..HEAD': 'ccc3333\tfix: local change (#1234)\nddd4444\tchore: local only',
  [`diff --name-only ${BASE}`]: 'frontend/src/a.js\nfrontend/src/b.js',
  'ls-files --others --exclude-standard': 'scratch.txt',
  [`diff --name-only ${BASE}...origin/main`]: 'frontend/src/a.js\nfrontend/src/c.js',
  'remote get-url origin': 'https://github.com/DuarteSantos8/openGym.git',
}

function fakeFetch({ pulls, files = {}, status = 200 }) {
  const calls = []
  const impl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} })
    const ok = status >= 200 && status < 300
    if (url.includes('/files')) {
      const number = /\/pulls\/(\d+)\/files/.exec(url)[1]
      return { ok, status, json: async () => files[number] || [] }
    }
    return { ok, status, json: async () => pulls }
  }
  return { impl, calls }
}

test('parseBase takes the topmost Russian or English sync point', () => {
  assert.equal(parseBase(CHANGELOG), '0b8eaa1f0')
  assert.equal(parseBase('## entry\n\nBase: `abc1234`'), 'abc1234')
  assert.equal(parseBase('Base point: `abcdef12`'), 'abcdef12')
  assert.equal(parseBase('no sync point here'), null)
  assert.equal(parseBase(''), null)
})

test('parseRemoteUrl understands https and ssh remotes', () => {
  assert.deepEqual(parseRemoteUrl('https://github.com/dagov42/openGym.git'), { owner: 'dagov42', repo: 'openGym' })
  assert.deepEqual(parseRemoteUrl('git@github.com:dagov42/openGym.git'), { owner: 'dagov42', repo: 'openGym' })
  assert.deepEqual(parseRemoteUrl('ssh://git@github.com/dagov42/openGym.git'), { owner: 'dagov42', repo: 'openGym' })
  assert.equal(parseRemoteUrl('not a url'), null)
  assert.equal(parseRemoteUrl(''), null)
})

test('parseGitLog reads both log formats and ignores blank lines', () => {
  assert.deepEqual(parseGitLog('abc1234\tfirst\ndef5678\tsecond\n'), [
    { sha: 'abc1234', subject: 'first' },
    { sha: 'def5678', subject: 'second' },
  ])
  assert.deepEqual(parseGitLog('abc1234 first fix\n\n'), [{ sha: 'abc1234', subject: 'first fix' }])
  assert.deepEqual(parseGitLog(''), [])
})

test('parseNameOnly de-duplicates, sorts and trims', () => {
  assert.deepEqual(parseNameOnly('b.js\n a.js \nb.js\n\n'), ['a.js', 'b.js'])
  assert.deepEqual(parseNameOnly(''), [])
})

test('intersect keeps only files both sides touched', () => {
  assert.deepEqual(intersect(['a.js', 'b.js'], ['b.js', 'c.js']), ['b.js'])
  assert.deepEqual(intersect([], ['a.js']), [])
  assert.deepEqual(intersect(['a.js'], []), [])
})

test('mergedSince keeps merged PRs at or after the sync point', () => {
  const pulls = [
    { number: 1, merged_at: '2026-11-17T10:00:00Z' },
    { number: 2, merged_at: '2026-11-15T10:00:00Z' },
    { number: 3, merged_at: null },
  ]
  assert.deepEqual(mergedSince(pulls, '2026-11-16T00:00:00Z').map((pull) => pull.number), [1])
  assert.deepEqual(mergedSince(pulls, null).map((pull) => pull.number), [1, 2])
})

test('fetchMergedPrFiles works without a token and asks GitHub unauthenticated', async () => {
  const { impl, calls } = fakeFetch({
    pulls: [{ number: 7, title: 'Fix', html_url: 'https://github.com/x/y/pull/7', merged_at: '2026-11-17T10:00:00Z', updated_at: '2026-11-17T10:00:00Z' }],
    files: { 7: [{ filename: 'frontend/src/a.js' }] },
  })
  const result = await fetchMergedPrFiles({
    owner: 'DuarteSantos8', repo: 'openGym', since: '2026-11-16T00:00:00Z', token: '', fetchImpl: impl,
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].number, 7)
  assert.deepEqual(result[0].files, ['frontend/src/a.js'])
  assert.equal(calls.length, 2)
  for (const call of calls) assert.equal(call.headers.Authorization, undefined)
  assert.match(calls[0].url, /pulls\?state=closed/)
})

test('fetchMergedPrFiles sends the token when it has one', async () => {
  const { impl, calls } = fakeFetch({ pulls: [] })
  await fetchMergedPrFiles({
    owner: 'DuarteSantos8', repo: 'openGym', since: null, token: 'secret', fetchImpl: impl,
  })
  assert.equal(calls[0].headers.Authorization, 'Bearer secret')
})

test('fetchMergedPrFiles throws on an API error so the caller can fall back', async () => {
  const { impl } = fakeFetch({ pulls: [], status: 403 })
  await assert.rejects(
    fetchMergedPrFiles({ owner: 'a', repo: 'b', since: null, fetchImpl: impl }),
    /GitHub API 403/,
  )
})

test('collectStatus builds the four sections and marks changelog PRs', async () => {
  const { impl } = fakeFetch({
    pulls: [
      { number: 1234, title: 'Overlap', html_url: 'https://github.com/x/y/pull/1234', merged_at: '2026-11-17T10:00:00Z', updated_at: '2026-11-17T10:00:00Z' },
      { number: 99, title: 'No overlap', html_url: 'https://github.com/x/y/pull/99', merged_at: '2026-11-17T09:00:00Z', updated_at: '2026-11-17T09:00:00Z' },
    ],
    files: { 1234: [{ filename: 'frontend/src/a.js' }], 99: [{ filename: 'README.md' }] },
  })
  const data = await collectStatus({
    git: fakeGit(GIT), options: { token: 'test-token' }, changelog: CHANGELOG, fetchImpl: impl,
  })

  assert.deepEqual(data.refs, { upstream: 'origin/main', fork: 'fork/main', head: 'integration' })
  assert.equal(data.base.sha, BASE)
  assert.equal(data.upstreamCommits.length, 2)
  assert.equal(data.localCommits.length, 2)
  assert.deepEqual(data.localCommits.map((commit) => commit.inChangelog), [true, false])
  assert.deepEqual(data.likelyConflicts, ['frontend/src/a.js'])
  assert.equal(data.checkedPrs, 2)
  assert.equal(data.overlappingPrs.length, 1)
  assert.equal(data.overlappingPrs[0].number, 1234)
  assert.deepEqual(data.overlappingPrs[0].overlap, ['frontend/src/a.js'])
  assert.deepEqual(data.notes, [])

  const text = formatReport(data)
  assert.match(text, /Upstream commits not in the fork \(2\)/)
  assert.match(text, /#1234 Overlap/)
  assert.match(text, /already in FORK_CHANGELOG\.md/)
  assert.match(text, /likely conflicts \(1\)/)
  assert.match(text, /Checklist/)
  assert.doesNotThrow(() => JSON.stringify(data))
})

test('collectStatus prints an empty report without inventing data', async () => {
  const emptyGit = fakeGit({
    'rev-parse --abbrev-ref HEAD': 'integration',
    'rev-parse --verify --quiet origin/main': 'aaaaaaa',
    'rev-parse --verify --quiet fork/main': 'bbbbbbb',
    [`show -s --format=%cI ${BASE}`]: '2026-11-16T20:00:00+03:00',
    'log --format=%h%x09%s --no-decorate fork/main..origin/main': '',
    'log --format=%h%x09%s --no-decorate origin/main..HEAD': '',
    [`diff --name-only ${BASE}`]: '',
    'ls-files --others --exclude-standard': '',
    [`diff --name-only ${BASE}...origin/main`]: '',
    'remote get-url origin': null,
  })
  const data = await collectStatus({ git: emptyGit, options: {}, changelog: CHANGELOG })
  assert.deepEqual(data.upstreamCommits, [])
  assert.deepEqual(data.localCommits, [])
  assert.deepEqual(data.likelyConflicts, [])
  assert.deepEqual(data.overlappingPrs, [])
  assert.match(data.notes.join('\n'), /skipped merged PRs/)
  const text = formatReport(data)
  assert.match(text, /Upstream commits not in the fork \(0\)\n  none/)
  assert.match(text, /Local commits not upstream \(0\)\n  none/)
})

test('collectStatus falls back to the git-only sections when the API fails', async () => {
  const data = await collectStatus({
    git: fakeGit(GIT),
    options: {},
    changelog: CHANGELOG,
    fetchImpl: async () => { throw new Error('network down') },
  })
  assert.match(data.notes.join('\n'), /merged PRs skipped: network down/)
  assert.deepEqual(data.overlappingPrs, [])
  assert.equal(data.upstreamCommits.length, 2)
  assert.deepEqual(data.likelyConflicts, ['frontend/src/a.js'])
})

test('collectStatus skips the API without a sync point and says why', async () => {
  const noBaseGit = fakeGit({ ...GIT, [`show -s --format=%cI ${BASE}`]: null })
  const data = await collectStatus({
    git: noBaseGit,
    options: {},
    changelog: 'no base here',
    fetchImpl: async () => { throw new Error('must not be called') },
  })
  assert.equal(data.base, null)
  assert.deepEqual(data.overlappingPrs, [])
  assert.deepEqual(data.likelyConflicts, [])
  assert.match(data.notes.join('\n'), /no sync point/)
  assert.match(data.notes.join('\n'), /skipped merged PRs: needs the last sync point/)
})

test('collectStatus notes a missing token but still asks GitHub', async () => {
  const { impl, calls } = fakeFetch({ pulls: [] })
  const data = await collectStatus({ git: fakeGit(GIT), options: {}, changelog: CHANGELOG, fetchImpl: impl })
  assert.match(data.notes.join('\n'), /unauthenticated/)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].headers.Authorization, undefined)
})

test('parseArgs defaults, flags and validation', () => {
  const defaults = parseArgs([])
  assert.equal(defaults.upstream, 'origin/main')
  assert.equal(defaults.fork, 'fork/main')
  assert.equal(defaults.fetch, false)
  assert.equal(defaults.json, false)

  const parsed = parseArgs(['--json', '--fetch', '--upstream=up/main', '--base', 'abc1234', '--limit', '10'])
  assert.equal(parsed.json, true)
  assert.equal(parsed.fetch, true)
  assert.equal(parsed.upstream, 'up/main')
  assert.equal(parsed.base, 'abc1234')
  assert.equal(parsed.limit, 10)

  assert.throws(() => parseArgs(['--nope']), /unknown option/)
  assert.throws(() => parseArgs(['--limit', '0']), /positive integer/)
  assert.throws(() => parseArgs(['--base']), /needs a value/)
})
