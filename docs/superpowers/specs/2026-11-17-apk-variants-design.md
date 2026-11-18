# APK variants: Standard, Plus and HD

Status: agreed 2026-11-17 (the owner's calls: the release carries all three APKs first, the in-app
switch follows; sideload Android only). Phase A is release work, phase B is the feature. Nothing
implemented yet. Current releases ship the Standard APK only: the fork has no Gym visual licence for
the 240 and 360 px animations, and NOTICE.md forbids extracting them from a published APK. Plus and
HD stay planned for when a licence exists.

## Why

The sideloaded app is built once per animation size, and the APK knows which one it is
(`frontend/src/lib/apk-variant.js`): Standard carries 180 px animations, Plus 240 px, HD 360 px.
The updater already keeps each kind on its own kind (`pickApk` in `frontend/src/lib/update.js`),
and Settings shows which kind is installed. The fork has only ever published the Standard APK, so
Plus and HD exist in the code and in `scripts/android/build-release.sh` but a phone has no way to
choose them: the releases page is the only path, and the app cannot tell what is available.

The sharper animations are licensed for APKs and store packages only (NOTICE.md, Part B), so the
variants are built on the release machine, never in CI.

## Goals

1. Every release carries the Standard, Plus and HD APKs, each with its own `.sha256`, all listed
   in `SHA256SUMS`, and a GPG-signed `SHA256SUMS.asc`.
2. Settings gives a phone the other two variants that the latest release carries, next to the
   variant it already shows.
3. Choosing one downloads that APK, verifies its checksum, installs it over the same package, and
   keeps the profile: the signing key and the application id do not change.
4. After a switch the updater follows the new kind, exactly as `pickApk` already does.
5. No new profile field, no sync change, no server call beyond the existing GitHub release API.

## Non-goals

- Changing animation quality at runtime without installing another APK. The clips are baked in.
- The iPhone and Google Play builds: the stores deliver quality through asset packs, and neither
  has an APK to switch.
- Downgrades: only the latest release's variants are offered.
- Automatic switching by network, storage or battery.

## Anti-goals

- Quietly substituting another variant when the chosen one is missing. The updater already refuses
  that, and the switch must too.
- Offering a variant whose APK is not in the release.
- A second signing key, or a build without full-size media pretending to be Plus or HD.
- Full-size media in the repository, CI, the demo or a self-hosted server.
- Extracting the 240/360 px media from a published APK, the upstream one included. `NOTICE.md`
  forbids third parties extracting or integrating the animations, and a non-commercial fork may
  keep only the unmodified 180 px media without its own Gym visual licence. The quality folders
  come from the maintainer's licensed copy, or from a licence the fork obtained itself.

## Data

The only new pure logic is a reader over the GitHub release's own asset list:

- `frontend/src/lib/apk-variant.js` already exports `APK_VARIANTS`, `APK_VARIANT` (the kind this
  build is) and `VARIANT_NAMES`.
- `frontend/src/lib/update.js` already exports `pickApk(assets, variant)`, `apkKind(name)` and the
  release fetch. It gains `apkVariantChoices(assets)`, returning, in `APK_VARIANTS` order, one entry
  per kind present in the release:
  `{ variant, name, size, url, hashUrl }` where `hashUrl` is the APK's own `.sha256` (the combined
  `SHA256SUMS` fallback stays inside the existing download path, not in this list).
- No new API route, no stored state. The list is read from the same `latest release` response
  `checkForUpdate` already fetches.

## Phase A: the release carries all three

- On the release machine, `scripts/android/build-release.sh` with `PLUS_PX=240` and `HD_PX=360`
  (both already supported; `PLUS_PX=0`/`HD_PX=0` remain the escape hatches). Same keystore, alias
  and password for all three; the script already signs each with the same key and writes its
  `.sha256`. The quality folders are the maintainer's licensed copy, never an extraction from a
  published APK (see Anti-goals). A fork without its own Gym visual licence ships Standard only.
- `upload-release.sh` uploads every `openGym-*<version>.apk`, its `.sha256`, `SHA256SUMS` and the
  GPG `SHA256SUMS.asc`. `release-assets-check` reads the kinds the last release with APKs shipped
  (`requiredKindsFor`, added 2026-11-17), so the first release with Plus and HD makes them required
  in every later release. Do not publish a release that drops one.
- Sizes, from GitHub's `size` on the asset and `docs/APP_STORES.md`: the Standard APK is about
  229 MB today, Plus and HD are substantially larger. The release page and the switch sheet show
  the real bytes, not an estimate.
- Docs: `FORK_VERSIONING.md` section 3 (artifact names), `RELEASE_CONTEXT.local.md` section 11 and
  `docs/APP_STORES.md` if the sizes or flags change.
- Version: the first release with all three is a normal patch, at least `1.4.9`. A phone on `1.4.8`
  sees it with the old three-number comparator; a phone on `1.4.4` or `1.4.6` still cannot install
  because the Android signing key changed (RELEASE_CONTEXT, section 2).

## Phase B: the switch

### Where it shows

- Settings, About, under the existing Version row. That row already reads
  "{Variant} APK, animations at {px} px" (`Settings.jsx:1266`).
- A second row, "Animations" (or "APK variant"), opens a small sheet. It shows Standard, Plus and
  HD in that order, the installed one marked, the download size next to each, and the version the
  release carries.
- Only on Android, only for a sideloaded APK that updates itself (`MOBILE && selfUpdate`), never in
  the Offline build, on iOS or on a Play install. Everywhere else the row is absent, as the update
  row already is.

### What a tap does

1. Pick the variant's APK and its `.sha256` from the latest release; verify the file before
   installing (the same check the updater does, `UpdateNotice.jsx` and `lib/update.js`).
2. Install over the running app. Android updates in place because the application id and the
   signing key match; the profile is untouched.
3. After the installer returns, the app is the other variant: `APK_VARIANT` comes from the new
   APK, and the next update follows that kind.
4. If the release's version is newer than the installed one, the same tap is also an update. The
   sheet says which version will be installed. If it is the same version, the tap reinstalls the
   chosen variant.

### Wording and edge cases

- The row says which variants the release carries when some are missing ("This release has
  Standard only"), so there is no dead button and no silent fallback.
- The sheet shows the size, and warns when the phone says it is on a metered connection
  (`navigator.connection.saveData` or `type === 'cellular'` when available), without blocking it.
- A signature mismatch (an old-key install, see RELEASE_CONTEXT section 2) says plainly that the
  old app has to be uninstalled after a backup, rather than looping a failed install.
- A checksum mismatch installs nothing and names the file.
- Choosing the variant already installed does nothing but close the sheet.
- HD to Standard is a normal switch (a smaller download, the same data).
- Offline or a rate-limited GitHub answers with the existing update error, not a new one.
- Strings go through `t()`/`tn()`. Per the index's decision, the feature ships the English source
  and the locale packs are updated separately; untranslated packs fall back to English.

## Where the logic lives

- `frontend/src/lib/apk-variant.js`: unchanged, already the source of kinds and names.
- `frontend/src/lib/update.js`: `apkVariantChoices(assets)` beside `pickApk`; the existing fetch
  and checksum plumbing is reused.
- `frontend/src/views/Settings.jsx`: the row and the sheet; `components/UpdateNotice.jsx` already
  owns the download and install path and is reused or lifted into a helper.
- Tests beside each: `apk-variant.test.js`, `update.test.js`, `Settings` UI tests.
- No new dependency; no server, sync or token change.

## Tests

- `apkVariantChoices`: all three present; only Standard; Standard and Plus; order; sizes; a
  variant with no `.sha256` is still listed but installing it fails closed through the existing
  checksum path.
- `pickApk` for each kind (already covered; keep the "no fallback when missing" case).
- Settings: the row appears only for Android sideload; the installed variant is marked; a missing
  variant is explained, not tappable; a checksum failure surfaces and installs nothing.
- Release check: a fork history with Standard only passes (already), and the first release with
  Plus and HD makes them required afterwards (already, `requiredKindsFor`).
- No network in tests: the release JSON is a fixture, as `update.test.js` already does.

## Phase 2 (not this spec)

- Runtime quality selection if animations ever move out of the APK (Play asset packs already do
  this; iOS uses hosted packs).
- Automatic choice by network, storage or battery.
- A download page outside the app that understands the three kinds.

## Decisions and open questions

1. **Order:** release first, switch second. The switch is useless while the release has only
   Standard, and the release work needs no app code. Decided 2026-11-17.
2. **First release with all three:** 1.4.9 or later. Decided 2026-11-17.
3. **Row placement:** Settings, About, under Version. Proposed; it is where the current variant is
   already named.
4. **Metered connection:** show a hint, never block. Proposed; the user owns the decision.
5. **Down-switching HD to Standard:** allowed, same flow. Proposed.
