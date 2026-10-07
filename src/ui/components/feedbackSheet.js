import { h } from '../dom.js';
import { icon } from './icon.js';
import { describeSolution } from '../../engine/solution.js';
import { formatNumber } from '../../engine/numbers.js';

/**
 * @typedef {import('../../engine/grading.js').Grade} Grade
 * @typedef {import('../../engine/content.js').Question & Record<string, any>} AnyQuestion
 */

const INLINE_CORRECTION_TYPES = new Set(['categorize', 'order', 'cloze', 'open']);

/**
 * Headline after checking (SPEC §6 microcopy).
 * @param {Grade} grade
 */
export function feedbackTitle(grade) {
  // ASSUMPTION: Für Teilpunkte eine eigene Zeile („Teilweise richtig“) neben den SPEC-Beispielen.
  if (grade.correct) return 'Sauber.';
  return grade.score > 0 ? 'Teilweise richtig – schau mal:' : 'Knapp daneben – schau mal:';
}

/**
 * One line like „4 von 6 richtig zugeordnet“, or null when there is nothing to count.
 * @param {AnyQuestion} q
 * @param {Grade} grade
 */
export function feedbackDetail(q, grade) {
  const parts = grade.parts;
  if (!parts) return null;
  switch (q.type) {
    case 'categorize':
      return `${parts.right} von ${parts.total} richtig zugeordnet${grade.correct ? '' : ' – Korrektur steht oben'}`;
    case 'order':
      return `${parts.right} von ${parts.total} an der richtigen Stelle${grade.correct ? '' : ' – Korrektur steht oben'}`;
    case 'cloze':
      return `${parts.right} von ${parts.total} Lücken richtig${grade.correct ? '' : ' – Korrektur steht oben'}`;
    case 'multi':
      return grade.correct ? null : `${formatNumber(grade.points)} von ${formatNumber(grade.maxPoints)} Punkten`;
    case 'open':
      return `${formatNumber(parts.right)} von ${formatNumber(parts.total)} Punkten (Selbsteinschätzung)`;
    default:
      return null;
  }
}

/** @param {import('../../engine/solution.js').Solution} solution */
function solutionNode(solution) {
  switch (solution.kind) {
    case 'text':
      return h('p', null, solution.text);
    case 'list':
      return h(solution.ordered ? 'ol' : 'ul', null, solution.items.map((item) => h('li', null, item)));
    case 'groups':
      return h(
        'div',
        { class: 'solution-groups' },
        solution.groups.map((group) =>
          h('div', null, h('p', { class: 'solution-group-title' }, group.title), h('ul', null, group.items.map((item) => h('li', null, item)))),
        ),
      );
    case 'cloze':
      return h('p', null, solution.segments.map((s) => ('gap' in s ? h('mark', null, s.gap) : s.text)));
    default:
      return null;
  }
}

/**
 * Bottom sheet after checking: green/red, solution, explanation, source, hint for supplemented content.
 * @param {Object} options
 * @param {AnyQuestion} options.question
 * @param {Grade} options.grade
 * @param {string} options.explanation
 * @param {string} options.nextLabel
 * @param {() => void} options.onNext
 */
export function feedbackSheet({ question, grade, explanation, nextLabel, onNext }) {
  const detail = feedbackDetail(question, grade);
  // ASSUMPTION: Zuordnen, Reihenfolge und Lückentext zeigen die Korrektur direkt an der Antwort,
  // bei `open` steht die Musterlösung schon über dem Sheet – dort keine Wiederholung.
  const showSolution = !grade.correct && !INLINE_CORRECTION_TYPES.has(question.type);
  const next = h('button', { type: 'button', class: 'btn', onClick: onNext }, nextLabel, icon('next'));

  const el = h(
    'section',
    { class: `sheet ${grade.correct ? 'is-correct' : 'is-wrong'}`, 'aria-label': 'Auswertung' },
    h(
      'div',
      { class: 'sheet-body' },
      h(
        'p',
        { class: 'sheet-title' },
        h('span', { class: 'sheet-icon', 'aria-hidden': 'true' }, icon(grade.correct ? 'check' : 'close')),
        feedbackTitle(grade),
      ),
      detail && h('p', { class: 'sheet-detail' }, detail),
      showSolution && h('div', { class: 'solution' }, h('p', { class: 'solution-label' }, 'Richtig ist:'), solutionNode(describeSolution(question))),
      h('p', { class: 'sheet-explanation' }, explanation),
      (question.supplemented || question.note) &&
        h(
          'p',
          { class: 'sheet-note' },
          h('span', { class: 'note-tag' }, 'Ergänzung – mit Unterricht abgleichen'),
          question.note && h('span', null, question.note),
        ),
      h('p', { class: 'sheet-source' }, `Quelle: ${question.sourceRef}`),
    ),
    h('div', { class: 'sheet-footer' }, next),
  );

  return { el, focus: () => next.focus() };
}
