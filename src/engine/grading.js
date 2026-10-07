// Bewertung aller 8 Fragetypen inkl. Teilpunkte (SPEC §4.3).
// Antworten beziehen sich auf Content-Indizes. Ergebnis: richtig/falsch für die Wiederholung,
// Anteil 0–1 für XP und Punkte für die Klausur.

/** Klausurpunkte je Typ, wenn die Frage kein `examPoints` hat (categorize/cloze/open: siehe maxPoints()). */
export const DEFAULT_EXAM_POINTS = Object.freeze({ single: 2, multi: 3, truefalse: 1, order: 3, numeric: 3 });

/** `open` gilt als richtig ab diesem Anteil der Rubrikpunkte. */
export const OPEN_PASS_RATIO = 0.6;

/** Toleranz gegen Rundungsrauschen bei Fließkommazahlen. */
const EPSILON = 1e-9;

/**
 * @typedef {Object} Grade
 * @property {boolean} correct counts as "richtig" for spaced repetition
 * @property {number} score share of the points, 0–1
 * @property {number} points exam points (rounded to 2 decimals)
 * @property {number} maxPoints
 * @property {boolean[]} [marks] per part: categorize → per item (content order), order → per position,
 *   cloze → per gap, open → per rubric criterion
 * @property {{right: number, total: number}} [parts] e.g. 4 of 6 items placed correctly
 *
 * @typedef {import('./content.js').Question & Record<string, any>} AnyQuestion
 */

/** @param {number} n */
const round2 = (n) => Math.round(n * 100) / 100;
/** @param {string} s */
const fold = (s) => s.trim().toLocaleLowerCase('de');

/**
 * Maximum exam points of a question.
 * @param {AnyQuestion} q
 * @returns {number}
 */
export function maxPoints(q) {
  if (typeof q.examPoints === 'number') return q.examPoints;
  switch (q.type) {
    case 'categorize':
      return q.items.length;
    case 'cloze':
      return q.gaps.length;
    case 'open':
      return rubricTotal(q);
    default:
      return DEFAULT_EXAM_POINTS[/** @type {keyof typeof DEFAULT_EXAM_POINTS} */ (q.type)];
  }
}

/** @param {AnyQuestion} q */
function rubricTotal(q) {
  return q.rubric.reduce((/** @type {number} */ sum, /** @type {{points: number}} */ r) => sum + r.points, 0);
}

/**
 * @param {AnyQuestion} q
 * @param {boolean} correct
 * @param {number} score
 * @param {Partial<Grade>} [extra]
 * @returns {Grade}
 */
function result(q, correct, score, extra = {}) {
  const max = maxPoints(q);
  const clamped = Math.min(1, Math.max(0, score));
  return { correct, score: clamped, points: round2(clamped * max), maxPoints: max, ...extra };
}

/**
 * @param {AnyQuestion} q
 * @param {number|null} selected content index of the chosen option
 */
export function gradeSingle(q, selected) {
  const correct = selected === q.answer;
  return result(q, correct, correct ? 1 : 0);
}

/**
 * Partial points: max(0, right − wrong) / number of solutions.
 * @param {AnyQuestion} q
 * @param {number[]} selected content indices
 */
export function gradeMulti(q, selected) {
  const solution = new Set(q.answer);
  const chosen = new Set(selected);
  let right = 0;
  let wrong = 0;
  for (const i of chosen) {
    if (solution.has(i)) right += 1;
    else wrong += 1;
  }
  const correct = right === solution.size && wrong === 0;
  return result(q, correct, Math.max(0, right - wrong) / solution.size, { parts: { right, total: solution.size } });
}

/**
 * @param {AnyQuestion} q
 * @param {boolean} value
 */
export function gradeTrueFalse(q, value) {
  const correct = value === q.answer;
  return result(q, correct, correct ? 1 : 0);
}

/**
 * One point per correctly placed item.
 * @param {AnyQuestion} q
 * @param {(number|null)[]} assignment category index per item, content order
 */
export function gradeCategorize(q, assignment) {
  const marks = q.items.map((/** @type {{category: number}} */ item, i) => assignment[i] === item.category);
  const right = marks.filter(Boolean).length;
  return result(q, right === marks.length, right / marks.length, { marks, parts: { right, total: marks.length } });
}

/**
 * Partial points: share of items in the correct position.
 * @param {AnyQuestion} q
 * @param {number[]} order content indices in the learner's order
 */
export function gradeOrder(q, order) {
  const marks = q.items.map((/** @type {string} */ _, position) => order[position] === position);
  const right = marks.filter(Boolean).length;
  return result(q, right === marks.length, right / marks.length, { marks, parts: { right, total: marks.length } });
}

/**
 * One point per correct gap; `alternatives` count as well. Case and outer spaces are ignored.
 * @param {AnyQuestion} q
 * @param {(string|null)[]} filled text per gap
 */
export function gradeCloze(q, filled) {
  const marks = q.gaps.map((/** @type {{answer: string, alternatives?: string[]}} */ gap, i) => {
    const value = filled[i];
    if (typeof value !== 'string') return false;
    return [gap.answer, ...(gap.alternatives ?? [])].some((accepted) => fold(accepted) === fold(value));
  });
  const right = marks.filter(Boolean).length;
  return result(q, right === marks.length, right / marks.length, { marks, parts: { right, total: marks.length } });
}

/**
 * Correct if |value − answer| ≤ tolerance. No partial points.
 * @param {AnyQuestion} q
 * @param {number} value already parsed (see numbers.js)
 */
export function gradeNumeric(q, value) {
  const correct = Number.isFinite(value) && Math.abs(value - q.answer) <= q.tolerance + EPSILON;
  return result(q, correct, correct ? 1 : 0);
}

/**
 * Self-assessment per rubric criterion (Phase 1). Correct from 60 % of the rubric points.
 * @param {AnyQuestion} q
 * @param {boolean[]} met
 */
export function gradeOpen(q, met) {
  const earned = q.rubric.reduce(
    (/** @type {number} */ sum, /** @type {{points: number}} */ r, /** @type {number} */ i) => sum + (met[i] ? r.points : 0),
    0,
  );
  return gradeOpenPoints(q, earned, rubricTotal(q), q.rubric.map((/** @type {unknown} */ _, /** @type {number} */ i) => Boolean(met[i])));
}

/**
 * Turns a provider result (self-assessment now, AI later) into a Grade.
 * @param {AnyQuestion} q
 * @param {import('./ai/provider.js').GradeResult} gradeResult
 */
export function gradeOpenResult(q, gradeResult) {
  return gradeOpenPoints(q, gradeResult.points, gradeResult.maxPoints, gradeResult.criteria.map((c) => c.met));
}

/**
 * @param {AnyQuestion} q
 * @param {number} earned
 * @param {number} total
 * @param {boolean[]} marks
 */
function gradeOpenPoints(q, earned, total, marks) {
  const score = total > 0 ? earned / total : 0;
  return result(q, score + EPSILON >= OPEN_PASS_RATIO, score, { marks, parts: { right: earned, total } });
}

/**
 * Dispatches to the grader of the question type.
 * Answer shapes: single → number · multi → number[] · truefalse → boolean · categorize → (number|null)[] ·
 * order → number[] · cloze → (string|null)[] · numeric → number · open → {met: boolean[]}
 * @param {AnyQuestion} q
 * @param {any} answer
 * @returns {Grade}
 */
export function gradeAnswer(q, answer) {
  switch (q.type) {
    case 'single':
      return gradeSingle(q, answer);
    case 'multi':
      return gradeMulti(q, answer);
    case 'truefalse':
      return gradeTrueFalse(q, answer);
    case 'categorize':
      return gradeCategorize(q, answer);
    case 'order':
      return gradeOrder(q, answer);
    case 'cloze':
      return gradeCloze(q, answer);
    case 'numeric':
      return gradeNumeric(q, answer);
    case 'open':
      return gradeOpen(q, answer.met);
    default:
      throw new TypeError(`Unbekannter Fragetyp: ${q.type}`);
  }
}

/**
 * Which keywords of an `open` question appear in the text (case-insensitive substring).
 * Only a hint for the learner – never part of the grade.
 * @param {AnyQuestion} q
 * @param {string} text
 * @returns {{used: string[], total: number}}
 */
export function keywordHits(q, text) {
  const haystack = text.toLocaleLowerCase('de');
  const keywords = /** @type {string[]} */ (q.keywords ?? []);
  return {
    used: keywords.filter((k) => haystack.includes(k.toLocaleLowerCase('de'))),
    total: keywords.length,
  };
}
