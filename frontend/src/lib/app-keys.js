// The app-wide keys that are not the workout's own. The workout keys stay in lib/workout-keys.js;
// this decides only when `?` opens the list and `/` goes to the current screen's search.
const TEXT = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'

export function isTextField(el) {
  if (!el) return false
  if (el.isContentEditable) return true
  return typeof el.closest === 'function' && !!el.closest(TEXT)
}

/**
 * 'help' for `?`, 'search' for `/` when the current screen has a search field, else null.
 * A focused field, any sheet, an IME composition, a repeat or a system modifier means the key
 * belongs to someone else. Escape is left to the sheet system.
 */
export function appKeyAction(event, { inField = false, sheetOpen = false, hasSearch = false } = {}) {
  if (!event || event.defaultPrevented || event.repeat || event.isComposing) return null
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  if (inField) return null
  // Shift is only part of `?` on most layouts; `Shift+/` is the question mark itself.
  if (event.shiftKey && event.key !== '?') return null
  if (event.key === '?') return sheetOpen ? null : 'help'
  if (event.key === '/') return !sheetOpen && hasSearch ? 'search' : null
  return null
}
