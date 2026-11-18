// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { appKeyAction, isTextField } from './app-keys.js'

const key = (k, extra = {}) => ({ key: k, target: null, ...extra })

describe('appKeyAction', () => {
  it('opens help with ? outside a field and with no sheet', () => {
    expect(appKeyAction(key('?'))).toBe('help')
    expect(appKeyAction(key('?', { shiftKey: true }))).toBe('help')
    expect(appKeyAction(key('?', { shiftKey: true }), { sheetOpen: true })).toBe(null)
    expect(appKeyAction(key('?'), { inField: true })).toBe(null)
  })

  it('focuses search with / only where there is one, and never over a sheet', () => {
    expect(appKeyAction(key('/'), { hasSearch: true })).toBe('search')
    expect(appKeyAction(key('/'))).toBe(null)
    expect(appKeyAction(key('/'), { hasSearch: true, sheetOpen: true })).toBe(null)
    expect(appKeyAction(key('/'), { hasSearch: true, inField: true })).toBe(null)
  })

  it('lets modifiers, repeats, IME and already-handled events through', () => {
    expect(appKeyAction(key('?', { altKey: true }))).toBe(null)
    expect(appKeyAction(key('?', { ctrlKey: true }))).toBe(null)
    expect(appKeyAction(key('?', { metaKey: true }))).toBe(null)
    expect(appKeyAction(key('?', { shiftKey: true, repeat: true }))).toBe(null)
    expect(appKeyAction(key('?', { isComposing: true }))).toBe(null)
    expect(appKeyAction(key('?', { defaultPrevented: true }))).toBe(null)
    expect(appKeyAction(key('/', { shiftKey: true }), { hasSearch: true })).toBe(null)
    expect(appKeyAction(key('Escape'))).toBe(null)
  })
})

describe('isTextField', () => {
  it('recognises inputs, textareas, selects, contenteditable and textbox roles', () => {
    for (const html of ['<input>', '<textarea></textarea>', '<select><option>x</option></select>', '<div contenteditable="true"></div>', '<div role="textbox"></div>']) {
      const el = document.createElement('div')
      el.innerHTML = html
      expect(isTextField(el.firstElementChild), html).toBe(true)
    }
    expect(isTextField(document.createElement('div'))).toBe(false)
    expect(isTextField(null)).toBe(false)
  })
})
