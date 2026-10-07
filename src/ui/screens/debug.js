import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';

// Entwickler-Ansicht, nur mit ?debug=1. M2 macht daraus den Durchklick aller Fragen.
/** @param {import('../app.js').ScreenContext} ctx */
export function render({ catalog }) {
  return [
    screenHeader({ title: 'Debug: Fragen', back: { href: '#/home', label: 'Zurück zum Lernpfad' } }),
    catalog.units.map((unit) => {
      /** @type {Record<string, number>} */
      const byType = {};
      for (const q of unit.questions) byType[q.type] = (byType[q.type] ?? 0) + 1;
      return h(
        'section',
        { class: 'card' },
        h('h2', null, unit.id),
        h('p', { class: 'muted small' }, `${unit.questions.length} Fragen · ${unit.topics.length} Themen · Status ${unit.reviewStatus}`),
        h(
          'ul',
          { class: 'stat-list' },
          Object.entries(byType).map(([type, n]) => h('li', null, h('span', null, type), h('span', { class: 'muted' }, String(n)))),
        ),
      );
    }),
  ];
}
