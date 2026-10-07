// In-App-Erinnerung (SPEC §4.9): nur solange die App offen ist, höchstens einmal am Tag,
// und nur, wenn das Tagesziel noch fehlt.

import { todayLocal } from './dates.js';

/**
 * ASSUMPTION: Fällig ist die Erinnerung ab der Uhrzeit bis Mitternacht – wer die App erst später
 * öffnet, bekommt sie dann. Höchstens eine pro Tag.
 * @param {Object} input
 * @param {() => number} input.now
 * @param {string} input.reminderTime `HH:MM`
 * @param {string|null} input.lastReminderDate day of the last notification
 * @param {number} input.xpToday
 * @param {number} input.goal
 * @returns {boolean}
 */
export function shouldNotify({ now, reminderTime, lastReminderDate, xpToday, goal }) {
  const t = new Date(now());
  const [hh, mm] = reminderTime.split(':').map(Number);
  const due = t.getHours() * 60 + t.getMinutes() >= hh * 60 + mm;
  return due && lastReminderDate !== todayLocal(now) && xpToday < goal;
}
