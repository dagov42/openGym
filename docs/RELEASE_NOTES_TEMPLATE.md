# Release notes template

Fork releases are read by Russian-speaking users first, so every release note carries the same
feature descriptions twice: once in English and once in Russian. A release is not ready while the
Russian block is missing.

## Required shape

```markdown
# openGym X.Y.Z

**Release date:** DD Month YYYY
**Version:** `X.Y.Z`
**Android versionCode:** `NNNNN`

One short paragraph about the release.

## Highlights

- English bullet.

## Features

- English bullet.

## По-русски

Краткое описание релиза на русском.

### Главное

- Русский пункт.

### Новые функции

- Русский пункт, повторяющий английские описания.

## Install

...
```

## Rules

- The Russian block repeats **every feature bullet**, not only the highlights. It may be grouped
  under the same headings as the English part.
- Keep commands, paths, version numbers, API names and code identifiers unchanged.
- Translate user-facing wording; do not translate literal keys such as `S.exGoals`.
- Write plain Russian without em dashes. Use «ё» where the app does.
- A small patch release still gets a Russian block, even when it has one bullet.
- Put the Russian block before `## Install`, so it is visible in the GitHub release body before the
  installation instructions.

The current example is [RELEASE_NOTES_1.4.10.md](RELEASE_NOTES_1.4.10.md).
