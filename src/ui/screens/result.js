import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { emptyState } from '../components/emptyState.js';
import { getLastResult } from '../lastResult.js';

/** @param {string} unitId @param {string|null} topicId */
const topicHref = (unitId, topicId) => `#/lesson?mode=topic&unit=${encodeURIComponent(unitId)}&topic=${encodeURIComponent(topicId ?? '')}`;

/**
 * Lektions-Ergebnis. XP, Streak und Liga kommen mit M4 dazu.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, store }) {
  const result = getLastResult();
  if (!result) {
    return [
      screenHeader({ title: 'Ergebnis', back: { href: '#/home', label: 'Zurück zum Lernpfad' } }),
      emptyState({
        icon: '📦',
        title: 'Noch kein Ergebnis',
        text: 'Schließ eine Lektion ab – dann siehst du hier, wie sie lief.',
        action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
      }),
    ];
  }

  const cards = store.get().cards;
  const inMistakeBox = Object.values(cards).filter((c) => /** @type {{inMistakeBox?: boolean}} */ (c).inMistakeBox).length;
  const minutes = Math.max(1, Math.round(result.durationMs / 60000));

  /** @type {{href: string, label: string}} */
  let primary;
  if (result.mode === 'topic' && result.unitId) primary = { href: topicHref(result.unitId, result.topicId), label: 'Thema weiter üben' };
  else if (result.mode === 'mistakes' && inMistakeBox > 0) primary = { href: '#/lesson?mode=mistakes', label: 'Weiter Fehler üben' };
  else primary = { href: `#/lesson?unit=${encodeURIComponent(result.unitId ?? catalog.units[0].id)}`, label: 'Nächste Lektion' };

  return [
    h(
      'section',
      { class: 'result' },
      h('div', { class: 'parcels', 'aria-hidden': 'true' }, h('span', { class: 'parcel p1' }), h('span', { class: 'parcel p2' }), h('span', { class: 'parcel p3' })),
      h('h1', { tabindex: '-1' }, result.perfect ? 'Perfekte Lektion.' : 'Ladung gesichert.'),
      h('p', { class: 'result-lead' }, `${result.correctFirstTry} von ${result.total} beim ersten Versuch richtig`),
      h(
        'ul',
        { class: 'stat-list result-stats' },
        h('li', null, h('span', null, 'Dauer'), h('span', null, `${minutes} Min.`)),
        h('li', null, h('span', null, 'In der Fehlerkiste'), h('span', null, `${inMistakeBox} ${inMistakeBox === 1 ? 'Frage' : 'Fragen'}`)),
      ),
    ),
    result.wrong.length > 0 &&
      h(
        'section',
        { class: 'card wrong-list' },
        h('h2', null, 'Das übst du nochmal'),
        h(
          'ul',
          null,
          result.wrong.map((gid) => h('li', null, catalog.getQuestion(gid)?.prompt ?? gid)),
        ),
      ),
    h(
      'div',
      { class: 'actions' },
      h('a', { class: 'btn', href: primary.href }, primary.label),
      result.mode !== 'mistakes' && inMistakeBox > 0 && h('a', { class: 'btn btn-secondary', href: '#/lesson?mode=mistakes' }, `Fehler üben (${inMistakeBox})`),
      h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
    ),
  ];
}
