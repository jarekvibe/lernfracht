import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({ title: 'Ergebnis', back: { href: '#/home', label: 'Zurück zum Lernpfad' } }),
    emptyState({
      icon: '📦',
      title: 'Noch kein Ergebnis',
      text: 'Schließ eine Lektion ab – dann siehst du hier deine XP.',
      action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
    }),
  ];
}
