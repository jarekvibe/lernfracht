import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { BADGES } from '../../engine/badges.js';
import { formatNumber } from '../../engine/numbers.js';

/**
 * Profil. M4: Abzeichen und Eckdaten; Statistik (Heatmap, XP-Verlauf) folgt mit M6.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ store }) {
  const state = store.get();
  const owned = state.badges;
  const count = BADGES.filter((b) => owned[b.id]).length;
  const name = state.profile.nickname.trim();

  return [
    screenHeader({
      title: 'Profil',
      action: h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Einstellungen' }, icon('settings')),
    }),
    h(
      'section',
      { class: 'card profile-head' },
      h('h2', null, name || 'Ohne Spitznamen'),
      h(
        'ul',
        { class: 'stat-list' },
        h('li', null, h('span', null, 'Streak'), h('span', null, `🔥 ${state.streak.current}`)),
        h('li', null, h('span', null, 'Längster Streak'), h('span', null, `${state.streak.longest} ${state.streak.longest === 1 ? 'Tag' : 'Tage'}`)),
        h('li', null, h('span', null, 'Streak-Freezes'), h('span', null, `❄️ ${state.streak.freezes}`)),
      ),
      !name && h('a', { class: 'text-link', href: '#/settings' }, 'Spitznamen festlegen'),
    ),
    h(
      'section',
      { class: 'badges', 'aria-labelledby': 'badges-title' },
      h('h2', { id: 'badges-title' }, `Abzeichen · ${count} von ${BADGES.length}`),
      h(
        'ul',
        { class: 'badge-grid' },
        BADGES.map((b) => {
          const date = owned[b.id];
          return h(
            'li',
            { class: `badge${date ? ' is-owned' : ''}` },
            h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, date ? b.icon : '🔒'),
            h('span', { class: 'badge-title' }, b.title),
            h('span', { class: 'badge-desc' }, date ? `seit ${date.split('-').reverse().join('.')}` : b.description),
            h('span', { class: 'visually-hidden' }, date ? ' – erreicht' : ' – noch offen'),
          );
        }),
      ),
    ),
    examHistory(state),
    h('p', { class: 'muted small profile-later' }, 'Streak-Kalender und XP-Verlauf folgen.'),
  ];
}

/**
 * Verlauf aller Klausur-Simulationen (SPEC §4.6): Datum, Note, Dauer.
 * @param {import('../../engine/storage.js').AppState} state
 */
function examHistory(state) {
  const exams = /** @type {{unitId: string, date: string, percent: number, grade: number, durationSec: number}[]} */ (state.exams);
  return h(
    'section',
    { class: 'badges', 'aria-labelledby': 'exam-history-title' },
    h('h2', { id: 'exam-history-title' }, 'Klausur-Verlauf'),
    exams.length === 0
      ? h('p', { class: 'muted small' }, 'Noch keine Simulation. Unter „Klausur“ geht’s los.')
      : h(
          'ol',
          { class: 'history-list' },
          exams
            .slice()
            .reverse()
            .map((e) =>
              h(
                'li',
                null,
                h('span', null, `${e.date.split('-').reverse().join('.')} · ${e.unitId.toUpperCase()}`),
                h('span', { class: 'history-grade' }, `Note ${e.grade}`),
                h('span', { class: 'muted' }, `${formatNumber(e.percent, 1)} % · ${Math.max(1, Math.round(e.durationSec / 60))} Min.`),
              ),
            ),
        ),
  );
}
