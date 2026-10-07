// Übergabe des Lektionsergebnisses an den Ergebnis-Screen (nur im Speicher, nicht persistent).

/**
 * @typedef {import('../engine/lesson.js').LessonSummary & {
 *   unitId: string|null, topicId: string|null, canDoId: string|null, title: string,
 *   xp: number, streakBefore: number, streakAfter: number, badges: string[],
 *   league: {rank: number, tierName: string},
 *   goal: {xp: number, before: number, after: number},
 * }} LastResult
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
