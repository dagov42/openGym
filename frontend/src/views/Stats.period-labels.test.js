// Stats period pickers used to carry English labels as literals: 30d, 90d, 1Y stayed English in
// every language. They now go through t(), and the Russian pack spells them as short units.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ru from '../locales/ru.js'

const stats = readFileSync(resolve(process.cwd(), 'src/views/Stats.jsx'), 'utf8')

describe('Stats period labels', () => {
  it('uses translation keys in the effort and range pickers', () => {
    expect(stats).toContain("label: t('30d')")
    expect(stats).toContain("label: t('90d')")
    expect(stats).toContain("label: t('1Y')")
    expect(stats).toContain("label: t('1M')")
    expect(stats).toContain("label: t('3M')")
    expect(stats).not.toMatch(/label: '(?:30d|90d|1Y|1M|3M)'/)
  })

  it('has compact Russian forms', () => {
    expect(ru['30d']).toBe('30 д')
    expect(ru['90d']).toBe('90 д')
    expect(ru['1Y']).toBe('1 г')
    expect(ru['1M']).toBe('1 мес.')
    expect(ru['3M']).toBe('3 мес.')
  })
})
