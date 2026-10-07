import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({
      title: 'Profil',
      action: h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Einstellungen' }, icon('settings')),
    }),
    emptyState({
      icon: '👤',
      title: 'Statistik kommt bald',
      text: 'Streak-Kalender, XP-Verlauf, Mastery und Badges.',
    }),
  ];
}
