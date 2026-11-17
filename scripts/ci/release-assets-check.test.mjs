import { test } from 'node:test'
import assert from 'node:assert/strict'
import { problems, requiredKindsFor } from './release-assets-check.mjs'

const HASH = 'a'.repeat(64)
const apk = (name, size = 2_000_000) => ({ name, size, state: 'uploaded' })
const sums = (name, hash = HASH) => ({ name: 'SHA256SUMS', size: 100, state: 'uploaded', __text: `${hash}  ${name}\n` })
const perApk = (name, hash = HASH) => ({ name: `${name}.sha256`, size: 100, state: 'uploaded', __text: `${hash}  ${name}\n` })
// The real release carries the checksum files as assets too; only their content is passed in.
const release = (tag, assets, published = '2026-11-17T00:00:00Z') => ({ tag_name: tag, assets, published_at: published, draft: false, prerelease: false })
const textsOf = (assets) => Object.fromEntries(assets.filter(a => a.__text).map(a => [a.name, a.__text]))
const withChecksums = (name, assets = [apk(name)], { hash = HASH, withPerApk = true } = {}) => [
  ...assets,
  sums(name, hash),
  ...(withPerApk ? [perApk(name, hash)] : []),
]

test('a fork that has only ever shipped Standard passes with standard required', () => {
  const name = 'openGym-1.4.9.apk'
  const assets = withChecksums(name)
  assert.deepEqual(problems(release('v1.4.9', assets), textsOf(assets), null, ['standard']), [])
})

test('the default (upstream) requirement still demands Plus and HD', () => {
  const name = 'openGym-1.4.9.apk'
  const assets = withChecksums(name)
  const found = problems(release('v1.4.9', assets), textsOf(assets))
  assert.ok(found.some(p => p.startsWith('no plus APK')), found.join('; '))
  assert.ok(found.some(p => p.startsWith('no hd APK')), found.join('; '))
})

test('a missing per-APK checksum is named', () => {
  const name = 'openGym-1.4.9.apk'
  const assets = withChecksums(name, [apk(name)], { withPerApk: false })
  const found = problems(release('v1.4.9', assets), textsOf(assets), null, ['standard'])
  assert.ok(found.some(p => p.includes(`${name}.sha256 is missing`)), found.join('; '))
})

test('SHA256SUMS and the per-APK file must agree', () => {
  const name = 'openGym-1.4.9.apk'
  const assets = [apk(name), sums(name, 'b'.repeat(64)), perApk(name)]
  const found = problems(release('v1.4.9', assets), textsOf(assets), null, ['standard'])
  assert.ok(found.some(p => p.includes('SHA256SUMS and') && p.includes('disagree')), found.join('; '))
})

test('an asset the previous release carried must be there with the new version', () => {
  const previous = release('v1.4.8.1', [apk('openGym-1.4.8.1.apk')])
  const name = 'openGym-1.4.9.apk'
  const assets = withChecksums(name)
  assert.deepEqual(problems(release('v1.4.9', assets), textsOf(assets), previous, ['standard']), [],
    'same name with the version swapped is present')
  const offline = 'openGym-1.4.9-offline.apk'
  const onlyOffline = withChecksums(offline)
  const absent = problems(release('v1.4.9', onlyOffline), textsOf(onlyOffline), previous, ['standard'])
  assert.ok(absent.some(p => p.includes('openGym-1.4.9.apk is missing')), absent.join('; '))
})

test('requiredKindsFor reads the kinds the last release with APKs shipped', () => {
  const history = [
    release('v1.4.8.1', [], '2026-11-17T18:00:00Z'),
    release('v1.4.8', [], '2026-11-17T17:00:00Z'),
    release('v1.4.6', [apk('openGym-1.4.6.apk')], '2026-11-15T18:00:00Z'),
  ]
  assert.deepEqual(requiredKindsFor(history, 'v1.4.9'), ['standard'])

  const upstream = [release('v1.4.5', [apk('openGym-1.4.5.apk'), apk('openGym-Plus-1.4.5.apk'), apk('openGym-HD-1.4.5.apk'), apk('openGym-Offline-1.4.5.apk')], '2026-11-14T00:00:00Z')]
  assert.deepEqual(requiredKindsFor(upstream, 'v1.4.9'), ['standard', 'plus', 'hd'])

  assert.deepEqual(requiredKindsFor([], 'v1.4.9'), ['standard', 'plus', 'hd'], 'no history falls back to every kind')
})

test('an Offline APK neither satisfies Standard nor hides its absence', () => {
  const name = 'openGym-Offline-1.4.9.apk'
  const assets = withChecksums(name)
  const found = problems(release('v1.4.9', assets), textsOf(assets), null, ['standard'])
  assert.ok(found.some(p => p.startsWith('no standard APK')), found.join('; '))
})

test('an APK under a megabyte is refused', () => {
  const name = 'openGym-1.4.9.apk'
  const assets = withChecksums(name, [apk(name, 900_000)])
  const found = problems(release('v1.4.9', assets), textsOf(assets), null, ['standard'])
  assert.ok(found.some(p => p.includes('only 900000 bytes')), found.join('; '))
})
