// Fokus über ein Neu-Rendern hinweg halten (Tastatur- und Screenreader-Nutzung).

/**
 * Re-focuses the element with the same `data-focus` key after a re-render.
 * @param {HTMLElement} root
 * @param {string|undefined|null} key
 */
export function restoreFocus(root, key) {
  if (!key) return;
  const target = /** @type {HTMLElement|null} */ (root.querySelector(`[data-focus="${key}"]`));
  if (target && !(/** @type {HTMLButtonElement} */ (target).disabled)) target.focus();
}

/**
 * The `data-focus` key of the focused element if it lives inside root.
 * @param {HTMLElement} root
 */
export function focusedKey(root) {
  const active = /** @type {HTMLElement|null} */ (document.activeElement);
  return active && root.contains(active) ? active.dataset.focus : undefined;
}
