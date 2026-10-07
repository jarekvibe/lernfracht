// Spaced Repetition nach Leitner (SPEC §4.4) und Fehlerkiste (§4.5).

import { addDays } from './dates.js';

/** Tage bis zur nächsten Wiederholung nach einer richtigen Antwort, je neuer Box. */
export const BOX_INTERVALS = Object.freeze({ 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 });
export const MAX_BOX = 5;
/** „Gemeistert“ ab dieser Box. */
export const MASTERED_BOX = 4;
/** So viele richtige Antworten in Folge, dann verlässt eine Frage die Fehlerkiste. */
export const MISTAKE_EXIT_STREAK = 2;

/**
 * @typedef {Object} Card
 * @property {number} box 0 = neu, 1–5
 * @property {string|null} due `YYYY-MM-DD`, null solange neu
 * @property {number} seen
 * @property {number} correct
 * @property {number} streakCorrect richtige Antworten in Folge
 * @property {string|null} lastAnswered `YYYY-MM-DD`
 * @property {boolean} inMistakeBox
 */

/** @returns {Card} */
export function newCard() {
  return { box: 0, due: null, seen: 0, correct: 0, streakCorrect: 0, lastAnswered: null, inMistakeBox: false };
}

/**
 * Richtig → Box + 1 (max. 5), fällig nach dem Intervall der neuen Box.
 * Falsch → Box 1, heute fällig, ab in die Fehlerkiste.
 * ASSUMPTION: Für das Verlassen der Fehlerkiste zählen alle Antworten (Lektion, Thema, Fehlerkiste,
 * Klausur), nicht nur die in einer Fehlerkiste-Session.
 * @param {Card|undefined} card
 * @param {boolean} correct
 * @param {string} today `YYYY-MM-DD`
 * @returns {Card}
 */
export function applyAnswer(card, correct, today) {
  const c = { ...newCard(), ...card };
  if (correct) {
    const box = Math.min(MAX_BOX, c.box + 1);
    const streakCorrect = c.streakCorrect + 1;
    return {
      ...c,
      box,
      due: addDays(today, BOX_INTERVALS[/** @type {1|2|3|4|5} */ (box)]),
      seen: c.seen + 1,
      correct: c.correct + 1,
      streakCorrect,
      lastAnswered: today,
      inMistakeBox: c.inMistakeBox && streakCorrect < MISTAKE_EXIT_STREAK,
    };
  }
  return { ...c, box: 1, due: today, seen: c.seen + 1, streakCorrect: 0, lastAnswered: today, inMistakeBox: true };
}

/** @param {Card|undefined} card */
export const isNew = (card) => !card || card.seen === 0;

/**
 * @param {Card|undefined} card
 * @param {string} today
 */
export const isDue = (card, today) => Boolean(card && card.box >= 1 && card.due !== null && card.due <= today);

/** @param {Card|undefined} card */
export const isMastered = (card) => Boolean(card && card.box >= MASTERED_BOX);
