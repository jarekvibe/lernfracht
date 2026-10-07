import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog } from '../src/engine/content.js';
import { applyAnswer } from '../src/engine/scheduler.js';
import { addDays } from '../src/engine/dates.js';
import { MAX_SAME_TYPE_RUN, buildMistakeSession, buildSession, spreadTypes } from '../src/engine/session.js';
import { advance, answerCurrent, currentItem, isFinished, startLesson, summarize } from '../src/engine/lesson.js';

const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
const catalog = createCatalog([unit]);
const path = catalog.units[0].topics.flatMap((t) => catalog.getTopicQuestions('lf14-2', t.id));
const now = () => new Date(2026, 9, 7, 18, 0).getTime(); // 2026-10-07
const TODAY = '2026-10-07';
const typeOf = (gid) => catalog.getQuestion(gid).type;

/** Longest run of identical types. */
function longestRun(gids) {
  let best = 0;
  let run = 0;
  gids.forEach((gid, i) => {
    run = i > 0 && typeOf(gid) === typeOf(gids[i - 1]) ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Synthetic questions for edge cases. */
const q = (n, type = 'single') => ({ gid: `u/q${n}`, type });

test('fresh learner: 10 new questions from the first topic, in content order (≤ 1 open)', () => {
  const gids = buildSession({ questions: path, cards: {}, now });
  assert.equal(gids.length, 10);
  assert.ok(gids.every((gid) => gid.startsWith('lf14-2/abc-')));
  const expected = path.filter((x) => x.topic === 'abc').slice(0, 10).map((x) => x.gid);
  assert.deepEqual([...gids].sort(), [...expected].sort());
  assert.ok(gids.filter((gid) => typeOf(gid) === 'open').length <= 1);
  assert.ok(longestRun(gids) <= MAX_SAME_TYPE_RUN, `no run longer than ${MAX_SAME_TYPE_RUN}`);
});

test('new questions continue into the next topic when the current one is done', () => {
  const cards = {};
  for (const x of path.filter((p) => p.topic === 'abc')) cards[x.gid] = applyAnswer(undefined, true, TODAY); // due tomorrow
  const gids = buildSession({ questions: path, cards, now });
  assert.equal(gids.length, 10);
  assert.ok(gids.every((gid) => gid.startsWith('lf14-2/vk-')), gids.join());
});

test('up to 4 due reviews first, most overdue first, then new questions', () => {
  const cards = {};
  const seen = path.slice(0, 8);
  // 8 overdue cards, due 2026-09-28 … 2026-10-05 (seen[0] is the most overdue)
  seen.forEach((x, i) => {
    cards[x.gid] = { ...applyAnswer(undefined, true, '2026-09-20'), due: addDays('2026-09-28', i) };
  });
  const gids = buildSession({ questions: path, cards, now });
  const reviews = gids.filter((gid) => cards[gid]);
  assert.equal(reviews.length, 4, 'exactly 4 reviews while new questions exist');
  assert.deepEqual([...reviews].sort(), seen.slice(0, 4).map((x) => x.gid).sort(), 'the 4 most overdue');
  assert.equal(gids.length, 10);
});

test('not yet due cards are not reviewed while new questions exist', () => {
  const cards = { [path[0].gid]: applyAnswer(undefined, true, TODAY) }; // due tomorrow
  const gids = buildSession({ questions: path, cards, now });
  assert.ok(!gids.includes(path[0].gid));
});

test('no new questions left → more reviews, then consolidate lowest box / oldest first', () => {
  const qs = Array.from({ length: 14 }, (_, i) => q(i));
  const cards = {};
  qs.forEach((x, i) => {
    cards[x.gid] = { box: i < 6 ? 2 : 3, due: i < 6 ? '2026-10-01' : '2026-12-01', seen: 2, correct: 2, streakCorrect: 2, lastAnswered: `2026-09-${String(10 + i).padStart(2, '0')}`, inMistakeBox: false };
  });
  const gids = buildSession({ questions: qs, cards, now });
  assert.equal(gids.length, 10);
  for (let i = 0; i < 6; i += 1) assert.ok(gids.includes(`u/q${i}`), `due q${i} included`);
  // 4 more from consolidation: box 3, oldest first → q6..q9
  for (let i = 6; i < 10; i += 1) assert.ok(gids.includes(`u/q${i}`), `consolidate q${i}`);
});

test('consolidation prefers the lowest box', () => {
  const qs = [q(1), q(2), q(3)];
  const cards = {
    'u/q1': { box: 5, due: '2027-01-01', seen: 5, correct: 5, streakCorrect: 5, lastAnswered: '2026-09-01', inMistakeBox: false },
    'u/q2': { box: 2, due: '2026-12-01', seen: 2, correct: 2, streakCorrect: 2, lastAnswered: '2026-10-06', inMistakeBox: false },
    'u/q3': { box: 3, due: '2026-12-01', seen: 3, correct: 3, streakCorrect: 3, lastAnswered: '2026-09-15', inMistakeBox: false },
  };
  assert.deepEqual(buildSession({ questions: qs, cards, now, length: 2 }), ['u/q2', 'u/q3']);
});

test('at most one open question per lesson', () => {
  const qs = [q(1, 'open'), q(2, 'open'), q(3, 'open'), q(4), q(5)];
  const gids = buildSession({ questions: qs, cards: {}, now });
  assert.deepEqual(gids.filter((g) => g.endsWith('1') || g.endsWith('2') || g.endsWith('3')).length, 1);
  assert.equal(gids.length, 3);
});

test('more than 3 of a type in a row is softly avoided', () => {
  const items = [q(1), q(2), q(3), q(4), q(5), q(6, 'numeric'), q(7, 'truefalse')];
  const spread = spreadTypes(items);
  let run = 0;
  let longest = 0;
  spread.forEach((x, i) => {
    run = i > 0 && x.type === spread[i - 1].type ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  assert.ok(longest <= 3, spread.map((x) => x.type).join());
  assert.equal(spread.length, items.length);
  // impossible to avoid → order kept, nothing lost
  const same = [q(1), q(2), q(3), q(4), q(5)];
  assert.deepEqual(spreadTypes(same), same);
});

test('„Thema üben“: only questions of that topic; small scopes give shorter sessions', () => {
  const topic = catalog.getTopicQuestions('lf14-2', 'kundentypen');
  const gids = buildSession({ questions: topic, cards: {}, now });
  assert.ok(gids.length <= topic.length);
  assert.ok(gids.every((gid) => gid.startsWith('lf14-2/kt-') || topic.some((x) => x.gid === gid)));
  const canDo = unit.topics[0].canDo[0].questionIds.map((id) => catalog.getQuestion(`lf14-2/${id}`));
  assert.equal(buildSession({ questions: canDo, cards: {}, now }).length, canDo.length);
});

test('a fully mastered topic still gives a consolidation session', () => {
  const topic = catalog.getTopicQuestions('lf14-2', 'kundentypen');
  const cards = Object.fromEntries(topic.map((x) => [x.gid, { box: 5, due: '2027-01-01', seen: 5, correct: 5, streakCorrect: 5, lastAnswered: '2026-10-01', inMistakeBox: false }]));
  assert.equal(buildSession({ questions: topic, cards, now }).length, topic.filter((x) => x.type !== 'open').length + Math.min(1, topic.filter((x) => x.type === 'open').length));
});

test('mistake session: only questions in the mistake box, most overdue first', () => {
  const cards = {
    [path[3].gid]: applyAnswer(undefined, false, '2026-10-05'),
    [path[1].gid]: applyAnswer(undefined, false, '2026-10-02'),
    [path[2].gid]: applyAnswer(undefined, true, '2026-10-02'),
  };
  assert.deepEqual(buildMistakeSession({ questions: path, cards }), [path[1].gid, path[3].gid]);
  assert.deepEqual(buildMistakeSession({ questions: path, cards: {} }), []);
});

test('sessions are deterministic for the same input', () => {
  assert.deepEqual(buildSession({ questions: path, cards: {}, now }), buildSession({ questions: path, cards: {}, now }));
});

test('lesson: wrong first attempts come back once at the end; retries do not count', () => {
  let lesson = startLesson({ gids: ['a', 'b', 'c'], mode: 'path', now: () => 1000 });
  const answers = { a: true, b: false, c: false };
  while (!isFinished(lesson)) {
    const item = currentItem(lesson);
    const correct = item.retry ? item.gid === 'b' : answers[item.gid];
    lesson = advance(answerCurrent(lesson, { correct, score: correct ? 1 : 0 }));
  }
  assert.deepEqual(lesson.queue.map((i) => `${i.gid}${i.retry ? '*' : ''}`), ['a', 'b', 'c', 'b*', 'c*']);
  assert.deepEqual(lesson.retryResults.map((r) => [r.gid, r.correct]), [['b', true], ['c', false]]);
  const summary = summarize(lesson, () => 61000);
  assert.deepEqual(summary, { mode: 'path', total: 3, correctFirstTry: 1, perfect: false, wrong: ['b', 'c'], durationMs: 60000 });
  assert.equal(currentItem(lesson), null);
});

test('lesson: perfect when everything is right the first time', () => {
  let lesson = startLesson({ gids: ['a', 'b'], mode: 'topic', now: () => 0 });
  lesson = advance(answerCurrent(lesson, { correct: true, score: 1 }));
  lesson = advance(answerCurrent(lesson, { correct: true, score: 1 }));
  assert.equal(isFinished(lesson), true);
  assert.equal(summarize(lesson, () => 0).perfect, true);
});
