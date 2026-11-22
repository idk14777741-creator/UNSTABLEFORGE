/**
 * The elevated organizer token is a short-lived session credential. It lives in
 * sessionStorage only, so closing the tab ends organizer mode, and it is dropped
 * when it expires.
 */
const KEY = 'unstableforge.organizer.v1'

export function readElevated() {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.expiresAt) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveElevated(session) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Organizer mode still works for this page load.
  }
}

export function clearElevated() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}
