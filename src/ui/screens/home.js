import { h } from '../dom.js';
import { icon } from '../components/icon.js';
import { progressRing } from '../components/progressRing.js';
import { screenHeader } from '../components/screenHeader.js';
import { leagueSnapshot, todayXp } from '../gamification.js';
import { todayLocal } from '../../engine/dates.js';
import { LIGHT_LABELS, examPlan, mastery } from '../../engine/mastery.js';
import { isDue, isNew } from '../../engine/scheduler.js';
import { streakView } from '../../engine/streak.js';

/**
 * Home: Streak · XP heute / Tagesziel · Liga · Klausur-Countdown · Lernpfad mit Mastery-Ampel.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, store, now }) {
  const state = store.get();
  const cards = /** @type {Record<string, import('../../engine/scheduler.js').Card>} */ (state.cards);
  const today = todayLocal(now);
  return [
    screenHeader({ title: 'Lernfracht', lead: '📦' }),
    dashboard(state, now, today),
    catalog.units.map((unit) => unitSection(unit, catalog, cards, today, state.profile.examDates[unit.id])),
  ];
}

/**
 * @param {import('../../engine/storage.js').AppState} state
 * @param {() => number} now
 * @param {string} today
 */
function dashboard(state, now, today) {
  const streak = streakView(state.streak, today);
  const xp = todayXp(state, now);
  const goal = state.profile.dailyGoalXp;
  const goalDone = xp >= goal;
  const league = leagueSnapshot(state, now);

  let streakLine;
  if (streak.current === 0) streakLine = 'Eine Lektion heute startet deinen Streak.';
  else if (streak.activeToday) streakLine = `🔥 ${streak.current} ${streak.current === 1 ? 'Tag' : 'Tage'}. Nicht abreißen lassen.`;
  else if (streak.freezes > 0) streakLine = `Heute noch eine Lektion – sonst springt ein Streak-Freeze ein.`;
  else streakLine = `Heute noch eine Lektion, sonst reißt dein 🔥 ${streak.current}er-Streak.`;

  return h(
    'section',
    { class: 'dash', 'aria-label': 'Dein Tag' },
    h(
      'div',
      { class: 'dash-tiles' },
      h(
        'div',
        { class: `dash-tile${streak.atRisk ? ' is-at-risk' : ''}` },
        h('span', { class: 'dash-big' }, h('span', { 'aria-hidden': 'true' }, '🔥 '), String(streak.current)),
        h('span', { class: 'dash-label' }, streak.current === 1 ? 'Tag Streak' : 'Tage Streak'),
        streak.freezes > 0 && h('span', { class: 'dash-sub' }, `❄️ ${streak.freezes} Freeze${streak.freezes === 1 ? '' : 's'}`),
      ),
      h(
        'div',
        { class: `dash-tile dash-goal${goalDone ? ' is-done' : ''}` },
        h(
          'span',
          { class: 'ring-wrap' },
          progressRing({ ratio: xp / goal, size: 56, className: goalDone ? 'is-done' : '', label: `Tagesziel: ${xp} von ${goal} XP` }),
          goalDone ? h('span', { class: 'ring-center' }, icon('check')) : h('span', { class: 'ring-center ring-num', 'aria-hidden': 'true' }, String(xp)),
        ),
        h('span', { class: 'dash-label' }, goalDone ? 'Tagesziel geschafft' : `${xp} / ${goal} XP`),
      ),
      h(
        'a',
        { class: 'dash-tile dash-league', href: '#/league' },
        h('span', { class: 'dash-big' }, `${league.rank}.`),
        h('span', { class: 'dash-label' }, league.tierName),
        h('span', { class: 'dash-sub' }, 'Demo-Liga'),
      ),
    ),
    h('p', { class: 'dash-line' }, streakLine),
  );
}

/**
 * @param {import('../../engine/content.js').Unit} unit
 * @param {import('../app.js').ScreenContext['catalog']} catalog
 * @param {Record<string, import('../../engine/scheduler.js').Card>} cards
 * @param {string} today
 * @param {string|undefined} examDate
 */
function unitSection(unit, catalog, cards, today, examDate) {
  const headingId = `unit-${unit.id}`;
  const path = catalog.getPathQuestions(unit.id);
  const current = unit.topics.find((t) => catalog.getTopicQuestions(unit.id, t.id).some((q) => isNew(cards[q.gid])));
  const due = path.filter((q) => isDue(cards[q.gid], today)).length;
  const plan = examDate ? examPlan({ questions: path, cards, examDate, today }) : null;
  const shortTitle = unit.title.split(' – ')[0];

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
    plan && countdown(plan, shortTitle),
    !examDate && h('a', { class: 'text-link exam-link', href: '#/settings' }, `Klausurtermin für ${shortTitle} eintragen`),
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
        const m = mastery(questions, cards);
        const percent = Math.round(m.ratio * 100);
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
              h(
                'span',
                { class: 'topic-meta' },
                h('span', { class: `light light-${m.light}`, 'aria-hidden': 'true' }),
                `${LIGHT_LABELS[m.light]} · ${m.mastered}/${questions.length} sicher`,
              ),
            ),
            h(
              'span',
              { class: 'ring-wrap topic-ring' },
              progressRing({ ratio: m.ratio, size: 40, stroke: 4, className: `is-${m.light}`, label: `${percent} % gemeistert` }),
              h('span', { class: 'ring-center ring-pct', 'aria-hidden': 'true' }, `${percent}`),
            ),
            h('span', { class: 'visually-hidden' }, 'Thema üben'),
          ),
        );
      }),
    ),
  );
}

/**
 * @param {{daysLeft: number, toLearn: number, lessonsPerDay: number}} plan
 * @param {string} unitName
 */
function countdown(plan, unitName) {
  let title;
  if (plan.daysLeft === 0) title = `Heute ist Klausur ${unitName}. Viel Erfolg!`;
  else if (plan.daysLeft === 1) title = `Morgen ist Klausur ${unitName}`;
  else title = `Noch ${plan.daysLeft} Tage bis ${unitName}`;
  let advice;
  if (plan.daysLeft === 0) advice = 'Kurz wiederholen, dann ruhig bleiben.';
  else if (plan.lessonsPerDay === 0) advice = 'Alles sitzt – Wiederholen reicht.';
  else advice = `Empfohlen: ${plan.lessonsPerDay} ${plan.lessonsPerDay === 1 ? 'Lektion' : 'Lektionen'} pro Tag · ${plan.toLearn} Fragen offen`;
  return h('div', { class: 'countdown' }, h('p', { class: 'countdown-title' }, title), h('p', { class: 'countdown-advice' }, advice));
}
