import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({ title: 'Klausur' }),
    emptyState({
      icon: '⏱️',
      title: 'Klausur-Simulation kommt bald',
      text: 'Wie in echt: Timer, kein Feedback zwischendurch, Note am Ende.',
    }),
  ];
}
