import { h } from '../../dom.js';
import { uid } from '../../uid.js';
import { keywordHits } from '../../../engine/grading.js';
import { formatNumber } from '../../../engine/numbers.js';

/**
 * open – write → show model answer → tick the rubric criteria you covered → check.
 * The keyword count is only a hint; grading goes through the AiProvider (self-assessment in Phase 1).
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} _presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function openRenderer(q, _presentation, { onChange, promptId }) {
  const base = uid('open');
  /** @type {'write'|'assess'} */
  let phase = 'write';
  const textarea = h('textarea', {
    id: `${base}-text`,
    class: 'open-input',
    rows: '6',
    placeholder: 'Deine Antwort …',
    'aria-labelledby': promptId,
  });
  textarea.addEventListener('input', onChange);

  /** @type {{criterion: string, points: number}[]} */
  const rubric = q.rubric;
  const boxes = rubric.map((_, i) => h('input', { type: 'checkbox', id: `${base}-c${i}`, class: 'rubric-input' }));
  const rows = rubric.map((r, i) =>
    h(
      'label',
      { class: 'rubric-row', for: boxes[i].id },
      boxes[i],
      h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'rubric-text' }, r.criterion),
      h('span', { class: 'rubric-points' }, `${formatNumber(r.points)} P.`),
    ),
  );
  const assessHeading = h('h3', { tabindex: '-1' }, 'Musterlösung');
  const keywordHint = h('p', { class: 'keyword-hint' });
  const assess = h(
    'div',
    { class: 'open-assess', hidden: true },
    keywordHint,
    h('section', { class: 'model-answer' }, assessHeading, h('p', null, q.modelAnswer)),
    h('fieldset', { class: 'rubric' }, h('legend', null, 'Was steckt in deiner Antwort?'), rows),
  );

  return {
    el: h('div', { class: 'open' }, textarea, assess),
    // ASSUMPTION: Die Musterlösung gibt es erst, wenn etwas geschrieben wurde (erst selbst formulieren).
    isComplete: () => (phase === 'write' ? textarea.value.trim() !== '' : true),
    primaryLabel: () => (phase === 'write' ? 'Musterlösung anzeigen' : 'Prüfen'),
    advance() {
      if (phase !== 'write') return false;
      phase = 'assess';
      textarea.readOnly = true;
      const hits = keywordHits(q, textarea.value);
      keywordHint.textContent = hits.total > 0 ? `Du hast ${hits.used.length} von ${hits.total} Schlüsselbegriffen verwendet.` : '';
      keywordHint.hidden = hits.total === 0;
      assess.hidden = false;
      assessHeading.focus();
      onChange();
      return true;
    },
    getAnswer: () => ({ text: textarea.value, met: boxes.map((box) => box.checked) }),
    onDigit(digit) {
      const box = boxes[digit - 1];
      if (phase !== 'assess' || !box || box.disabled) return false;
      box.checked = !box.checked;
      return true;
    },
    reveal() {
      boxes.forEach((box, i) => {
        box.disabled = true;
        rows[i].classList.toggle('is-met', box.checked);
      });
    },
  };
}
