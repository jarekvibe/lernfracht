// Lernfortschritt in den App-Zustand schreiben (reine Reducer, Uhr injiziert).

import { todayLocal } from './dates.js';
import { newBadges } from './badges.js';
import { syncLeague, weekPosition } from './league.js';
import { applyAnswer } from './scheduler.js';
import { MAX_EVENTS } from './storage.js';
import { recordStreakDay, settleStreak } from './streak.js';
import { xpForSession } from './xp.js';

/**
 * @typedef {import('./storage.js').AppState} AppState
 */

/**
 * @param {AppState} state
 * @param {string} today
 * @param {{xp?: number, lessons?: number, minutes?: number}} add
 */
function addToDay(state, today, add) {
  const day = /** @type {{xp?: number, lessons?: number, minutes?: number}} */ (state.days[today] ?? {});
  return {
    ...state.days,
    [today]: {
      ...day,
      xp: (day.xp ?? 0) + (add.xp ?? 0),
      lessons: (day.lessons ?? 0) + (add.lessons ?? 0),
      minutes: (day.minutes ?? 0) + (add.minutes ?? 0),
    },
  };
}

/**
 * Updates the Leitner card, books the XP for today and appends to the answer log
 * (Phase 2 recomputes XP from it).
 * ASSUMPTION: Events tragen zusätzlich `mode` (path/topic/mistakes/exam), damit der Server
 * später unterscheiden kann, wofür es welche XP gab. Wiederholungen am Lektionsende werden
 * nicht geloggt – sie ändern nichts.
 * @param {AppState} state
 * @param {{gid: string, grade: {correct: boolean, points: number}, now: () => number, ms: number, mode: string, xp?: number}} answer
 * @returns {AppState}
 */
export function recordAnswer(state, { gid, grade, now, ms, mode, xp = 0 }) {
  const t = now();
  const today = todayLocal(() => t);
  const card = applyAnswer(/** @type {any} */ (state.cards[gid]), grade.correct, today);
  const event = { t, qid: gid, correct: grade.correct, points: grade.points, ms: Math.max(0, Math.round(ms)), mode };
  return {
    ...state,
    cards: { ...state.cards, [gid]: card },
    days: xp > 0 ? addToDay(state, today, { xp }) : state.days,
    events: [...state.events, event].slice(-MAX_EVENTS),
  };
}

/**
 * Counts a finished lesson (or mistake session) for today and adds the learning minutes.
 * ASSUMPTION: Auch „Fehler üben“ und „Thema üben“ zählen als Lektion des Tages (SPEC §4.8 Streak).
 * @param {AppState} state
 * @param {{now: () => number, durationMs: number, xp?: number}} session
 * @returns {AppState}
 */
export function recordSessionComplete(state, { now, durationMs, xp = 0 }) {
  const today = todayLocal(now);
  return {
    ...state,
    days: addToDay(state, today, { xp, lessons: 1, minutes: Math.max(1, Math.round(durationMs / 60000)) }),
    streak: recordStreakDay(state.streak, today),
  };
}

/** @param {AppState} state */
export const mistakeCount = (state) =>
  Object.values(state.cards).filter((c) => /** @type {{inMistakeBox?: boolean}} */ (c).inMistakeBox).length;

/** @param {AppState} state */
const sessionsTotal = (state) =>
  Object.values(state.days).reduce((n, d) => n + (/** @type {{lessons?: number}} */ (d).lessons ?? 0), 0);

/**
 * Finishes a session: bonus XP, streak day, league week, badges.
 * @param {AppState} state after all answers of the session were recorded
 * @param {Object} input
 * @param {() => number} input.now
 * @param {{mode: string, total: number, perfect: boolean, durationMs: number}} input.summary
 * @param {number} input.mistakesBefore mistake box size when the session started
 * @param {(state: AppState) => number} input.greenTopics topics at ≥ 80 % mastery (needs the catalog)
 * @returns {{state: AppState, bonusXp: number, badges: import('./badges.js').Badge[], streakBefore: number}}
 */
export function finishSession(state, { now, summary, mistakesBefore, greenTopics }) {
  const bonusXp = xpForSession(summary);
  const streakBefore = settleStreak(state.streak, todayLocal(now)).streak.current;
  let next = recordSessionComplete(state, { now, durationMs: summary.durationMs, xp: bonusXp });
  next = joinLeagueWeek(next, now);
  const exams = /** @type {{grade?: number}[]} */ (next.exams);
  const grades = exams.map((e) => e.grade).filter((g) => typeof g === 'number');
  const earned = newBadges(next.badges, {
    sessions: sessionsTotal(next),
    streak: next.streak.current,
    greenTopics: greenTopics(next),
    exams: exams.length,
    bestGrade: grades.length ? Math.min(.../** @type {number[]} */ (grades)) : null,
    mistakesBefore,
    mistakesAfter: mistakeCount(next),
    session: summary,
    hour: new Date(now()).getHours(),
  });
  if (earned.length > 0) {
    const today = todayLocal(now);
    next = { ...next, badges: { ...next.badges, ...Object.fromEntries(earned.map((b) => [b.id, today])) } };
  }
  return { state: next, bonusXp, badges: earned, streakBefore };
}

/**
 * Takes part in the league of the current week (first session of the week).
 * @param {AppState} state
 * @param {() => number} now
 * @returns {AppState}
 */
function joinLeagueWeek(state, now) {
  const { weekId } = weekPosition(now);
  if (state.league.weekId === weekId) return state;
  return { ...state, league: syncLeague(state.league, { weekId, days: state.days }).league };
}

/**
 * Runs on app start (and when the app comes back): bridges missed days with freezes or ends
 * the streak, closes a finished league week, creates the league seed once.
 * @param {AppState} state
 * @param {{now: () => number, seed: number}} input seed is only used if the league has none yet
 * @returns {{state: AppState, frozen: string[], broken: boolean, leagueResult: import('./league.js').LeagueResult|null}}
 */
export function dailyMaintenance(state, { now, seed }) {
  const today = todayLocal(now);
  const settled = settleStreak(state.streak, today);
  let league = state.league.seed === null ? { ...state.league, seed } : state.league;
  /** @type {import('./league.js').LeagueResult|null} */
  let leagueResult = null;
  const { weekId } = weekPosition(now);
  if (league.weekId !== null && league.weekId !== weekId) {
    const synced = syncLeague(league, { weekId, days: state.days });
    league = synced.league;
    leagueResult = synced.result;
  }
  const changed = settled.streak !== state.streak || league !== state.league;
  return {
    state: changed ? { ...state, streak: settled.streak, league } : state,
    frozen: settled.frozen,
    broken: settled.broken,
    leagueResult,
  };
}
