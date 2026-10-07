import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';

/**
 * Home & Lernpfad. M1: Themen je Einheit in Pfad-Reihenfolge.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog }) {
  return [
    screenHeader({ title: 'Lernfracht', lead: '📦' }),
    catalog.units.map((unit) => unitSection(unit, catalog)),
  ];
}

/**
 * @param {import('../../engine/content.js').Unit} unit
 * @param {import('../app.js').ScreenContext['catalog']} catalog
 */
function unitSection(unit, catalog) {
  const headingId = `unit-${unit.id}`;
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
      'ol',
      { class: 'path', 'aria-label': `Lernpfad ${unit.lernfeld.id}` },
      unit.topics.map((topic) => topicRow(topic, catalog.getTopicQuestions(unit.id, topic.id).length)),
    ),
  );
}

/**
 * @param {import('../../engine/content.js').Topic} topic
 * @param {number} count
 */
function topicRow(topic, count) {
  return h(
    'li',
    { class: 'topic' },
    h('span', { class: 'topic-icon', 'aria-hidden': 'true' }, topic.icon || '📦'),
    h(
      'div',
      { class: 'topic-body' },
      h('span', { class: 'topic-title' }, topic.title),
      h('span', { class: 'topic-meta' }, `${count} ${count === 1 ? 'Frage' : 'Fragen'}`),
    ),
  );
}
