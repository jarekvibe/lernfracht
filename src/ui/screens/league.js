import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({ title: 'Liga' }),
    emptyState({
      icon: '🏆',
      title: 'Liga kommt bald',
      text: 'Jede Woche auf- oder absteigen – von der Palette bis zum Mega-Carrier.',
    }),
  ];
}
