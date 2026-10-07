process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canDoStatus } from '../src/engine/cando.js';
import { createCatalog, validateUnit } from '../src/engine/content.js';
import { IHK_GRADE_SCALE, drawExam, examXp, gradeForPercent, scoreExam, topicQuotas } from '../src/engine/exam.js';
import { finishExam } from '../src/engine/progress.js';
import { createRng } from '../src/engine/random.js';
import { createDefaultState } from '../src/engine/storage.js';

const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
const catalog = createCatalog([unit]);
const path = catalog.getPathQuestions('lf14-2');
const config = unit.exam;
const byGid = (gid) => catalog.getQuestion(gid);

/** Content solution in the answer shape of gradeAnswer(). */
function solution(q) {
  switch (q.type) {
    case 'single': case 'multi': case 'truefalse': case 'numeric': return q.answer;
    case 'categorize': return q.items.map((i) => i.category);
    case 'order': return q.items.map((_, i) => i);
    case 'cloze': return q.gaps.map((g) => g.answer);
    case 'open': return { text: 'x', met: q.rubric.map(() => true) };
    default: throw new Error(q.type);
  }
}

test('quotas follow the weights (largest remainder) and add up to the question count', () => {
  assert.deepEqual(topicQuotas(config.topicWeights, 20), config.topicWeights, 'lf14-2: weights sum to 20 → exactly the weights');
  assert.deepEqual(topicQuotas({ a: 1, b: 1, c: 1 }, 10), { a: 4, b: 3, c: 3 }, 'tie → topic order');
  assert.deepEqual(topicQuotas({ a: 3, b: 1 }, 10), { a: 8, b: 2 }, '7.5 / 2.5 → largest remainders');
  assert.deepEqual(topicQuotas({ a: 2, b: 0 }, 5), { a: 5 }, 'weight 0 gets nothing');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  for (const n of [1, 7, 13, 20, 33]) assert.equal(sum(topicQuotas(config.topicWeights, n)), n);
});

test('draw: right size, no duplicates, max open questions, proportional to the weights', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const gids = drawExam({ questions: path, config, rng: createRng(seed) });
    assert.equal(gids.length, 20, `seed ${seed}: 20 questions`);
    assert.equal(new Set(gids).size, 20, `seed ${seed}: no duplicates`);
    const qs = gids.map(byGid);
    assert.ok(qs.filter((q) => q.type === 'open').length <= config.maxOpenQuestions, `seed ${seed}: ≤ 2 open`);
    /** @type {Record<string, number>} */
    const perTopic = {};
    for (const q of qs) perTopic[q.topic] = (perTopic[q.topic] ?? 0) + 1;
    assert.deepEqual(perTopic, config.topicWeights, `seed ${seed}: per topic = weight`);
  }
});

test('draw: random but reproducible, ordered by topic', () => {
  const a = drawExam({ questions: path, config, rng: createRng(1) });
  assert.deepEqual(a, drawExam({ questions: path, config, rng: createRng(1) }));
  assert.notDeepEqual(a, drawExam({ questions: path, config, rng: createRng(2) }));
  const topicOrder = unit.topics.sort((x, y) => x.order - y.order).map((t) => t.id);
  const indices = a.map((gid) => topicOrder.indexOf(byGid(gid).topic));
  assert.deepEqual(indices, [...indices].sort((x, y) => x - y));
});

test('draw: open cap and short topics are compensated by other topics', () => {
  const qs = [
    ...Array.from({ length: 4 }, (_, i) => ({ gid: `u/a${i}`, topic: 'a', type: 'open' })),
    ...Array.from({ length: 2 }, (_, i) => ({ gid: `u/a-s${i}`, topic: 'a', type: 'single' })),
    ...Array.from({ length: 10 }, (_, i) => ({ gid: `u/b${i}`, topic: 'b', type: 'single' })),
  ];
  const gids = drawExam({ questions: qs, config: { questionCount: 10, maxOpenQuestions: 1, topicWeights: { a: 4, b: 1 } }, rng: createRng(5) });
  assert.equal(gids.length, 10);
  assert.equal(gids.filter((g) => g.startsWith('u/a') && !g.includes('-s')).length, 1, 'only one open');
  assert.equal(gids.filter((g) => g.includes('a-s')).length, 2, 'all closed questions of a');
  assert.equal(gids.filter((g) => g.startsWith('u/b')).length, 7, 'b fills the gap');
});

test('scoring: points, max points, percent, per topic, wrong list', () => {
  const gids = drawExam({ questions: path, config, rng: createRng(3) });
  const qs = gids.map(byGid);
  const all = Object.fromEntries(qs.map((q) => [q.gid, solution(q)]));
  const full = scoreExam({ questions: qs, answers: all });
  assert.equal(full.points, full.maxPoints);
  assert.equal(full.percent, 100);
  assert.equal(full.grade.grade, 1);
  assert.deepEqual(full.wrong, []);
  assert.equal(Object.keys(full.perTopic).length, 9);

  const none = scoreExam({ questions: qs, answers: {} });
  assert.equal(none.points, 0);
  assert.equal(none.maxPoints, full.maxPoints, 'unanswered still count towards the maximum');
  assert.equal(none.grade.grade, 6);
  assert.equal(none.wrong.length, 20);
  assert.ok(none.items.every((i) => !i.answered));
});

test('scoring: partial points count (multi, categorize, open)', () => {
  const multi = byGid('lf14-2/abc-11'); // B-Kunden: 3 solutions, 3 points
  const cat = byGid('lf14-2/abc-04'); // 6 items, 1 point each
  const open = byGid('lf14-2/abc-16'); // rubric 2+1+2+1 = 6
  const res = scoreExam({
    questions: [multi, cat, open],
    answers: {
      [multi.gid]: [0, 1], // 2 of 3 → 2 points
      [cat.gid]: [0, 0, 0, 1, 1, 0], // 5 of 6
      [open.gid]: { text: '…', met: [true, false, true, false] }, // 4 of 6
    },
  });
  assert.deepEqual(res.items.map((i) => i.grade.points), [2, 5, 4]);
  assert.equal(res.points, 11);
  assert.equal(res.maxPoints, 15);
  assert.ok(Math.abs(res.percent - 73.33) < 0.01);
  assert.equal(res.grade.grade, 3);
  assert.deepEqual(res.wrong, [multi.gid, cat.gid], 'open with 4/6 (≥ 60 %) counts as correct');
});

test('grade boundaries of the IHK key', () => {
  const cases = [[100, 1], [92, 1], [91.99, 2], [81, 2], [80.99, 3], [67, 3], [66.99, 4], [50, 4], [49.99, 5], [30, 5], [29.99, 6], [0, 6]];
  for (const [percent, grade] of cases) assert.equal(gradeForPercent(percent).grade, grade, `${percent} % → ${grade}`);
  assert.deepEqual(IHK_GRADE_SCALE.map((s) => s.label), ['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend']);
});

test('own grading key of a school (exam.gradeScale) works and is validated', () => {
  const school = [
    { minPercent: 90, grade: 1, label: 'sehr gut' },
    { minPercent: 75, grade: 2, label: 'gut' },
    { minPercent: 60, grade: 3, label: 'befriedigend' },
    { minPercent: 45, grade: 4, label: 'ausreichend' },
    { minPercent: 20, grade: 5, label: 'mangelhaft' },
    { minPercent: 0, grade: 6, label: 'ungenügend' },
  ];
  assert.equal(gradeForPercent(76, school).grade, 2);
  assert.equal(gradeForPercent(76).grade, 3);
  assert.deepEqual(validateUnit({ ...unit, exam: { ...unit.exam, gradeScale: school } }).errors, []);
  const broken = validateUnit({ ...unit, exam: { ...unit.exam, gradeScale: [{ minPercent: 50, grade: 1, label: 'x' }, { minPercent: 60, grade: 2, label: 'y' }] } });
  assert.ok(broken.errors.some((e) => /fallen/.test(e)));
  assert.ok(broken.errors.some((e) => /0 %/.test(e)));
});

test('exam XP: round(percent / 2), +10 from 50 %', () => {
  assert.equal(examXp(100), 60);
  assert.equal(examXp(74.5), 47);
  assert.equal(examXp(50), 35);
  assert.equal(examXp(49.9), 25);
  assert.equal(examXp(0), 0);
});

test('finishExam: history, mistake box for wrong answers, XP, streak, badges', () => {
  const now = () => new Date(2026, 9, 7, 17, 0).getTime();
  let state = createDefaultState(now);
  state = { ...state, league: { ...state.league, seed: 1 } };
  const gids = drawExam({ questions: path, config, rng: createRng(9) });
  const qs = gids.map(byGid);
  // the first three stay unanswered, the rest is right
  const answers = Object.fromEntries(qs.slice(3).map((q) => [q.gid, solution(q)]));
  const result = scoreExam({ questions: qs, answers });
  assert.deepEqual(result.wrong, gids.slice(0, 3));
  const done = finishExam(state, { now, unitId: 'lf14-2', result, durationSec: 1800, greenTopics: () => 0 });
  const s = done.state;
  assert.equal(s.exams.length, 1);
  assert.deepEqual(Object.keys(s.exams[0]).sort(), ['date', 'durationSec', 'grade', 'maxPoints', 'percent', 'points', 'unitId']);
  assert.equal(s.exams[0].date, '2026-10-07');
  assert.equal(s.exams[0].durationSec, 1800);
  for (const gid of result.wrong) {
    assert.equal(s.cards[gid].box, 1, `${gid}: box 1`);
    assert.equal(s.cards[gid].inMistakeBox, true, `${gid}: mistake box`);
    assert.equal(s.cards[gid].due, '2026-10-07');
  }
  const right = gids.find((g) => !result.wrong.includes(g));
  assert.equal(s.cards[right].box, 1);
  assert.equal(s.cards[right].inMistakeBox, false);
  assert.equal(done.xp, examXp(result.percent));
  assert.equal(s.days['2026-10-07'].xp, done.xp);
  assert.equal(s.days['2026-10-07'].minutes, 30);
  assert.equal(s.days['2026-10-07'].lessons, 0, 'an exam is not a lesson');
  assert.equal(s.streak.current, 1, 'but it counts for the streak');
  assert.equal(s.events.filter((e) => e.mode === 'exam').length, 20);
  const ids = done.badges.map((b) => b.id);
  assert.ok(ids.includes('first_exam'));
  assert.equal(ids.includes('exam_grade_2'), result.grade.grade <= 2);
});

test('Kann-Liste: mastery of the linked questions and the gap hint', () => {
  const canDo = unit.topics.find((t) => t.id === 'abc').canDo[1]; // 8 questions
  const gids = canDo.questionIds.map((id) => `lf14-2/${id}`);
  const mastered = (n) => Object.fromEntries(gids.slice(0, n).map((g) => [g, { box: 4, seen: 4 }]));
  assert.deepEqual(canDoStatus(canDo, 'lf14-2', {}, undefined), { mastered: 0, total: 8, ratio: 0, gap: null, message: null });
  const over = canDoStatus(canDo, 'lf14-2', mastered(3), 'sehr_sicher');
  assert.equal(over.gap, 'over');
  assert.equal(over.message, 'Du fühlst dich sicher, aber 5 von 8 Fragen sitzen noch nicht.');
  assert.equal(canDoStatus(canDo, 'lf14-2', mastered(4), 'ziemlich_sicher').gap, null, '⅔ vs ½ → no hint');
  const under = canDoStatus(canDo, 'lf14-2', mastered(7), 'unsicher');
  assert.equal(under.gap, 'under');
  assert.match(under.message, /sitzen schon 7 von 8 Fragen/);
  assert.equal(canDoStatus(canDo, 'lf14-2', mastered(8), 'sehr_sicher').gap, null);
});
