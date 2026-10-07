import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({ title: 'Lektion', back: { href: '#/home', label: 'Zurück zum Lernpfad' } }),
    emptyState({
      icon: '📚',
      title: 'Lektionen kommen bald',
      text: 'Rund 10 Fragen, fünf Minuten, Sofort-Feedback.',
      action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
    }),
  ];
}
