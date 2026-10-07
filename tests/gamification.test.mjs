process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BADGES, newBadges } from '../src/engine/badges.js';
import { createCatalog } from '../src/engine/content.js';
import { examPlan, mastery } from '../src/engine/mastery.js';
import { dailyMaintenance, finishSession, recordAnswer } from '../src/engine/progress.js';
import { createDefaultState } from '../src/engine/storage.js';
import { DAILY_GOALS, xpForAnswer, xpForSession } from '../src/engine/xp.js';

const q = (type, difficulty = 1) => ({ type, difficulty });
const g = (correct, score = correct ? 1 : 0) => ({ correct, score });

test('XP per answer (SPEC §4.8)', () => {
  assert.equal(xpForAnswer(q('single'), g(true), { mode: 'path' }), 10);
  assert.equal(xpForAnswer(q('single', 3), g(true), { mode: 'path' }), 15, 'difficulty 3');
  assert.equal(xpForAnswer(q('single'), g(false), { mode: 'path' }), 0);
  assert.equal(xpForAnswer(q('categorize'), g(false, 0.75), { mode: 'path' }), 8, 'partial, rounded');
  assert.equal(xpForAnswer(q('order', 3), g(false, 0.6), { mode: 'topic' }), 9);
  assert.equal(xpForAnswer(q('numeric'), g(false, 0.5), { mode: 'path' }), 0, 'numeric has no partial XP');
  assert.equal(xpForAnswer(q('open'), g(true, 0.8), { mode: 'path' }), 16, 'rubric share × 20');
  assert.equal(xpForAnswer(q('open'), g(false, 0.4), { mode: 'path' }), 8);
  assert.equal(xpForAnswer(q('single', 3), g(true), { mode: 'mistakes' }), 5, 'mistake box: 5');
  assert.equal(xpForAnswer(q('cloze'), g(false, 0.5), { mode: 'mistakes' }), 0);
  assert.equal(xpForAnswer(q('single'), g(true), { mode: 'path', retry: true }), 0, 'repeat at lesson end: 0');
});

test('session bonus: +10 finished, +10 perfect', () => {
  assert.equal(xpForSession({ total: 10, perfect: false }), 10);
  assert.equal(xpForSession({ total: 10, perfect: true }), 20);
  assert.equal(xpForSession({ total: 0, perfect: false }), 0);
  assert.deepEqual(DAILY_GOALS.map((d) => d.xp), [30, 60, 100, 150]);
});

test('mastery & traffic light per topic', () => {
  const qs = Array.from({ length: 10 }, (_, i) => ({ gid: `u/q${i}` }));
  const cards = (n) => Object.fromEntries(qs.slice(0, n).map((x) => [x.gid, { box: 4, seen: 4 }]));
  assert.deepEqual(mastery(qs, cards(0)), { mastered: 0, total: 10, ratio: 0, light: 'red' });
  assert.equal(mastery(qs, cards(3)).light, 'red');
  assert.equal(mastery(qs, cards(4)).light, 'yellow');
  assert.equal(mastery(qs, cards(7)).light, 'yellow');
  assert.equal(mastery(qs, cards(8)).light, 'green');
  assert.equal(mastery([], {}).ratio, 0);
});

test('exam countdown: (unseen + weak) / days left, rounded up to lessons', () => {
  const qs = Array.from({ length: 90 }, (_, i) => ({ gid: `u/q${i}` }));
  const cards = Object.fromEntries(qs.slice(0, 30).map((x, i) => [x.gid, { box: i < 20 ? 4 : 2, seen: 2 }]));
  // 60 unseen + 10 weak = 70 over 23 days ≈ 3 questions/day → 1 lesson
  assert.deepEqual(examPlan({ questions: qs, cards, examDate: '2026-10-30', today: '2026-10-07' }), { daysLeft: 23, toLearn: 70, lessonsPerDay: 1 });
  // 70 in 3 days → 23.3/day → 3 lessons
  assert.equal(examPlan({ questions: qs, cards, examDate: '2026-10-10', today: '2026-10-07' }).lessonsPerDay, 3);
  assert.equal(examPlan({ questions: qs, cards, examDate: '2026-10-07', today: '2026-10-07' }).daysLeft, 0);
  assert.equal(examPlan({ questions: qs, cards, examDate: '2026-10-06', today: '2026-10-07' }), null, 'exam is over');
  const all = Object.fromEntries(qs.map((x) => [x.gid, { box: 5, seen: 5 }]));
  assert.equal(examPlan({ questions: qs, cards: all, examDate: '2026-10-30', today: '2026-10-07' }).lessonsPerDay, 0);
});

test('badges are data-driven and only awarded once', () => {
  assert.equal(BADGES.length, 11);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 11);
  const base = { sessions: 1, streak: 3, greenTopics: 0, exams: 0, bestGrade: null, mistakesBefore: 2, mistakesAfter: 0, session: { mode: 'path', total: 10, perfect: true }, hour: 23 };
  const ids = newBadges({}, base).map((b) => b.id);
  assert.deepEqual(ids.sort(), ['first_lesson', 'mistakes_cleared', 'night_shift', 'perfect_lesson', 'streak_3'].sort());
  assert.deepEqual(newBadges({ first_lesson: '2026-10-01' }, { ...base, streak: 1, mistakesAfter: 1, hour: 12, session: { mode: 'path', total: 10, perfect: false } }), []);
  assert.deepEqual(newBadges({}, { ...base, sessions: 0, streak: 0, mistakesBefore: 0, hour: 6, session: { mode: 'mistakes', total: 3, perfect: true } }).map((b) => b.id), ['early_shift'], 'perfect mistake session is not a perfect lesson');
  assert.deepEqual(newBadges({}, { ...base, sessions: 0, streak: 0, mistakesBefore: 0, hour: 12, session: null, exams: 1, bestGrade: 2 }).map((b) => b.id).sort(), ['exam_grade_2', 'first_exam']);
});

test('finishSession: bonus XP into today, streak +1, league joined, badges stored', () => {
  const now = () => new Date(2026, 9, 7, 22, 30).getTime();
  let state = createDefaultState(now);
  state = { ...state, league: { ...state.league, seed: 42 } };
  state = recordAnswer(state, { gid: 'lf14-2/abc-01', grade: { correct: true, points: 2 }, now, ms: 1000, mode: 'path', xp: 10 });
  const res = finishSession(state, { now, summary: { mode: 'path', total: 1, perfect: true, durationMs: 60000 }, mistakesBefore: 0, greenTopics: () => 0 });
  assert.equal(res.bonusXp, 20);
  assert.equal(res.state.days['2026-10-07'].xp, 30);
  assert.equal(res.state.days['2026-10-07'].lessons, 1);
  assert.equal(res.streakBefore, 0);
  assert.equal(res.state.streak.current, 1);
  assert.equal(res.state.league.weekId, '2026-W41');
  assert.deepEqual(res.badges.map((b) => b.id).sort(), ['first_lesson', 'night_shift', 'perfect_lesson']);
  assert.deepEqual(res.state.badges, { first_lesson: '2026-10-07', perfect_lesson: '2026-10-07', night_shift: '2026-10-07' });
});

test('dailyMaintenance: seed once, freezes bridge missed days, finished week is ranked', () => {
  const day = (d, h = 9) => () => new Date(2026, 9, d, h).getTime();
  let state = createDefaultState(day(7));
  let res = dailyMaintenance(state, { now: day(7), seed: 99 });
  assert.equal(res.state.league.seed, 99);
  assert.equal(dailyMaintenance(res.state, { now: day(7), seed: 1 }).state.league.seed, 99, 'seed is kept');

  state = {
    ...res.state,
    streak: { current: 9, longest: 9, lastActiveDate: '2026-10-09', freezes: 1, frozenDates: [] },
    days: { '2026-10-09': { xp: 900, lessons: 3, minutes: 20 } },
    league: { ...res.state.league, weekId: '2026-W41', tier: 1 },
  };
  res = dailyMaintenance(state, { now: day(13), seed: 1 }); // Tuesday of W42, missed 10.–12.
  assert.equal(res.broken, true, 'one freeze cannot cover three days');
  assert.equal(res.state.streak.current, 0);
  assert.equal(res.leagueResult.result, 'up');
  assert.equal(res.state.league.tier, 2);
  assert.equal(res.state.league.weekId, '2026-W42');

  const unchanged = dailyMaintenance(res.state, { now: day(13), seed: 1 });
  assert.equal(unchanged.state, res.state, 'nothing to do → same object');
});

test('all lf14-2 topics start red', () => {
  const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
  const catalog = createCatalog([unit]);
  for (const t of catalog.units[0].topics) assert.equal(mastery(catalog.getTopicQuestions('lf14-2', t.id), {}).light, 'red');
});
