// Haptik über navigator.vibrate – nur wo verfügbar und wenn in den Einstellungen an.

/**
 * @param {{get: () => {profile: {haptics: boolean}}}} store
 * @param {number|number[]} pattern
 */
export function vibrate(store, pattern) {
  try {
    if (store.get().profile.haptics && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Haptik ist Komfort – Fehler ignorieren.
  }
}
