import { h } from '../../dom.js';
import { splitCloze } from '../../../engine/solution.js';
import { focusedKey, restoreFocus } from './focus.js';

/**
 * cloze – tap a gap, then a word from the bank. Tapping the active, filled gap empties it.
 * Keys 1–9 pick the n-th available word for the active gap.
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function clozeRenderer(q, presentation, { onChange }) {
  const segments = splitCloze(q.text);
  const bank = /** @type {{id: string, text: string}[]} */ (presentation.wordBank);
  /** @type {(string|null)[]} word ids per gap */
  const filled = q.gaps.map(() => null);
  /** @type {number|null} */
  let active = 0;
  /** @type {import('../../../engine/grading.js').Grade|null} */
  let grade = null;
  const el = h('div', { class: 'cloze' });

  /** @param {string|null} id */
  const textOf = (id) => bank.find((w) => w.id === id)?.text ?? null;
  const available = () => bank.filter((w) => !filled.includes(w.id));

  /** First empty gap after `from` (wrapping), or null. */
  function nextEmpty(/** @type {number} */ from) {
    for (let k = 1; k <= filled.length; k += 1) {
      const i = (from + k) % filled.length;
      if (filled[i] === null) return i;
    }
    return null;
  }

  /** @param {string} wordId */
  function pick(wordId) {
    if (grade) return;
    const gap = active ?? nextEmpty(-1) ?? 0;
    filled[gap] = wordId;
    active = nextEmpty(gap);
    render();
    onChange();
  }

  /** @param {number} gap */
  function tapGap(gap) {
    if (active === gap && filled[gap] !== null) filled[gap] = null;
    else active = gap;
    render();
    onChange();
  }

  /** @param {number} gap */
  function gapNode(gap) {
    const text = textOf(filled[gap]);
    if (grade) {
      const ok = grade.marks?.[gap];
      return h(
        'span',
        { class: `gap ${ok ? 'is-correct' : 'is-wrong'}` },
        ok ? text : h('s', null, text ?? '—'),
        !ok && h('span', { class: 'gap-fix' }, q.gaps[gap].answer),
        h('span', { class: 'visually-hidden' }, ok ? ' (richtig)' : ` (falsch, richtig: ${q.gaps[gap].answer})`),
      );
    }
    const isActive = active === gap;
    return h(
      'button',
      {
        type: 'button',
        class: `gap${isActive ? ' is-active' : ''}${text ? ' is-filled' : ''}`,
        'aria-pressed': String(isActive),
        'aria-label': `Lücke ${gap + 1}: ${text ?? 'leer'}`,
        'data-focus': `gap-${gap}`,
        onClick: () => tapGap(gap),
      },
      text ?? h('span', { class: 'gap-num' }, String(gap + 1)),
    );
  }

  function render() {
    const focus = focusedKey(el);
    const words = available();
    el.replaceChildren(
      ...[
        h('p', { class: 'cloze-text' }, segments.map((part) => (typeof part === 'number' ? gapNode(part) : part))),
        !grade &&
          h(
            'div',
            { class: 'word-bank', role: 'group', 'aria-label': 'Wörter' },
            words.map((word, k) =>
              h(
                'button',
                { type: 'button', class: 'chip-btn', 'data-focus': `word-${word.id}`, onClick: () => pick(word.id) },
                k < 9 && h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(k + 1)),
                h('span', null, word.text),
              ),
            ),
          ),
      ].filter((node) => node instanceof Node),
    );
    restoreFocus(el, focus);
  }

  render();

  return {
    el,
    isComplete: () => filled.every((id) => id !== null),
    getAnswer: () => filled.map(textOf),
    onDigit(digit) {
      const word = available()[digit - 1];
      if (!word) return false;
      pick(word.id);
      return true;
    },
    reveal(result) {
      grade = result;
      render();
    },
  };
}
