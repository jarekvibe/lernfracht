// Übergabe des Lektionsergebnisses an den Ergebnis-Screen (nur im Speicher, nicht persistent).

/**
 * @typedef {import('../engine/lesson.js').LessonSummary & {unitId: string|null, topicId: string|null, title: string}} LastResult
 */

/** @type {LastResult|null} */
let last = null;

/** @param {LastResult} result */
export function setLastResult(result) {
  last = result;
}

export function getLastResult() {
  return last;
}
