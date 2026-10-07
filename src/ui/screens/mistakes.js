import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} _ctx */
export function render(_ctx) {
  return [
    screenHeader({ title: 'Fehlerkiste' }),
    emptyState({
      icon: '🧰',
      title: 'Fehlerkiste leer. Läuft.',
      text: 'Falsch beantwortete Fragen landen hier – zum gezielten Nachüben.',
    }),
  ];
}
