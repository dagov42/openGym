# i18n policy

English is the source language. A locale pack (`frontend/src/locales/<lang>.js`) is a translation
of the English strings, keyed by the exact English text; there is no English pack.

This page resolves the two older wordings: `CONTRIBUTING.md` ("new UI strings go into every
locale") and the fork's feature-plan index ("feature PRs ship English only, translations land
separately"). Both describe different PRs, not different policies.

## A feature PR

- Add the new UI string through `t('…')` or `tn('one', 'many', n)`.
- Write English only. Do not edit locale packs in a feature PR.
- Untranslated keys fall back to English; that is expected until a translation batch lands.
- `node scripts/check-source-strings.mjs` is report-only in CI: it may list the new key as
  "defined in no locale pack" until a translator adds it. Do not make that report a gate on a
  feature PR.

## A translation PR

- Add the key to **every** locale pack in the same PR. `check-locales.mjs` compares the union of
  all packs, so a key added to one pack and not the others fails the check.
- Keep the key byte-for-byte: same punctuation, same typographic apostrophe (`’`, not `'`), same
  `{0}`, `{1}` placeholders.
- Portuguese (Brazil) may inherit a key from Portuguese (Portugal); the inheritance fingerprint
  test (`node scripts/pt-br-inheritance-fingerprint.mjs`) records the expected counts.
- The `italianOnlyKeys` list in `check-locales.mjs` is a deliberate, narrow exception for copy
  that is intentionally Italian-only. Do not add to it for ordinary translation work.

## Strings, data and placeholders

- Every `{n}` in the English original must survive, in any order. A translation that loses one
  prints the number out of the sentence; one that invents one prints braces at the reader.
- `tn('{0} result', '{0} results', n)` has two keys; both must be present in every pack.
- Imported file headers and catalogue values are data: they are shown as the file has them, not
  translated through the locale packs. Exercise names and instructions go through `catalogue/`.
- New user-facing text avoids em dashes, in English and in translations.
- Files are UTF-8. An apostrophe that arrives as `вЂ™` is mojibake, not a translation: it will
  silently miss the real key. Fix the source, do not add the broken key to the packs.

## Checks

```bash
cd frontend
node scripts/check-locales.mjs          # parity, blank values, placeholders — a gate
node scripts/check-source-strings.mjs   # keys used in src/ but in no pack — report only
node scripts/check-source-strings.mjs --strict   # optional: make that report fail
node scripts/check-source-strings.mjs --unused   # advisory: pack keys no literal t()/tn() uses
```

`--unused` is not a deletion list. Data labels, `t(variable)` and plural tables resolve keys
dynamically; review a name before removing anything. It is useful for spotting an old feature's
leftovers, not for proving a key dead.

`npm run verify` runs the locale check and the report-only source-string check with the rest of CI.
