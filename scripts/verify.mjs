#!/usr/bin/env node
// One command for the checks CI runs, so a release does not go out with a green local suite and a
// red workflow:
//
//   node scripts/verify.mjs                 the checks, then frontend, api and mcp suites
//   node scripts/verify.mjs --checks-only   only the static checks (fast, for a release)
//   node scripts/verify.mjs --tag v1.4.9    also run scripts/ci/release-check.mjs for that tag
//
// The suites spawn Node (vitest workers); this script itself only starts child processes, so it
// is the one place that knows the order and names. Root dependencies (js-yaml) are needed by the
// API docs check: run `npm ci` in the repository root once.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const checksOnly = args.includes('--checks-only')
const tagAt = args.indexOf('--tag')
const tag = tagAt >= 0 ? args[tagAt + 1] : null
if (tagAt >= 0 && (!tag || tag.startsWith('--'))) {
  console.error('--tag needs a value, e.g. --tag v1.4.9')
  process.exit(2)
}

const isWindows = process.platform === 'win32'
const npm = isWindows ? 'npm.cmd' : 'npm'
const node = process.execPath
const results = []

function run(label, command, argv, { cwd = root, env = {} } = {}) {
  process.stdout.write(`\n=== ${label} ===\n`)
  const started = Date.now()
  const res = spawnSync(command, argv, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    // npm is a .cmd shim on Windows; a shell is the portable way to start it.
    shell: isWindows && /\.cmd$/i.test(command),
  })
  const ok = res.status === 0
  results.push({ label, ok, ms: Date.now() - started, status: res.status, error: res.error })
  if (!ok) console.error(`\n${label}: FAILED (${res.error ? res.error.message : `exit ${res.status}`})`)
}

// Fast checks first: a stale generated file or a locale gap should stop a release before the
// suites spend minutes proving the rest.
run('locales', node, ['frontend/scripts/check-locales.mjs'])
run('untranslated strings (report)', node, ['frontend/scripts/check-source-strings.mjs'])
run('catalogue generated files', node, ['scripts/catalogue/build.mjs', '--check'])
run('coach assets', node, ['scripts/build-coach-assets.mjs', '--check'])
run('API docs', node, ['scripts/build-api-docs.mjs', '--check'])
run('Garmin watch app', node, ['frontend/garmin/check.mjs'])
if (tag) run(`release check ${tag}`, node, ['scripts/ci/release-check.mjs', tag])

if (!checksOnly) {
  const testEnv = { NODE_ENV: 'test' }
  run('frontend suite', npm, ['test'], { cwd: path.join(root, 'frontend'), env: testEnv })
  run('api suite', npm, ['test'], { cwd: path.join(root, 'api'), env: testEnv })
  run('mcp suite', npm, ['test'], { cwd: path.join(root, 'mcp'), env: testEnv })
}

const failed = results.filter(r => !r.ok)
const summary = results.map(r => `${r.ok ? 'ok  ' : 'FAIL'} ${r.label} (${(r.ms / 1000).toFixed(1)} s)`).join('\n')
console.log(`\n=== verify ===\n${summary}`)
if (failed.length) {
  console.error(`\n${failed.length} step(s) failed: ${failed.map(r => r.label).join(', ')}`)
  process.exit(1)
}
console.log(`\nall ${results.length} step(s) passed`)
