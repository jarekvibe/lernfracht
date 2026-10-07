import { h } from '../dom.js';
import { uid } from '../uid.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';
import { SELF_LEVELS, canDoStatus, selfAssessmentKey } from '../../engine/cando.js';

/**
 * Kann-Liste (SPEC §4.7): Selbsteinschätzung je „Ich kann …“-Satz, automatische Mastery,
 * Hinweis bei großem Abstand, „Jetzt üben“.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, params, store }) {
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

  return [
    header,
    h('p', { class: 'muted' }, unit.title),
    h('p', { class: 'cando-intro' }, 'Schätz dich ehrlich ein. Die App vergleicht das mit deinen Antworten.'),
    unit.topics
      .filter((topic) => (topic.canDo?.length ?? 0) > 0)
      .map((topic) =>
        h(
          'section',
          { class: 'cando-topic' },
          h('h2', null, h('span', { 'aria-hidden': 'true' }, `${topic.icon ?? '📦'} `), topic.title),
          (topic.canDo ?? []).map((entry) => canDoCard(unit.id, entry, store)),
        ),
      ),
  ];
}

/**
 * @param {string} unitId
 * @param {import('../../engine/content.js').CanDo} entry
 * @param {import('../app.js').ScreenContext['store']} store
 */
function canDoCard(unitId, entry, store) {
  const key = selfAssessmentKey(unitId, entry.id);
  const name = uid('self');
  const textId = uid('cando');
  const masteryText = h('span', { class: 'cando-mastery-text' });
  const fill = h('span', { class: 'score-fill' });
  const bar = h('span', { class: 'score-bar', 'aria-hidden': 'true' }, fill);
  const gap = h('p', { class: 'cando-gap', 'aria-live': 'polite' });

  function update() {
    const state = store.get();
    const status = canDoStatus(entry, unitId, /** @type {any} */ (state.cards), state.selfAssessment[key]);
    masteryText.textContent = `${status.mastered} von ${status.total} ${status.total === 1 ? 'Frage' : 'Fragen'} sicher`;
    fill.style.width = `${Math.round(status.ratio * 100)}%`;
    bar.className = `score-bar is-${status.ratio >= 0.8 ? 'good' : status.ratio >= 0.4 ? 'ok' : 'bad'}`;
    gap.textContent = status.message ?? '';
    gap.className = `cando-gap${status.gap ? ` is-${status.gap}` : ''}`;
  }

  const current = store.get().selfAssessment[key];
  const card = h(
    'article',
    { class: 'card cando', 'aria-labelledby': textId },
    h('p', { class: 'cando-text', id: textId }, entry.text),
    h('div', { class: 'cando-mastery' }, bar, masteryText),
    h(
      'fieldset',
      { class: 'self-levels' },
      h('legend', { class: 'visually-hidden' }, 'Wie sicher fühlst du dich?'),
      SELF_LEVELS.map((level) =>
        h(
          'label',
          { class: 'self-level' },
          h('input', {
            type: 'radio',
            name,
            value: level.id,
            checked: current === level.id,
            onChange: () => {
              store.update((s) => ({ ...s, selfAssessment: { ...s.selfAssessment, [key]: level.id } }));
              update();
            },
          }),
          h('span', null, level.label),
        ),
      ),
    ),
    gap,
    h('a', { class: 'text-link', href: `#/lesson?mode=cando&unit=${encodeURIComponent(unitId)}&cando=${encodeURIComponent(entry.id)}` }, 'Jetzt üben'),
  );
  update();
  return card;
}
