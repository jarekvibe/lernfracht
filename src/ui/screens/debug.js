import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { questionView } from '../components/questionView.js';
import { TYPE_LABELS } from '../labels.js';
import { createRng, hashString } from '../../engine/random.js';

// Entwickler-Ansicht (nur mit ?debug=1): alle Fragen aller Einheiten nacheinander durchklicken.
// Position steht im Hash (`&i=12`), damit Neuladen auf derselben Frage landet.

/** @param {number} i 1-based */
const pathFor = (i) => `/debug/questions?debug=1&i=${i}`;

/** @param {import('../app.js').ScreenContext} ctx */
export function render(ctx) {
  const { catalog, query, navigate } = ctx;
  const questions = catalog.units.flatMap((unit) =>
    unit.topics.flatMap((topic) => catalog.getTopicQuestions(unit.id, topic.id)),
  );
  const total = questions.length;
  const parsed = Number.parseInt(query.i ?? '1', 10);
  const index = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), total) - 1 : 0;
  const question = questions[index];
  const unit = /** @type {NonNullable<ReturnType<typeof catalog.getUnit>>} */ (catalog.getUnit(question.unitId));
  const topic = unit.topics.find((t) => t.id === question.topic);

  /** @param {number} i 0-based, wraps around */
  const go = (i) => navigate(pathFor(((i % total) + total) % total + 1));

  const picker = h(
    'select',
    { class: 'debug-select', 'aria-label': 'Frage wählen', onChange: (/** @type {Event} */ e) => go(Number(/** @type {HTMLSelectElement} */ (e.target).value)) },
    catalog.units.flatMap((u) =>
      u.topics.map((t) =>
        h(
          'optgroup',
          { label: `${u.id} · ${t.title}` },
          catalog.getTopicQuestions(u.id, t.id).map((q) => {
            const i = questions.indexOf(q);
            return h('option', { value: String(i), selected: i === index }, `${i + 1}. ${q.id} · ${TYPE_LABELS[q.type]}`);
          }),
        ),
      ),
    ),
  );

  const view = questionView({
    question,
    rng: createRng(hashString(question.gid) ^ ctx.now()),
    ai: ctx.ai,
    store: ctx.store,
    onCleanup: ctx.onCleanup,
    onNext: () => go(index + 1),
    nextLabel: index + 1 < total ? 'Nächste Frage' : 'Von vorn',
  });

  return [
    screenHeader({ title: 'Debug: Fragen', back: { href: '#/home', label: 'Zurück zum Lernpfad' } }),
    h(
      'nav',
      { class: 'debug-nav', 'aria-label': 'Fragen blättern' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Vorherige Frage', onClick: () => go(index - 1) }, icon('back')),
      h('span', { class: 'debug-count' }, `${index + 1} / ${total}`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Nächste Frage', onClick: () => go(index + 1) }, icon('next')),
      picker,
    ),
    h(
      'p',
      { class: 'debug-meta' },
      h('span', { class: 'chip' }, TYPE_LABELS[question.type]),
      h('span', null, question.gid),
      h('span', null, `${topic?.icon ?? ''} ${topic?.title ?? question.topic}`),
      h('span', { 'aria-label': `Schwierigkeit ${question.difficulty} von 3` }, '●'.repeat(question.difficulty) + '○'.repeat(3 - question.difficulty)),
      question.supplemented && h('span', { class: 'chip chip-muted' }, 'Ergänzung'),
      question.note && h('span', { class: 'chip chip-muted' }, 'Notiz'),
    ),
    view.el,
  ];
}
