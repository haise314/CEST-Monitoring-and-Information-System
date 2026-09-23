// Remembers "who's using this browser" for attributing remarks, without
// any real authentication. Deliberately per-browser, not per-account —
// if two people share a machine, the "not you?" link in RemarksSection
// lets them switch it.

const STORAGE_KEY = 'cest_remark_author'

export function getSavedAuthor() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAuthor(name) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // localStorage unavailable (private browsing, etc.) — remark posting
    // still works, it just won't remember the name next time.
  }
}