// M3-Abnahme: 14 Tage Lernen mit injizierter Uhr – Fälligkeiten, Box-Wechsel, Fehlerkiste.
// Zeitraum 20.10.–02.11.2026 in Europe/Berlin, also über die Zeitumstellung am 25.10.
process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog } from '../src/engine/content.js';
import { addDays, todayLocal } from '../src/engine/dates.js';
import { advance, answerCurrent, currentItem, isFinished, startLesson, summarize } from '../src/engine/lesson.js';
import { recordAnswer, recordSessionComplete } from '../src/engine/progress.js';
import { hashString } from '../src/engine/random.js';
import { BOX_INTERVALS, MISTAKE_EXIT_STREAK, isDue, isNew } from '../src/engine/scheduler.js';
import { buildMistakeSession, buildSession } from '../src/engine/session.js';
import { createDefaultState } from '../src/engine/storage.js';

const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
const catalog = createCatalog([unit]);
const path = catalog.units[0].topics.flatMap((t) => catalog.getTopicQuestions('lf14-2', t.id));

/** Deterministic learner: new questions wrong if hash % 3 === 0, later on a slip now and then. */
function answersCorrectly(gid, card, day) {
  if (!card || card.seen === 0) return hashString(gid) % 3 !== 0;
  return hashString(`${gid}@${day}`) % 6 !== 0;
}

test('14 days of learning: due dates, box changes and the mistake box behave as specified', () => {
  let clock = 0;
  const now = () => clock;
  clock = new Date(2026, 9, 20, 18, 0).getTime();
  let state = createDefaultState(now);
  /** Shadow model of the mistake box: gid → correct answers in a row since the last mistake. */
  const shadow = new Map();
  const leftMistakeBox = new Set();
  let firstAttempts = 0;
  let checkedDue = 0;

  /** Plays one session and checks every single answer against the Leitner rules. */
  function play(gids, mode, day) {
    let lesson = startLesson({ gids, mode, now });
    while (!isFinished(lesson)) {
      const item = /** @type {{gid: string, retry: boolean}} */ (currentItem(lesson));
      const before = state.cards[item.gid];
      const correct = item.retry ? true : answersCorrectly(item.gid, before, day);
      lesson = advance(answerCurrent(lesson, { correct, score: correct ? 1 : 0 }));
      if (item.retry) {
        assert.deepEqual(state.cards[item.gid], before, 'retries do not change the card');
        continue;
      }
      firstAttempts += 1;
      state = recordAnswer(state, { gid: item.gid, grade: { correct, points: correct ? 1 : 0 }, now, ms: 15000, mode });
      const card = state.cards[item.gid];
      const today = todayLocal(now);
      assert.equal(card.lastAnswered, today);
      if (correct) {
        assert.equal(card.box, Math.min(5, (before?.box ?? 0) + 1), `${item.gid}: one box up`);
        assert.equal(card.due, addDays(today, BOX_INTERVALS[card.box]), `${item.gid}: interval of box ${card.box}`);
      } else {
        assert.equal(card.box, 1, `${item.gid}: back to box 1`);
        assert.equal(card.due, today, `${item.gid}: due again today`);
      }
      // Fehlerkiste: rein bei falsch, raus nach 2 richtigen in Folge
      if (!correct) shadow.set(item.gid, 0);
      else if (shadow.has(item.gid)) {
        const streak = /** @type {number} */ (shadow.get(item.gid)) + 1;
        if (streak >= MISTAKE_EXIT_STREAK) {
          shadow.delete(item.gid);
          leftMistakeBox.add(item.gid);
        } else shadow.set(item.gid, streak);
      }
      assert.equal(card.inMistakeBox, shadow.has(item.gid), `${item.gid}: mistake box state`);
    }
    state = recordSessionComplete(state, { now, durationMs: summarize(lesson, now).durationMs + 5 * 60000 });
    return lesson;
  }

  /** @type {Record<string, number>} */
  const expectedLessons = {};

  for (let day = 0; day < 14; day += 1) {
    clock = new Date(2026, 9, 20 + day, 18, 0).getTime();
    expectedLessons[todayLocal(now)] = day % 3 === 2 ? 2 : 1;
    const today = todayLocal(now);
    assert.equal(today, addDays('2026-10-20', day), 'local calendar day, also across the DST change');

    const due = path
      .filter((q) => isDue(state.cards[q.gid], today))
      .sort((a, b) => state.cards[a.gid].due.localeCompare(state.cards[b.gid].due));
    const gids = buildSession({ questions: path, cards: state.cards, now });
    assert.equal(gids.length, 10, `day ${day}: a full lesson`);

    // Bis zu 4 Wiederholungen, und zwar die am längsten überfälligen: Alles, was früher fällig war
    // als die k-te Fälligkeit, ist dabei; nichts Späteres (bei Gleichstand ist jede Wahl richtig).
    const reviewed = gids.filter((gid) => !isNew(state.cards[gid]));
    const k = Math.min(4, due.length);
    assert.equal(reviewed.length, k, `day ${day}: up to 4 reviews while new questions remain`);
    if (k > 0) {
      const boundary = state.cards[due[k - 1].gid].due;
      for (const q of due) {
        if (state.cards[q.gid].due < boundary) assert.ok(gids.includes(q.gid), `day ${day}: overdue ${q.gid} reviewed`);
      }
      for (const gid of reviewed) {
        assert.ok(isDue(state.cards[gid], today), `day ${day}: ${gid} reviewed only when due`);
        assert.ok(state.cards[gid].due <= boundary, `day ${day}: ${gid} is among the most overdue`);
        checkedDue += 1;
      }
    }

    play(gids, 'path', day);

    if (day % 3 === 2) {
      const inBox = path.filter((q) => state.cards[q.gid]?.inMistakeBox).map((q) => q.gid);
      const mistakeGids = buildMistakeSession({ questions: path, cards: state.cards });
      assert.ok(mistakeGids.length > 0, `day ${day}: mistake box has content`);
      assert.ok(mistakeGids.every((gid) => inBox.includes(gid)), 'mistake session only from the mistake box');
      play(mistakeGids, 'mistakes', day);
    }
  }

  // Tage, Events, Fortschritt
  const days = Object.keys(state.days).sort();
  assert.equal(days.length, 14);
  assert.equal(days[0], '2026-10-20');
  assert.equal(days[13], '2026-11-02');
  for (const [date, day] of Object.entries(state.days)) {
    assert.equal(day.lessons, expectedLessons[date], `${date}: lessons incl. mistake session`);
    assert.ok(day.minutes >= 5 * day.lessons, `${date}: minutes`);
  }
  assert.equal(state.events.length, firstAttempts);
  assert.ok(state.events.every((e) => typeof e.t === 'number' && e.qid.startsWith('lf14-2/') && typeof e.correct === 'boolean'));
  const boxes = Object.values(state.cards).map((c) => c.box);
  assert.ok(boxes.some((b) => b >= 3), 'cards climb to box 3 within two weeks');
  assert.ok(leftMistakeBox.size > 0, 'questions leave the mistake box');
  assert.ok(Object.values(state.cards).some((c) => c.inMistakeBox), 'and new mistakes arrive');
  assert.ok(checkedDue > 20, 'enough reviews were checked');
});

test('progress: recordAnswer updates card and log, recordSessionComplete counts the day', () => {
  const now = () => new Date(2026, 9, 25, 23, 50).getTime();
  let state = createDefaultState(now);
  state = recordAnswer(state, { gid: 'lf14-2/abc-01', grade: { correct: true, points: 2 }, now, ms: 12345.6, mode: 'path' });
  assert.deepEqual(state.cards['lf14-2/abc-01'], { box: 1, due: '2026-10-26', seen: 1, correct: 1, streakCorrect: 1, lastAnswered: '2026-10-25', inMistakeBox: false });
  assert.deepEqual(state.events, [{ t: now(), qid: 'lf14-2/abc-01', correct: true, points: 2, ms: 12346, mode: 'path' }]);
  state = recordSessionComplete(state, { now, durationMs: 4 * 60000 + 20000 });
  state = recordSessionComplete(state, { now, durationMs: 1000 });
  assert.deepEqual(state.days['2026-10-25'], { xp: 0, lessons: 2, minutes: 5 });
});
