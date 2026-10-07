import { h } from '../../dom.js';
import { uid } from '../../uid.js';

/**
 * single · multi · truefalse – native radio/checkbox inputs styled as answer cards.
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function choiceRenderer(q, presentation, { onChange, promptId }) {
  const isMulti = q.type === 'multi';
  const isTrueFalse = q.type === 'truefalse';
  const name = uid('choice');
  /** @type {{value: number|boolean, text: string}[]} */
  const options = isTrueFalse
    ? [{ value: true, text: 'Stimmt' }, { value: false, text: 'Stimmt nicht' }]
    : /** @type {number[]} */ (presentation.optionOrder).map((i) => ({ value: i, text: q.options[i] }));
  /** @type {(number|boolean)[]} */
  const solution = isMulti ? q.answer : [q.answer];

  const rows = options.map((option, position) => {
    const input = h('input', { class: 'choice-input', type: isMulti ? 'checkbox' : 'radio', name, value: String(position) });
    const status = h('span', { class: 'visually-hidden' });
    const label = h(
      'label',
      { class: 'choice' },
      input,
      h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(position + 1)),
      h('span', { class: 'choice-text' }, option.text),
      status,
    );
    input.addEventListener('change', () => {
      sync();
      onChange();
    });
    return { option, input, label, status };
  });

  function sync() {
    for (const row of rows) row.label.classList.toggle('is-selected', row.input.checked);
  }

  const el = h(
    'div',
    {
      class: isTrueFalse ? 'choices choices-tf' : 'choices',
      role: isMulti ? 'group' : 'radiogroup',
      'aria-labelledby': promptId,
    },
    rows.map((row) => row.label),
  );

  return {
    el,
    isComplete: () => rows.some((row) => row.input.checked),
    getAnswer() {
      const chosen = rows.filter((row) => row.input.checked).map((row) => row.option.value);
      return isMulti ? chosen : chosen[0] ?? null;
    },
    onDigit(digit) {
      const row = rows[digit - 1];
      if (!row) return false;
      row.input.checked = isMulti ? !row.input.checked : true;
      row.input.focus();
      sync();
      onChange();
      return true;
    },
    reveal() {
      for (const row of rows) {
        row.input.disabled = true;
        const isSolution = solution.includes(row.option.value);
        if (isSolution && row.input.checked) {
          row.label.classList.add('is-correct');
          row.status.textContent = ' – richtig';
        } else if (isSolution) {
          row.label.classList.add('is-missed');
          row.status.textContent = ' – wäre richtig gewesen';
        } else if (row.input.checked) {
          row.label.classList.add('is-wrong');
          row.status.textContent = ' – falsch';
        }
      }
    },
  };
}
