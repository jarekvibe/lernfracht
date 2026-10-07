import { h } from '../dom.js';

/**
 * @param {Object} options
 * @param {string} options.icon decorative emoji
 * @param {string} options.title
 * @param {string} [options.text]
 * @param {Node} [options.action]
 */
export function emptyState({ icon, title, text, action }) {
  return h(
    'section',
    { class: 'empty' },
    h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, icon),
    h('h2', null, title),
    text && h('p', null, text),
    action,
  );
}
