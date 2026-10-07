// Browser-Anbindung: eingebettete Inhalte lesen, localStorage mit Fallback.

import { STORAGE_KEY, createMemoryBackend } from '../engine/storage.js';

/**
 * Reads all `<script type="application/json" id="content-…">` blocks inlined by the build.
 * @param {Document} doc
 * @returns {unknown[]}
 */
export function readEmbeddedUnits(doc) {
  const nodes = doc.querySelectorAll('script[type="application/json"][id^="content-"]');
  return Array.from(nodes, (node) => JSON.parse(node.textContent ?? ''));
}

/**
 * localStorage if readable, otherwise an in-memory stand-in (progress is then lost on close).
 * Only reading is probed: a full quota must not hide existing progress.
 * @param {Window} win
 * @returns {{backend: import('../engine/storage.js').StorageBackend, persistent: boolean}}
 */
export function getBrowserBackend(win) {
  try {
    const storage = win.localStorage;
    storage.getItem(STORAGE_KEY);
    return { backend: storage, persistent: true };
  } catch {
    return { backend: createMemoryBackend(), persistent: false };
  }
}
