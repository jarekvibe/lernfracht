import { h } from '../dom.js';
import { emptyState } from '../components/emptyState.js';

// ASSUMPTION: Das Onboarding (SPEC §4.1) ist keinem Meilenstein zugeordnet; bis dahin nur dieser Platzhalter.
/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    h('h1', { class: 'visually-hidden', tabindex: '-1' }, 'Willkommen'),
    emptyState({
      icon: '📦',
      title: 'Willkommen bei Lernfracht',
      text: 'Fünf Minuten am Tag für deine Klausur. Deine Daten bleiben auf diesem Gerät.',
      action: h('a', { class: 'btn', href: '#/home' }, 'Los geht’s'),
    }),
  ];
}
