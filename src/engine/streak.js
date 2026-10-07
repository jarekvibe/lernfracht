// Streak mit Streak-Freeze (SPEC §4.8). Ein Tag zählt, sobald eine Lektion, Fehler-Session oder
// Klausur abgeschlossen ist. Tagesgrenze: 00:00 lokal – gerechnet wird nur mit `YYYY-MM-DD`.

import { addDays } from './dates.js';

export const MAX_FREEZES = 2;
/** Ein Freeze pro 7 Tage Streak. */
export const FREEZE_EVERY = 7;
const KEEP_FROZEN_DATES = 60;

/**
 * @typedef {Object} Streak
 * @property {number} current
 * @property {number} longest
 * @property {string|null} lastActiveDate last day with a finished session
 * @property {number} freezes
 * @property {string[]} frozenDates days bridged by a freeze (newest last)
 */

/** @param {(string|null|undefined)[]} dates */
const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;

/**
 * Handles missed days up to yesterday: each one uses a freeze if there is one,
 * otherwise the streak drops to 0. Idempotent – bridged days are remembered.
 * ASSUMPTION: Freezes werden Tag für Tag verbraucht. Reichen sie nicht für alle verpassten Tage,
 * reißt der Streak trotzdem – die verbrauchten Freezes sind dann weg (wörtlich nach SPEC §4.8).
 * @param {Streak} streak
 * @param {string} today
 * @returns {{streak: Streak, frozen: string[], broken: boolean}}
 */
export function settleStreak(streak, today) {
  const covered = latest([streak.lastActiveDate, streak.frozenDates.at(-1)]);
  if (!covered || streak.current === 0) return { streak, frozen: [], broken: false };

  const yesterday = addDays(today, -1);
  let { freezes, current } = streak;
  /** @type {string[]} */
  const frozen = [];
  let broken = false;
  for (let day = addDays(covered, 1); day <= yesterday; day = addDays(day, 1)) {
    if (freezes > 0) {
      freezes -= 1;
      frozen.push(day);
    } else {
      current = 0;
      broken = true;
      break;
    }
  }
  if (frozen.length === 0 && !broken) return { streak, frozen, broken };
  return {
    streak: { ...streak, current, freezes, frozenDates: [...streak.frozenDates, ...frozen].slice(-KEEP_FROZEN_DATES) },
    frozen,
    broken,
  };
}

/**
 * A session was finished today: +1 for the first one of the day, earn a freeze every 7 days.
 * @param {Streak} streak
 * @param {string} today
 * @returns {Streak}
 */
export function recordStreakDay(streak, today) {
  const settled = settleStreak(streak, today).streak;
  if (settled.lastActiveDate === today) return settled;
  const current = settled.current + 1;
  const earned = current % FREEZE_EVERY === 0 ? 1 : 0;
  return {
    ...settled,
    current,
    longest: Math.max(settled.longest, current),
    lastActiveDate: today,
    freezes: Math.min(MAX_FREEZES, settled.freezes + earned),
  };
}

/**
 * What the home screen shows, without changing anything.
 * @param {Streak} streak
 * @param {string} today
 */
export function streakView(streak, today) {
  const { streak: s } = settleStreak(streak, today);
  const activeToday = s.lastActiveDate === today;
  return { current: s.current, freezes: s.freezes, activeToday, atRisk: !activeToday && s.current > 0 };
}
