#!/usr/bin/env node
// The companion to check-locales.mjs, which compares the locale packs to each other and so
// cannot see a key that is missing from all of them: that renders English in every language
// while every check stays green. This walks src/ instead, collects the literals actually
// passed to t(), and reports the ones no pack defines.
//
//   node scripts/check-source-strings.mjs          # report only, exit 0
//   node scripts/check-source-strings.mjs --strict # exit 1 if anything is missing
//   node scripts/check-source-strings.mjs --unused # also report pack keys no literal t()/tn() uses
//
// The unused report is advisory, not a gate: many locale keys are resolved through a variable
// (data labels such as muscles and equipment, t(name), plural tables), so a key that is not
// passed literally can still be live. Review names; never delete in bulk from this report alone.
//
// English is the source language and has no pack, so the key IS the English string.
// Only literal single-argument calls are collected — t(variable) and template literals are
// resolved at runtime and are deliberately out of scope.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const localesDir = join(srcDir, 'locales')
const strict = process.argv.includes('--strict')
const unusedRequested = process.argv.includes('--unused')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (p === localesDir || name === 'instr' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

// t('literal') / t("literal") — preceded by a non-identifier char so DateTimeFormat( misses.
const CALL = /(^|[^A-Za-z0-9_$.])t\(\s*(['"])((?:\\.|(?!\2)[^\\])*)\2/g
// tn('one', 'many') carries both keys.
const TN = /(^|[^A-Za-z0-9_$.])tn\(\s*(['"])((?:\\.|(?!\2)[^\\])*)\2\s*,\s*(['"])((?:\\.|(?!\4)[^\\])*)\4/g

const used = new Map()
const mark = (key, file) => {
  if (!key) return
  if (!used.has(key)) used.set(key, new Set())
  used.get(key).add(relative(root, file))
}
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(CALL)) mark(m[3].replace(/\\(['"\\])/g, '$1'), file)
  for (const m of text.matchAll(TN)) {
    mark(m[3].replace(/\\(['"\\])/g, '$1'), file)
    mark(m[5].replace(/\\(['"\\])/g, '$1'), file)
  }
}

const defined = new Set()
for (const file of readdirSync(localesDir).filter(f => f.endsWith('.js'))) {
  const pack = (await import(pathToFileURL(join(localesDir, file)).href)).default
  for (const key of Object.keys(pack)) defined.add(key)
}

const packs = readdirSync(localesDir).filter(f => f.endsWith('.js')).length
const missing = [...used.keys()].filter(k => !defined.has(k)).sort()
const unused = [...defined].filter(k => !used.has(k)).sort()

function printUnused() {
  if (!unusedRequested) return
  console.log(`\n${unused.length} pack keys are not passed to a literal t()/tn() in src/.`)
  console.log('Dynamic keys (data labels, t(variable), plural tables) are live too; review, do not delete in bulk.')
  for (const key of unused.slice(0, 100)) console.log(`  ${JSON.stringify(key)}`)
  if (unused.length > 100) console.log(`  … ${unused.length - 100} more`)
}

if (!missing.length) {
  console.log(`${used.size} translated strings in src/, all present in the locale packs.`)
  printUnused()
  process.exit(0)
}

console.log(`${used.size} translated strings in src/, ${missing.length} defined in no locale pack:\n`)
for (const key of missing) {
  console.log(`  ${JSON.stringify(key)}`)
  for (const f of [...used.get(key)].sort()) console.log(`      ${f}`)
}
console.log(`\nThese render English in all ${packs} translated languages.`)
printUnused()
process.exit(strict ? 1 : 0)
