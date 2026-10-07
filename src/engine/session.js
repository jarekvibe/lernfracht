// Session-Builder (SPEC §4.4): welche ~10 Fragen kommen in die nächste Lektion?
// Reine Funktionen, Uhr injiziert.

import { todayLocal } from './dates.js';
import { isDue, isNew } from './scheduler.js';

export const LESSON_LENGTH = 10;
export const MAX_REVIEWS_FIRST = 4;
export const MAX_OPEN_PER_LESSON = 1;
export const MAX_SAME_TYPE_RUN = 3;

/**
 * @typedef {{gid: string, type: string}} SessionQuestion
 * @typedef {Record<string, import('./scheduler.js').Card>} Cards
 */

/** @param {string|null|undefined} a @param {string|null|undefined} b */
const compareDates = (a, b) => (a ?? '').localeCompare(b ?? '');

/**
 * Picks questions with a per-lesson limit for `open`.
 * @param {number} length
 */
function picker(length) {
  /** @type {SessionQuestion[]} */
  const picked = [];
  const pickedIds = new Set();
  let open = 0;
  return {
    picked,
    has: (/** @type {string} */ gid) => pickedIds.has(gid),
    full: () => picked.length >= length,
    /** @param {SessionQuestion} q @returns {boolean} taken */
    take(q) {
      if (picked.length >= length || pickedIds.has(q.gid)) return false;
      if (q.type === 'open') {
        if (open >= MAX_OPEN_PER_LESSON) return false;
        open += 1;
      }
      picked.push(q);
      pickedIds.add(q.gid);
      return true;
    },
  };
}

/**
 * Most overdue first, then least recently answered, then path order.
 * @param {Cards} cards
 * @param {Map<string, number>} order
 */
const byOverdue = (cards, order) => (/** @type {SessionQuestion} */ a, /** @type {SessionQuestion} */ b) =>
  compareDates(cards[a.gid]?.due, cards[b.gid]?.due)
  || compareDates(cards[a.gid]?.lastAnswered, cards[b.gid]?.lastAnswered)
  || /** @type {number} */ (order.get(a.gid)) - /** @type {number} */ (order.get(b.gid));

/**
 * Builds a lesson.
 * 1. up to 4 due reviews (most overdue first)
 * 2. new questions in path order (current topic, then the next one)
 * 3. no new ones left → more due reviews → then consolidate (lowest box, oldest first)
 * At most one `open` question; more than 3 of the same type in a row is softly avoided.
 * „Thema üben“ / Kann-Liste-Zeile: same logic, `questions` restricted to that scope.
 * @param {Object} input
 * @param {SessionQuestion[]} input.questions candidates in path order (topic order, then content order)
 * @param {Cards} input.cards
 * @param {() => number} input.now
 * @param {number} [input.length]
 * @returns {string[]} gids in lesson order
 */
export function buildSession({ questions, cards, now, length = LESSON_LENGTH }) {
  const today = todayLocal(now);
  const order = new Map(questions.map((q, i) => [q.gid, i]));
  const pick = picker(length);

  const due = questions.filter((q) => isDue(cards[q.gid], today)).sort(byOverdue(cards, order));
  let reviews = 0;
  for (const q of due) {
    if (reviews >= MAX_REVIEWS_FIRST || pick.full()) break;
    if (pick.take(q)) reviews += 1;
  }
  for (const q of questions) if (isNew(cards[q.gid])) pick.take(q);
  for (const q of due) pick.take(q);

  const consolidate = questions
    .filter((q) => !pick.has(q.gid) && !isNew(cards[q.gid]))
    .sort((a, b) => cards[a.gid].box - cards[b.gid].box || byOverdue(cards, order)(a, b));
  for (const q of consolidate) pick.take(q);

  return spreadTypes(pick.picked).map((q) => q.gid);
}

/**
 * „Fehler üben“: only questions in the mistake box, most overdue first.
 * @param {Object} input
 * @param {SessionQuestion[]} input.questions candidates in path order
 * @param {Cards} input.cards
 * @param {number} [input.length]
 * @returns {string[]}
 */
export function buildMistakeSession({ questions, cards, length = LESSON_LENGTH }) {
  const order = new Map(questions.map((q, i) => [q.gid, i]));
  const pick = picker(length);
  const inBox = questions.filter((q) => cards[q.gid]?.inMistakeBox).sort(byOverdue(cards, order));
  for (const q of inBox) pick.take(q);
  return spreadTypes(pick.picked).map((q) => q.gid);
}

/**
 * Softly avoids more than `maxRun` questions of the same type in a row by pulling a later
 * question of another type forward. Leaves the order alone where that is impossible.
 * @template {{type: string}} T
 * @param {T[]} items
 * @param {number} [maxRun]
 * @returns {T[]}
 */
export function spreadTypes(items, maxRun = MAX_SAME_TYPE_RUN) {
  const out = [...items];
  for (let i = maxRun; i < out.length; i += 1) {
    const type = out[i].type;
    const run = out.slice(i - maxRun, i).every((x) => x.type === type);
    if (!run) continue;
    const j = out.findIndex((x, k) => k > i && x.type !== type);
    if (j === -1) break;
    const [moved] = out.splice(j, 1);
    out.splice(i, 0, moved);
  }
  return out;
}
