// Mastery & Ampel je Thema (SPEC §4.8) und Klausur-Countdown mit Tagespensum (§4.2).

import { diffDays } from './dates.js';
import { isMastered, isNew } from './scheduler.js';
import { LESSON_LENGTH } from './session.js';

/**
 * @typedef {'red'|'yellow'|'green'} Light
 * @typedef {Record<string, import('./scheduler.js').Card>} Cards
 */

export const LIGHT_LABELS = Object.freeze({ red: 'Noch wackelig', yellow: 'Wird', green: 'Klausurbereit' });

/**
 * Share of mastered questions (box ≥ 4). Red < 40 % · yellow 40–79 % · green ≥ 80 %.
 * @param {{gid: string}[]} questions
 * @param {Cards} cards
 * @returns {{mastered: number, total: number, ratio: number, light: Light}}
 */
export function mastery(questions, cards) {
  const total = questions.length;
  const mastered = questions.filter((q) => isMastered(cards[q.gid])).length;
  const ratio = total === 0 ? 0 : mastered / total;
  const light = ratio >= 0.8 ? 'green' : ratio >= 0.4 ? 'yellow' : 'red';
  return { mastered, total, ratio, light };
}

/**
 * Countdown to the exam and a recommended daily load:
 * (unseen + weak questions) / days left, rounded up to whole lessons.
 * @param {{questions: {gid: string}[], cards: Cards, examDate: string, today: string}} input
 * @returns {{daysLeft: number, toLearn: number, lessonsPerDay: number}|null} null when the exam is over
 */
export function examPlan({ questions, cards, examDate, today }) {
  const daysLeft = diffDays(today, examDate);
  if (daysLeft < 0) return null;
  const toLearn = questions.filter((q) => isNew(cards[q.gid]) || !isMastered(cards[q.gid])).length;
  const perDay = toLearn / Math.max(1, daysLeft);
  return { daysLeft, toLearn, lessonsPerDay: toLearn === 0 ? 0 : Math.ceil(perDay / LESSON_LENGTH) };
}
