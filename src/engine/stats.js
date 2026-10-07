// Profil & Statistik (SPEC §4.10): Streak-Kalender, XP-Verlauf, Gesamtzahlen.

import { addDays, weekDates, isoWeekId } from './dates.js';

/**
 * @typedef {Record<string, {xp?: number, lessons?: number, minutes?: number}>} Days
 * @typedef {{date: string, xp: number, active: boolean, frozen: boolean, future: boolean, today: boolean}} HeatCell
 */

/**
 * Calendar of the last `weeks` ISO weeks (Monday first), ending with the current week.
 * A day is active when a session was finished (lessons > 0) or XP were earned.
 * @param {{days: Days, frozenDates: string[], today: string, weeks?: number}} input
 * @returns {HeatCell[][]} columns = weeks (oldest first), 7 cells each
 */
export function heatmap({ days, frozenDates, today, weeks = 12 }) {
  const frozen = new Set(frozenDates);
  const lastMonday = weekDates(isoWeekId(today))[0];
  return Array.from({ length: weeks }, (_, w) => {
    const monday = addDays(lastMonday, (w - weeks + 1) * 7);
    return Array.from({ length: 7 }, (_, d) => {
      const date = addDays(monday, d);
      const day = days[date] ?? {};
      const xp = day.xp ?? 0;
      return {
        date,
        xp,
        active: (day.lessons ?? 0) > 0 || xp > 0,
        frozen: frozen.has(date),
        future: date > today,
        today: date === today,
      };
    });
  });
}

/**
 * XP per day for the last `count` days, oldest first.
 * @param {Days} days
 * @param {string} today
 * @param {number} [count]
 * @returns {{date: string, xp: number}[]}
 */
export function xpSeries(days, today, count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1);
    return { date, xp: days[date]?.xp ?? 0 };
  });
}

/**
 * Totals across all cards and days.
 * @param {{cards: Record<string, {seen?: number, correct?: number}>, days: Days}} state
 */
export function totals(state) {
  let answered = 0;
  let correct = 0;
  for (const card of Object.values(state.cards)) {
    answered += card.seen ?? 0;
    correct += card.correct ?? 0;
  }
  let minutes = 0;
  let xp = 0;
  let activeDays = 0;
  for (const day of Object.values(state.days)) {
    minutes += day.minutes ?? 0;
    xp += day.xp ?? 0;
    if ((day.lessons ?? 0) > 0 || (day.xp ?? 0) > 0) activeDays += 1;
  }
  return { answered, correct, hitRate: answered > 0 ? correct / answered : null, minutes, xp, activeDays };
}
