// Lernfortschritt in den App-Zustand schreiben (reine Reducer, Uhr injiziert).

import { todayLocal } from './dates.js';
import { applyAnswer } from './scheduler.js';
import { MAX_EVENTS } from './storage.js';

/**
 * @typedef {import('./storage.js').AppState} AppState
 */

/**
 * Updates the Leitner card and appends to the answer log (Phase 2 recomputes XP from it).
 * ASSUMPTION: Events tragen zusätzlich `mode` (path/topic/mistakes/exam), damit der Server
 * später unterscheiden kann, wofür es welche XP gab. Wiederholungen am Lektionsende werden
 * nicht geloggt – sie ändern nichts.
 * @param {AppState} state
 * @param {{gid: string, grade: {correct: boolean, points: number}, now: () => number, ms: number, mode: string}} answer
 * @returns {AppState}
 */
export function recordAnswer(state, { gid, grade, now, ms, mode }) {
  const t = now();
  const card = applyAnswer(/** @type {any} */ (state.cards[gid]), grade.correct, todayLocal(() => t));
  const event = { t, qid: gid, correct: grade.correct, points: grade.points, ms: Math.max(0, Math.round(ms)), mode };
  return {
    ...state,
    cards: { ...state.cards, [gid]: card },
    events: [...state.events, event].slice(-MAX_EVENTS),
  };
}

/**
 * Counts a finished lesson (or mistake session) for today and adds the learning minutes.
 * ASSUMPTION: Auch „Fehler üben“ und „Thema üben“ zählen als Lektion des Tages (SPEC §4.8 Streak).
 * @param {AppState} state
 * @param {{now: () => number, durationMs: number}} session
 * @returns {AppState}
 */
export function recordSessionComplete(state, { now, durationMs }) {
  const today = todayLocal(now);
  const day = /** @type {{xp?: number, lessons?: number, minutes?: number}} */ (state.days[today] ?? {});
  return {
    ...state,
    days: {
      ...state.days,
      [today]: {
        ...day,
        xp: day.xp ?? 0,
        lessons: (day.lessons ?? 0) + 1,
        minutes: (day.minutes ?? 0) + Math.max(1, Math.round(durationMs / 60000)),
      },
    },
  };
}
