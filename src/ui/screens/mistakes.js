import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';
import { TYPE_LABELS } from '../labels.js';
import { MISTAKE_EXIT_STREAK } from '../../engine/scheduler.js';

/**
 * Fehlerkiste (SPEC §4.5): alle falsch beantworteten Fragen, nach Thema gruppiert.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, store }) {
  const cards = /** @type {Record<string, import('../../engine/scheduler.js').Card>} */ (store.get().cards);
  const groups = catalog.units.flatMap((unit) =>
    unit.topics
      .map((topic) => ({ topic, items: catalog.getTopicQuestions(unit.id, topic.id).filter((q) => cards[q.gid]?.inMistakeBox) }))
      .filter((group) => group.items.length > 0),
  );
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (total === 0) {
    return [
      screenHeader({ title: 'Fehlerkiste' }),
      emptyState({ icon: '🧰', title: 'Fehlerkiste leer. Läuft.', text: 'Falsch beantwortete Fragen landen hier – zum gezielten Nachüben.' }),
    ];
  }

  return [
    screenHeader({ title: 'Fehlerkiste' }),
    h('p', { class: 'muted' }, `${total} ${total === 1 ? 'Frage' : 'Fragen'} · raus nach ${MISTAKE_EXIT_STREAK}× richtig in Folge`),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/lesson?mode=mistakes' }, 'Fehler üben')),
    groups.map(({ topic, items }) =>
      h(
        'section',
        { class: 'mistake-group' },
        h('h2', null, h('span', { 'aria-hidden': 'true' }, `${topic.icon ?? '📦'} `), topic.title),
        h(
          'ul',
          { class: 'mistake-list' },
          items.map((q) => {
            const remaining = MISTAKE_EXIT_STREAK - (cards[q.gid]?.streakCorrect ?? 0);
            return h(
              'li',
              null,
              h('span', { class: 'mistake-prompt' }, q.prompt),
              h('span', { class: 'mistake-meta' }, `${TYPE_LABELS[q.type]} · noch ${remaining}× richtig`),
            );
          }),
        ),
      ),
    ),
  ];
}
