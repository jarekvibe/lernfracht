// Die richtige Lösung einer Frage als darstellbare Struktur (für das Feedback-Sheet).

import { formatNumber } from './numbers.js';

/**
 * @typedef {{kind: 'text', text: string}
 *   | {kind: 'list', items: string[], ordered: boolean}
 *   | {kind: 'groups', groups: {title: string, items: string[]}[]}
 *   | {kind: 'cloze', segments: ({text: string}|{gap: string})[]}} Solution
 */

/**
 * Splits cloze text into literal parts (strings) and gap indices (numbers).
 * `"A {0} B {1}"` → `["A ", 0, " B ", 1, ""]`
 * @param {string} text
 * @returns {(string|number)[]}
 */
export function splitCloze(text) {
  return text.split(/\{(\d+)\}/).map((part, i) => (i % 2 === 1 ? Number(part) : part));
}

/**
 * Number with its unit, e.g. `64 %` or `1.280.000 €` (non-breaking space).
 * @param {number} value
 * @param {{unit?: string, decimals?: number}} q
 */
export function formatWithUnit(value, q) {
  const number = formatNumber(value, q.decimals);
  return q.unit ? `${number} ${q.unit}` : number;
}

/**
 * @param {import('./content.js').Question & Record<string, any>} q
 * @returns {Solution}
 */
export function describeSolution(q) {
  switch (q.type) {
    case 'single':
      return { kind: 'text', text: q.options[q.answer] };
    case 'multi':
      return {
        kind: 'list',
        ordered: false,
        items: [...q.answer].sort((a, b) => a - b).map((/** @type {number} */ i) => q.options[i]),
      };
    case 'truefalse':
      return { kind: 'text', text: q.answer ? 'Stimmt' : 'Stimmt nicht' };
    case 'categorize':
      return {
        kind: 'groups',
        groups: q.categories.map((/** @type {string} */ title, c) => ({
          title,
          items: q.items.filter((/** @type {{category: number}} */ item) => item.category === c).map((/** @type {{text: string}} */ item) => item.text),
        })),
      };
    case 'order':
      return { kind: 'list', ordered: true, items: [...q.items] };
    case 'cloze':
      return {
        kind: 'cloze',
        segments: splitCloze(q.text)
          .filter((part) => part !== '')
          .map((part) => (typeof part === 'number' ? { gap: q.gaps[part].answer } : { text: part })),
      };
    case 'numeric':
      return { kind: 'text', text: formatWithUnit(q.answer, q) };
    case 'open':
      return { kind: 'text', text: q.modelAnswer };
    default:
      throw new TypeError(`Unbekannter Fragetyp: ${q.type}`);
  }
}
