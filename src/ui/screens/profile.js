import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { streakCalendar, xpChart } from '../components/charts.js';
import { BADGES } from '../../engine/badges.js';
import { todayLocal } from '../../engine/dates.js';
import { LIGHT_LABELS, mastery } from '../../engine/mastery.js';
import { formatNumber } from '../../engine/numbers.js';
import { heatmap, totals, xpSeries } from '../../engine/stats.js';

/**
 * Profil & Statistik (SPEC §4.10): Kennzahlen, Streak-Kalender, XP-Verlauf, Mastery je Thema,
 * Klausur-Verlauf, Abzeichen.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ store, catalog, now }) {
  const state = store.get();
  const today = todayLocal(now);
  const t = totals(state);
  const name = state.profile.nickname.trim();
  const owned = state.badges;
  const badgeCount = BADGES.filter((b) => owned[b.id]).length;

  return [
    screenHeader({
      title: 'Profil',
      action: h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Einstellungen' }, icon('settings')),
    }),
    h('p', { class: 'profile-name' }, name || 'Ohne Spitznamen', !name && ' · ', !name && h('a', { class: 'text-link', href: '#/settings' }, 'festlegen')),
    h(
      'ul',
      { class: 'stat-tiles' },
      tile('Fragen beantwortet', formatNumber(t.answered)),
      tile('Trefferquote', t.hitRate === null ? '–' : `${Math.round(t.hitRate * 100)} %`),
      tile('Lernzeit', t.minutes >= 60 ? `${formatNumber(t.minutes / 60, 1)} Std.` : `${t.minutes} Min.`),
      tile('Längster Streak', `${state.streak.longest} ${state.streak.longest === 1 ? 'Tag' : 'Tage'}`),
    ),
    h(
      'section',
      { class: 'card profile-block' },
      h('h2', null, 'Streak-Kalender'),
      h('p', { class: 'muted small' }, `🔥 ${state.streak.current} aktuell · ❄️ ${state.streak.freezes} Freeze${state.streak.freezes === 1 ? '' : 's'} auf Lager`),
      streakCalendar(heatmap({ days: state.days, frozenDates: state.streak.frozenDates, today }), state.profile.dailyGoalXp),
    ),
    h(
      'section',
      { class: 'card profile-block' },
      h('h2', null, 'XP der letzten 14 Tage'),
      xpChart(xpSeries(state.days, today), state.profile.dailyGoalXp, today),
    ),
    h(
      'section',
      { class: 'card profile-block' },
      h('h2', null, 'Was schon sitzt'),
      catalog.units.map((unit) =>
        h(
          'ul',
          { class: 'topic-scores' },
          unit.topics.map((topic) => {
            const m = mastery(catalog.getTopicQuestions(unit.id, topic.id), /** @type {any} */ (state.cards));
            const tone = m.light === 'green' ? 'good' : m.light === 'yellow' ? 'ok' : 'bad';
            return h(
              'li',
              null,
              h('span', { class: 'topic-score-name' }, `${topic.icon ?? ''} ${topic.title}`),
              h('span', { class: 'topic-score-points' }, `${m.mastered}/${m.total}`),
              h('span', { class: `score-bar is-${tone}`, role: 'img', 'aria-label': `${Math.round(m.ratio * 100)} % – ${LIGHT_LABELS[m.light]}` }, h('span', { class: 'score-fill', style: `width:${Math.round(m.ratio * 100)}%` })),
            );
          }),
        ),
      ),
    ),
    examHistory(state),
    h(
      'section',
      { class: 'profile-block', 'aria-labelledby': 'badges-title' },
      h('h2', { id: 'badges-title', class: 'block-title' }, `Abzeichen · ${badgeCount} von ${BADGES.length}`),
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
  ];
}

/**
 * @param {string} label
 * @param {string} value
 */
function tile(label, value) {
  return h('li', { class: 'stat-tile' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}

/**
 * Verlauf aller Klausur-Simulationen (SPEC §4.6): Datum, Note, Dauer.
 * @param {import('../../engine/storage.js').AppState} state
 */
function examHistory(state) {
  const exams = /** @type {{unitId: string, date: string, percent: number, grade: number, durationSec: number}[]} */ (state.exams);
  return h(
    'section',
    { class: 'card profile-block', 'aria-labelledby': 'exam-history-title' },
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
