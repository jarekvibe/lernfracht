import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { todayLocal } from '../../engine/dates.js';
import { isDue, isNew } from '../../engine/scheduler.js';

/**
 * Home & Lernpfad: „Weiterlernen“ folgt dem Pfad, jedes Thema lässt sich direkt üben.
 * Streak, XP-Ring, Liga und Mastery kommen mit M4.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, store, now }) {
  const cards = /** @type {Record<string, import('../../engine/scheduler.js').Card>} */ (store.get().cards);
  const today = todayLocal(now);
  return [
    screenHeader({ title: 'Lernfracht', lead: '📦' }),
    catalog.units.map((unit) => unitSection(unit, catalog, cards, today)),
  ];
}

/**
 * @param {import('../../engine/content.js').Unit} unit
 * @param {import('../app.js').ScreenContext['catalog']} catalog
 * @param {Record<string, import('../../engine/scheduler.js').Card>} cards
 * @param {string} today
 */
function unitSection(unit, catalog, cards, today) {
  const headingId = `unit-${unit.id}`;
  const path = catalog.getPathQuestions(unit.id);
  const current = unit.topics.find((t) => catalog.getTopicQuestions(unit.id, t.id).some((q) => isNew(cards[q.gid])));
  const due = path.filter((q) => isDue(cards[q.gid], today)).length;

  return h(
    'section',
    { class: 'unit', 'aria-labelledby': headingId },
    h(
      'div',
      { class: 'unit-head' },
      h(
        'div',
        { class: 'unit-meta' },
        h('span', { class: 'chip' }, unit.lernfeld.id),
        h('a', { class: 'text-link', href: `#/cando/${encodeURIComponent(unit.id)}` }, 'Kann-Liste'),
      ),
      h('h2', { id: headingId }, unit.title),
    ),
    h(
      'a',
      { class: 'continue', href: `#/lesson?unit=${encodeURIComponent(unit.id)}` },
      h('span', { class: 'continue-label' }, 'Weiterlernen'),
      h(
        'span',
        { class: 'continue-meta' },
        current ? `Weiter mit: ${current.title}` : 'Wiederholen & festigen',
        due > 0 ? ` · ${due} ${due === 1 ? 'Wiederholung' : 'Wiederholungen'} fällig` : '',
      ),
      icon('next'),
    ),
    h(
      'ol',
      { class: 'path', 'aria-label': `Lernpfad ${unit.lernfeld.id}` },
      unit.topics.map((topic) => {
        const questions = catalog.getTopicQuestions(unit.id, topic.id);
        const seen = questions.filter((q) => !isNew(cards[q.gid])).length;
        return h(
          'li',
          null,
          h(
            'a',
            {
              class: 'topic',
              href: `#/lesson?mode=topic&unit=${encodeURIComponent(unit.id)}&topic=${encodeURIComponent(topic.id)}`,
            },
            h('span', { class: 'topic-icon', 'aria-hidden': 'true' }, topic.icon || '📦'),
            h(
              'span',
              { class: 'topic-body' },
              h('span', { class: 'topic-title' }, topic.title),
              h('span', { class: 'topic-meta' }, `${questions.length} ${questions.length === 1 ? 'Frage' : 'Fragen'}${seen > 0 ? ` · ${seen} gesehen` : ''}`),
            ),
            h('span', { class: 'topic-go' }, h('span', { class: 'visually-hidden' }, 'Thema üben'), icon('next')),
          ),
        );
      }),
    ),
  );
}
