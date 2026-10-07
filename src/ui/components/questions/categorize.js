import { h } from '../../dom.js';
import { focusedKey, restoreFocus } from './focus.js';

/**
 * categorize – tap an item, then a category (no drag & drop needed). Keys 1–9 pick the category.
 * @param {import('./index.js').AnyQuestion} q
 * @param {import('../../../engine/present.js').Presentation} presentation
 * @param {import('./index.js').RendererDeps} deps
 * @returns {import('./index.js').Renderer}
 */
export function categorizeRenderer(q, presentation, { onChange }) {
  const displayOrder = /** @type {number[]} */ (presentation.itemOrder);
  /** @type {(number|null)[]} */
  const assignment = q.items.map(() => null);
  /** @type {number|null} */
  let selected = displayOrder[0] ?? null;
  /** @type {import('../../../engine/grading.js').Grade|null} */
  let grade = null;
  const el = h('div', { class: 'categorize' });

  /** Next unassigned item after `item` in display order (wrapping), or null. */
  function nextUnassigned(/** @type {number} */ item) {
    const start = displayOrder.indexOf(item);
    for (let k = 1; k <= displayOrder.length; k += 1) {
      const candidate = displayOrder[(start + k) % displayOrder.length];
      if (assignment[candidate] === null) return candidate;
    }
    return null;
  }

  /** Antippen wählt immer aus (der erste Begriff ist schon vorausgewählt – kein Umschalten). */
  function select(/** @type {number} */ item) {
    selected = item;
    render();
  }

  /** @param {number} category */
  function assign(category) {
    if (selected === null || grade) return false;
    const item = selected;
    assignment[item] = category;
    selected = nextUnassigned(item);
    render();
    onChange();
    return true;
  }

  /** @param {number} item */
  function chip(item) {
    const entry = q.items[item];
    const isSelected = selected === item;
    const mark = grade ? (grade.marks?.[item] ? ' is-correct' : ' is-wrong') : '';
    return h(
      'button',
      {
        type: 'button',
        class: `chip-btn${isSelected ? ' is-selected' : ''}${mark}`,
        'aria-pressed': grade ? null : String(isSelected),
        disabled: Boolean(grade),
        'data-focus': `item-${item}`,
        onClick: () => select(item),
      },
      h('span', null, entry.text),
      grade && !grade.marks?.[item] && h('span', { class: 'chip-fix' }, `→ ${q.categories[entry.category]}`),
      grade && h('span', { class: 'visually-hidden' }, grade.marks?.[item] ? ' – richtig' : ' – falsch'),
    );
  }

  function render() {
    const focus = focusedKey(el);
    const pool = displayOrder.filter((item) => assignment[item] === null);
    el.replaceChildren(
      ...[
        pool.length > 0 &&
          h(
            'div',
            { class: 'chip-pool' },
            h('p', { class: 'pool-label' }, 'Noch zuordnen'),
            h('div', { class: 'chips' }, pool.map(chip)),
          ),
        h(
          'div',
          { class: 'categories' },
          q.categories.map((/** @type {string} */ name, /** @type {number} */ c) =>
            h(
              'section',
              { class: 'category' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'category-target',
                  disabled: Boolean(grade) || selected === null,
                  'data-focus': `cat-${c}`,
                  'aria-label': selected === null ? name : `${name}: „${q.items[selected].text}“ hierher`,
                  onClick: () => assign(c),
                },
                h('span', { class: 'choice-key', 'aria-hidden': 'true' }, String(c + 1)),
                h('span', null, name),
              ),
              h('div', { class: 'chips' }, displayOrder.filter((item) => assignment[item] === c).map(chip)),
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
    isComplete: () => assignment.every((a) => a !== null),
    getAnswer: () => [...assignment],
    onDigit: (digit) => (digit <= q.categories.length ? assign(digit - 1) : false),
    reveal(result) {
      grade = result;
      selected = null;
      render();
    },
  };
}
