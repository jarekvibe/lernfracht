import { h } from '../dom.js';
import { uid } from '../uid.js';
import { vibrate } from '../haptics.js';
import { contextBlock } from './contextBlock.js';
import { feedbackDetail, feedbackSheet, feedbackTitle } from './feedbackSheet.js';
import { createRenderer } from './questions/index.js';
import { prepareQuestion } from '../../engine/present.js';
import { gradeAnswer, gradeOpenResult } from '../../engine/grading.js';

/**
 * @typedef {import('../../engine/content.js').Question & Record<string, any>} AnyQuestion
 * @typedef {import('../../engine/grading.js').Grade} Grade
 */

/** @type {Record<string, string>} */
const TYPE_HINTS = {
  multi: 'Mehrere Antworten richtig.',
  categorize: 'Begriff antippen, dann die passende Kategorie.',
  order: 'Mit ↑ und ↓ in die richtige Reihenfolge bringen.',
  cloze: 'Lücke antippen, dann das passende Wort.',
  open: 'Schreib deine Antwort wie in der Klausur.',
};

/**
 * One question in learn mode: answer → „Prüfen“ → feedback sheet → „Weiter“.
 * Keyboard: 1–9 choose, Enter checks / continues.
 * @param {Object} options
 * @param {AnyQuestion} options.question
 * @param {() => number} options.rng
 * @param {import('../../engine/ai/provider.js').AiProvider} options.ai
 * @param {import('../app.js').ScreenContext['store']} options.store
 * @param {(fn: () => void) => void} options.onCleanup
 * @param {() => void} options.onNext
 * @param {string|((grade: Grade) => string)} [options.nextLabel]
 * @param {(grade: Grade, answer: unknown) => void} [options.onGraded]
 */
export function questionView({ question, rng, ai, store, onCleanup, onNext, nextLabel = 'Weiter', onGraded }) {
  const promptId = uid('prompt');
  /** @type {'answering'|'checking'|'done'} */
  let state = 'answering';

  const renderer = createRenderer(question, prepareQuestion(question, rng), { onChange: refresh, promptId });
  const primaryButton = h('button', { type: 'button', class: 'btn', onClick: primary });
  const actionBar = h('div', { class: 'action-bar' }, primaryButton);
  const announcer = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const hint = TYPE_HINTS[question.type];

  const el = h(
    'article',
    { class: 'question', 'aria-labelledby': promptId },
    question.context && contextBlock(question.context),
    h('h2', { class: 'prompt', id: promptId, tabindex: '-1' }, question.prompt),
    hint && h('p', { class: 'type-hint' }, hint),
    renderer.el,
    actionBar,
    announcer,
  );

  function refresh() {
    primaryButton.textContent = renderer.primaryLabel?.() ?? 'Prüfen';
    primaryButton.disabled = state !== 'answering' || !renderer.isComplete();
  }

  async function primary() {
    if (state !== 'answering') return;
    if (renderer.advance?.()) {
      refresh();
      return;
    }
    if (!renderer.isComplete()) return;
    const error = renderer.validate?.();
    if (error) {
      renderer.showError?.(error);
      return;
    }

    state = 'checking';
    refresh();
    const answer = renderer.getAnswer();
    /** @type {Grade} */
    let grade;
    if (question.type === 'open') {
      try {
        const result = await ai.gradeOpenAnswer(question, answer.text, { selfAssessment: answer.met });
        grade = gradeOpenResult(question, result);
      } catch {
        // Fallback auf die Selbstbewertung (SPEC §5.2: bei Fehler/Timeout lokal bewerten).
        grade = gradeAnswer(question, answer);
      }
    } else {
      grade = gradeAnswer(question, answer);
    }
    let explanation = question.explanation;
    if (!grade.correct) {
      try {
        explanation = (await ai.explainMistake(question, answer)) ?? question.explanation;
      } catch {
        explanation = question.explanation;
      }
    }

    state = 'done';
    renderer.reveal(grade);
    actionBar.hidden = true;
    const label = typeof nextLabel === 'function' ? nextLabel(grade) : nextLabel;
    const sheet = feedbackSheet({ question, grade, explanation, nextLabel: label, onNext: next });
    el.append(sheet.el);
    el.classList.add('has-sheet');
    // Platz schaffen, damit die markierten Antworten über dem Sheet scrollbar bleiben.
    requestAnimationFrame(() => {
      el.style.paddingBottom = `${sheet.el.offsetHeight + 16}px`;
    });
    announcer.textContent = [feedbackTitle(grade), feedbackDetail(question, grade)].filter(Boolean).join(' ');
    vibrate(store, grade.correct ? 12 : [30, 40, 30]);
    sheet.focus();
    onGraded?.(grade, answer);
  }

  function next() {
    if (state === 'done') onNext();
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !el.isConnected) return;
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest?.('dialog')) return;
    const isTextField = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text');

    if (event.key === 'Enter') {
      // Buttons und Links lösen Enter selbst aus; in der Textarea bedeutet Enter Zeilenumbruch.
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (state === 'done') next();
      else primary();
      return;
    }
    if (!isTextField && state === 'answering' && /^[1-9]$/.test(event.key)) {
      if (renderer.onDigit?.(Number(event.key))) {
        event.preventDefault();
        refresh();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));
  refresh();

  return { el };
}
