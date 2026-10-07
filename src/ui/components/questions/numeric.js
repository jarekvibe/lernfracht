import { h } from '../../dom.js';
import { uid } from '../../uid.js';
import { parseNumberInput } from '../../../engine/numbers.js';

/**
 * numeric – text field with decimal keyboard; German and English notation are accepted.
 * Invalid input shows a hint and is not counted as a mistake.
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} _presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function numericRenderer(q, _presentation, { onChange, promptId }) {
  const id = uid('numeric');
  const unitId = `${id}-unit`;
  const hint = h('p', { id: `${id}-hint`, class: 'field-hint', 'aria-live': 'polite' });
  const input = h('input', {
    id,
    class: 'numeric-input',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
    placeholder: 'Ergebnis',
    'aria-labelledby': q.unit ? `${promptId} ${unitId}` : promptId,
    'aria-describedby': hint.id,
  });
  input.addEventListener('input', () => {
    hint.textContent = '';
    input.removeAttribute('aria-invalid');
    onChange();
  });

  const el = h(
    'div',
    { class: 'numeric' },
    h('div', { class: 'numeric-field' }, input, q.unit && h('span', { id: unitId, class: 'numeric-unit' }, q.unit)),
    hint,
  );

  return {
    el,
    isComplete: () => input.value.trim() !== '',
    validate() {
      const parsed = parseNumberInput(input.value);
      if (parsed.ok) return null;
      return parsed.reason === 'empty' ? 'Gib eine Zahl ein.' : 'Das ist keine gültige Zahl. Beispiel: 57.380,5';
    },
    showError(message) {
      hint.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    },
    getAnswer() {
      const parsed = parseNumberInput(input.value);
      return parsed.ok ? parsed.value : Number.NaN;
    },
    reveal(result) {
      input.readOnly = true;
      input.classList.add(result.correct ? 'is-correct' : 'is-wrong');
    },
  };
}
