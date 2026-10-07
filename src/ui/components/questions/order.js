import { h } from '../../dom.js';
import { icon } from '../icon.js';
import { focusedKey, restoreFocus } from './focus.js';

/**
 * order – sort with ↑/↓ buttons. The answer is always complete.
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function orderRenderer(q, presentation, { onChange }) {
  const order = [.../** @type {number[]} */ (presentation.start)];
  /** @type {import('../../../engine/grading.js').Grade|null} */
  let grade = null;
  const list = h('ol', { class: 'order-list' });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const el = h('div', { class: 'order' }, list, live);

  /** @param {number} position @param {-1|1} delta */
  function move(position, delta) {
    const target = position + delta;
    if (target < 0 || target >= order.length) return;
    [order[position], order[target]] = [order[target], order[position]];
    const item = order[target];
    render(`${item}-${delta < 0 ? 'up' : 'down'}`, `${item}-${delta < 0 ? 'down' : 'up'}`);
    live.textContent = `„${q.items[item]}“ jetzt auf Platz ${target + 1}.`;
    onChange();
  }

  /** @param {string} [focusKey] @param {string} [fallbackKey] */
  function render(focusKey, fallbackKey) {
    list.replaceChildren(
      ...order.map((item, position) => {
        const text = q.items[item];
        const ok = grade?.marks?.[position];
        return h(
          'li',
          { class: `order-item${grade ? (ok ? ' is-correct' : ' is-wrong') : ''}` },
          h('span', { class: 'order-pos', 'aria-hidden': 'true' }, String(position + 1)),
          h(
            'span',
            { class: 'order-text' },
            text,
            grade && !ok && h('span', { class: 'order-fix' }, `gehört auf Platz ${item + 1}`),
            grade && h('span', { class: 'visually-hidden' }, ok ? ' – richtig' : ' – falsch'),
          ),
          !grade &&
            h(
              'span',
              { class: 'order-buttons' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn',
                  'aria-label': `„${text}“ nach oben`,
                  disabled: position === 0,
                  'data-focus': `${item}-up`,
                  onClick: () => move(position, -1),
                },
                icon('up'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn',
                  'aria-label': `„${text}“ nach unten`,
                  disabled: position === order.length - 1,
                  'data-focus': `${item}-down`,
                  onClick: () => move(position, 1),
                },
                icon('down'),
              ),
            ),
        );
      }),
    );
    restoreFocus(list, focusKey);
    if (focusKey && !list.contains(document.activeElement)) restoreFocus(list, fallbackKey);
  }

  render();

  return {
    el,
    isComplete: () => true,
    getAnswer: () => [...order],
    reveal(result) {
      grade = result;
      render();
    },
  };
}
