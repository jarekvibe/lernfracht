import { h } from '../dom.js';
import { icon } from './icon.js';

/**
 * Screen title row. The h1 receives focus after navigation (tabindex -1).
 * @param {Object} options
 * @param {string} options.title
 * @param {{href: string, label: string}} [options.back]
 * @param {Node} [options.action] e.g. an icon link on the right
 * @param {string} [options.lead] decorative emoji before the title
 */
export function screenHeader({ title, back, action, lead }) {
  return h(
    'header',
    { class: 'screen-header' },
    back && h('a', { class: 'icon-btn', href: back.href, 'aria-label': back.label }, icon('back')),
    lead && h('span', { class: 'brand', 'aria-hidden': 'true' }, lead),
    h('h1', { tabindex: '-1' }, title),
    action,
  );
}
