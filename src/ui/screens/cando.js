import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';

/** @param {import('../app.js').ScreenContext} ctx */
export function render({ catalog, params }) {
  const unit = catalog.getUnit(params.unitId);
  const header = screenHeader({ title: 'Kann-Liste', back: { href: '#/home', label: 'Zurück zum Lernpfad' } });
  if (!unit) {
    return [
      header,
      emptyState({
        icon: '🔍',
        title: 'Einheit nicht gefunden',
        text: 'Diese Kann-Liste gibt es in dieser Version nicht.',
        action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
      }),
    ];
  }
  const count = unit.topics.reduce((n, t) => n + (t.canDo?.length ?? 0), 0);
  return [
    header,
    h('p', { class: 'muted' }, unit.title),
    emptyState({
      icon: '✅',
      title: 'Selbsteinschätzung kommt bald',
      text: `${count} „Ich kann …“-Sätze – abgeglichen mit deinen Antworten.`,
    }),
  ];
}
