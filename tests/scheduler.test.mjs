// Zeitzone mit Sommerzeit, damit Datumsrechnung über die Zeitumstellung geprüft wird.
process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, todayLocal } from '../src/engine/dates.js';
import { BOX_INTERVALS, applyAnswer, isDue, isMastered, isNew, newCard } from '../src/engine/scheduler.js';

test('addDays / diffDays: month, year, leap year and DST boundaries', () => {
  assert.equal(addDays('2026-10-07', 1), '2026-10-08');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-24', 1), '2026-10-25', 'day before end of DST');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26', 'DST ends on 2026-10-25');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30', 'DST starts on 2026-03-29');
  assert.equal(addDays('2026-10-07', 35), '2026-11-11');
  assert.equal(diffDays('2026-10-24', '2026-10-26'), 2);
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2);
  assert.equal(diffDays('2026-10-10', '2026-10-07'), -3);
});

test('todayLocal switches exactly at local midnight, also on the DST night', () => {
  assert.equal(todayLocal(() => new Date(2026, 9, 24, 23, 59, 59).getTime()), '2026-10-24');
  assert.equal(todayLocal(() => new Date(2026, 9, 25, 0, 0, 0).getTime()), '2026-10-25');
  // Der 25.10.2026 hat 25 Stunden: 00:30 + 24 h ist noch der 25., erst + 25 h der 26.
  const start = new Date(2026, 9, 25, 0, 30).getTime();
  assert.equal(todayLocal(() => start + 24 * 3600000), '2026-10-25');
  assert.equal(todayLocal(() => start + 25 * 3600000), '2026-10-26');
});

test('a new card has box 0 and is not due', () => {
  const c = newCard();
  assert.equal(c.box, 0);
  assert.equal(isNew(c), true);
  assert.equal(isNew(undefined), true);
  assert.equal(isDue(c, '2026-10-07'), false);
});

test('correct answers walk up the boxes with intervals 1 · 3 · 7 · 16 · 35 days', () => {
  assert.deepEqual(BOX_INTERVALS, { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 });
  let card = applyAnswer(undefined, true, '2026-10-07');
  assert.deepEqual(card, { box: 1, due: '2026-10-08', seen: 1, correct: 1, streakCorrect: 1, lastAnswered: '2026-10-07', inMistakeBox: false });
  card = applyAnswer(card, true, '2026-10-08');
  assert.equal(card.box, 2);
  assert.equal(card.due, '2026-10-11');
  card = applyAnswer(card, true, '2026-10-11');
  assert.equal(card.box, 3);
  assert.equal(card.due, '2026-10-18');
  assert.equal(isMastered(card), false);
  card = applyAnswer(card, true, '2026-10-18');
  assert.equal(card.box, 4);
  assert.equal(card.due, '2026-11-03');
  assert.equal(isMastered(card), true);
  card = applyAnswer(card, true, '2026-11-03');
  assert.equal(card.box, 5);
  assert.equal(card.due, '2026-12-08');
  card = applyAnswer(card, true, '2026-12-08');
  assert.equal(card.box, 5, 'box 5 is the maximum');
  assert.equal(card.due, '2027-01-12');
  assert.equal(card.seen, 6);
  assert.equal(card.correct, 6);
});

test('a wrong answer: back to box 1, due today, into the mistake box', () => {
  let card = applyAnswer(undefined, true, '2026-10-01');
  card = applyAnswer(card, true, '2026-10-02');
  card = applyAnswer(card, false, '2026-10-05');
  assert.equal(card.box, 1);
  assert.equal(card.due, '2026-10-05');
  assert.equal(card.inMistakeBox, true);
  assert.equal(card.streakCorrect, 0);
  assert.equal(isDue(card, '2026-10-05'), true);
  assert.equal(isMastered(card), false);
});

test('mistake box is left after 2 correct answers in a row; a wrong answer resets the count', () => {
  let card = applyAnswer(undefined, false, '2026-10-01');
  card = applyAnswer(card, true, '2026-10-01');
  assert.equal(card.inMistakeBox, true, 'one correct answer is not enough');
  card = applyAnswer(card, false, '2026-10-02');
  card = applyAnswer(card, true, '2026-10-02');
  assert.equal(card.inMistakeBox, true);
  card = applyAnswer(card, true, '2026-10-03');
  assert.equal(card.inMistakeBox, false, 'two in a row');
  card = applyAnswer(card, true, '2026-10-06');
  assert.equal(card.inMistakeBox, false, 'stays out');
});

test('isDue compares calendar days', () => {
  const card = applyAnswer(undefined, true, '2026-10-07');
  assert.equal(isDue(card, '2026-10-07'), false);
  assert.equal(isDue(card, '2026-10-08'), true);
  assert.equal(isDue(card, '2026-10-20'), true);
});
