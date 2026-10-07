// Darstellung einer Frage vorbereiten: Optionen, Items und Wortbank mischen.
// Antworten beziehen sich immer auf die Indizes im Content, nie auf die gemischte Position.

import { shuffle } from './random.js';

/**
 * @typedef {Object} Presentation
 * @property {number[]} [optionOrder] single/multi: content indices in display order
 * @property {number[]} [itemOrder] categorize: content indices in display order
 * @property {number[]} [start] order: content indices in the initial (never already solved) order
 * @property {{id: string, text: string}[]} [wordBank] cloze: solutions + distractors, mixed
 */

/** @param {number} n */
const indices = (n) => Array.from({ length: n }, (_, i) => i);

/**
 * @param {import('./content.js').Question & Record<string, any>} question
 * @param {() => number} rng
 * @returns {Presentation}
 */
export function prepareQuestion(question, rng) {
  switch (question.type) {
    case 'single':
    case 'multi':
      return { optionOrder: shuffle(indices(question.options.length), rng) };
    case 'categorize':
      return { itemOrder: shuffle(indices(question.items.length), rng) };
    case 'order':
      return { start: unsolvedOrder(question.items.length, rng) };
    case 'cloze':
      return {
        wordBank: shuffle(
          [
            ...question.gaps.map((/** @type {{answer: string}} */ gap, i) => ({ id: `g${i}`, text: gap.answer })),
            ...question.distractors.map((/** @type {string} */ text, i) => ({ id: `d${i}`, text })),
          ],
          rng,
        ),
      };
    default:
      return {};
  }
}

/**
 * A shuffled order that is not already the solution (the learner must actually sort).
 * @param {number} n
 * @param {() => number} rng
 * @returns {number[]}
 */
function unsolvedOrder(n, rng) {
  const solved = indices(n);
  if (n < 2) return solved;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = shuffle(solved, rng);
    if (candidate.some((v, i) => v !== i)) return candidate;
  }
  return [...solved.slice(1), solved[0]];
}
