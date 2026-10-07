import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_EXAM_POINTS,
  gradeAnswer,
  gradeCategorize,
  gradeCloze,
  gradeMulti,
  gradeNumeric,
  gradeOpen,
  gradeOpenResult,
  gradeOrder,
  gradeSingle,
  gradeTrueFalse,
  keywordHits,
  maxPoints,
} from '../src/engine/grading.js';
import { createLocalProvider } from '../src/engine/ai/local.js';

const base = { id: 'x', topic: 't', difficulty: 1, prompt: '?', explanation: '!', sourceRef: 'S. 1' };
const single = { ...base, type: 'single', options: ['a', 'b', 'c', 'd'], answer: 2 };
const multi = { ...base, type: 'multi', options: ['a', 'b', 'c', 'd', 'e', 'f'], answer: [0, 1, 2] };
const tf = { ...base, type: 'truefalse', answer: false };
const categorize = {
  ...base,
  type: 'categorize',
  categories: ['A', 'B'],
  items: [{ text: '1', category: 0 }, { text: '2', category: 0 }, { text: '3', category: 1 }, { text: '4', category: 1 }],
};
const order = { ...base, type: 'order', items: ['a', 'b', 'c', 'd'] };
const cloze = {
  ...base,
  type: 'cloze',
  text: '{0} und {1} und {2}',
  gaps: [{ answer: 'Entgelt' }, { answer: 'Maßstab', alternatives: ['Kriterium'] }, { answer: 'Erträge' }],
  distractors: ['Rabatt'],
};
const numeric = { ...base, type: 'numeric', answer: 64, tolerance: 0.5, unit: '%' };
const open = {
  ...base,
  type: 'open',
  modelAnswer: 'M',
  rubric: [{ criterion: 'K1', points: 2 }, { criterion: 'K2', points: 1 }, { criterion: 'K3', points: 2 }],
  keywords: ['Umsatz', 'A-Kunden', 'kumul', 'Ressourcen'],
};

test('default exam points per type (SPEC §4.3)', () => {
  assert.deepEqual(DEFAULT_EXAM_POINTS, { single: 2, multi: 3, truefalse: 1, order: 3, numeric: 3 });
  assert.equal(maxPoints(single), 2);
  assert.equal(maxPoints(multi), 3);
  assert.equal(maxPoints(tf), 1);
  assert.equal(maxPoints(categorize), 4, '1 per item');
  assert.equal(maxPoints(order), 3);
  assert.equal(maxPoints(cloze), 3, '1 per gap');
  assert.equal(maxPoints(numeric), 3);
  assert.equal(maxPoints(open), 5, 'sum of rubric points');
});

test('examPoints overrides the default and scales partial points', () => {
  const q = { ...categorize, examPoints: 8 };
  assert.equal(maxPoints(q), 8);
  const g = gradeCategorize(q, [0, 0, 1, 0]);
  assert.equal(g.points, 6);
  assert.equal(g.maxPoints, 8);
});

test('single: index must match', () => {
  assert.deepEqual(gradeSingle(single, 2), { correct: true, score: 1, points: 2, maxPoints: 2 });
  assert.deepEqual(gradeSingle(single, 0), { correct: false, score: 0, points: 0, maxPoints: 2 });
  assert.equal(gradeSingle(single, null).correct, false);
});

test('multi: selection must equal the solution set; partial = max(0, right − wrong) / solutions × 3', () => {
  const all = gradeMulti(multi, [2, 0, 1]);
  assert.equal(all.correct, true);
  assert.equal(all.points, 3);

  const twoRight = gradeMulti(multi, [0, 1]);
  assert.equal(twoRight.correct, false);
  assert.equal(twoRight.points, 2);
  assert.deepEqual(twoRight.parts, { right: 2, total: 3 });

  const allPlusWrong = gradeMulti(multi, [0, 1, 2, 3]);
  assert.equal(allPlusWrong.correct, false);
  assert.equal(allPlusWrong.points, 2);

  const twoRightOneWrong = gradeMulti(multi, [0, 1, 4]);
  assert.equal(twoRightOneWrong.points, 1);

  const moreWrongThanRight = gradeMulti(multi, [0, 3, 4]);
  assert.equal(moreWrongThanRight.points, 0, 'never below zero');
  assert.equal(moreWrongThanRight.score, 0);

  assert.equal(gradeMulti(multi, []).points, 0);
});

test('truefalse: value must match', () => {
  assert.equal(gradeTrueFalse(tf, false).correct, true);
  assert.equal(gradeTrueFalse(tf, false).points, 1);
  assert.equal(gradeTrueFalse(tf, true).correct, false);
});

test('categorize: all items correct; 1 point per correct item', () => {
  const allRight = gradeCategorize(categorize, [0, 0, 1, 1]);
  assert.equal(allRight.correct, true);
  assert.equal(allRight.points, 4);
  assert.deepEqual(allRight.marks, [true, true, true, true]);

  const oneWrong = gradeCategorize(categorize, [0, 1, 1, 1]);
  assert.equal(oneWrong.correct, false);
  assert.equal(oneWrong.points, 3);
  assert.equal(oneWrong.score, 0.75);
  assert.deepEqual(oneWrong.marks, [true, false, true, true]);

  const unassigned = gradeCategorize(categorize, [0, null, 1, 1]);
  assert.equal(unassigned.points, 3);
});

test('order: identical order; partial = share of correctly placed items × 3', () => {
  const right = gradeOrder(order, [0, 1, 2, 3]);
  assert.equal(right.correct, true);
  assert.equal(right.points, 3);

  const swapped = gradeOrder(order, [0, 1, 3, 2]);
  assert.equal(swapped.correct, false);
  assert.equal(swapped.points, 1.5);
  assert.deepEqual(swapped.marks, [true, true, false, false]);

  const reversed = gradeOrder(order, [3, 2, 1, 0]);
  assert.equal(reversed.points, 0);
});

test('order: points are rounded to two decimals', () => {
  const five = { ...order, items: ['a', 'b', 'c', 'd', 'e', 'f'] };
  const g = gradeOrder(five, [0, 2, 1, 3, 5, 4]);
  assert.equal(g.points, 1); // 2/6 × 3
  const seven = { ...order, items: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
  assert.equal(gradeOrder(seven, [0, 2, 1, 3, 4, 6, 5]).points, 1.29); // 3/7 × 3 = 1.2857…
});

test('cloze: all gaps correct; 1 point per gap; alternatives, case and spaces tolerated', () => {
  const right = gradeCloze(cloze, ['Entgelt', 'Maßstab', 'Erträge']);
  assert.equal(right.correct, true);
  assert.equal(right.points, 3);

  assert.equal(gradeCloze(cloze, [' entgelt ', 'kriterium', 'ERTRÄGE']).correct, true);

  const partial = gradeCloze(cloze, ['Entgelt', 'Rabatt', null]);
  assert.equal(partial.correct, false);
  assert.equal(partial.points, 1);
  assert.deepEqual(partial.marks, [true, false, false]);
});

test('numeric: |input − answer| ≤ tolerance', () => {
  assert.equal(gradeNumeric(numeric, 64).correct, true);
  assert.equal(gradeNumeric(numeric, 64.5).correct, true, 'upper edge');
  assert.equal(gradeNumeric(numeric, 63.5).correct, true, 'lower edge');
  assert.equal(gradeNumeric(numeric, 64.51).correct, false);
  assert.equal(gradeNumeric(numeric, 64).points, 3);
  assert.equal(gradeNumeric(numeric, Number.NaN).correct, false);
  const exact = { ...numeric, answer: 40.43, tolerance: 0 };
  assert.equal(gradeNumeric(exact, 40.43).correct, true);
  assert.equal(gradeNumeric({ ...numeric, answer: 0.3, tolerance: 0 }, 0.1 + 0.2).correct, true, 'float noise');
});

test('open: correct from 60 % of the rubric points', () => {
  const full = gradeOpen(open, [true, true, true]);
  assert.equal(full.correct, true);
  assert.equal(full.points, 5);
  assert.deepEqual(full.marks, [true, true, true]);

  const exactlySixty = gradeOpen(open, [true, true, false]); // 3 / 5 = 60 %
  assert.equal(exactlySixty.correct, true);
  assert.equal(exactlySixty.points, 3);

  const below = gradeOpen(open, [true, false, false]); // 2 / 5 = 40 %
  assert.equal(below.correct, false);
  assert.equal(below.points, 2);
  assert.deepEqual(below.parts, { right: 2, total: 5 });

  assert.equal(gradeOpen(open, []).points, 0);
});

test('open via LocalProvider: self-assessment becomes a GradeResult and then a Grade', async () => {
  const ai = createLocalProvider();
  const res = await ai.gradeOpenAnswer(open, 'Mein Text', { selfAssessment: [true, false, true] });
  assert.deepEqual(res, {
    points: 4,
    maxPoints: 5,
    criteria: [{ criterion: 'K1', met: true }, { criterion: 'K2', met: false }, { criterion: 'K3', met: true }],
    feedback: '',
    source: 'self',
  });
  const g = gradeOpenResult(open, res);
  assert.equal(g.correct, true);
  assert.equal(g.points, 4);
  const none = await ai.gradeOpenAnswer(open, 'x');
  assert.equal(none.points, 0);
  assert.equal(await ai.explainMistake(single, 0), '!');
});

test('keyword hint: case-insensitive substring, not part of the grade', () => {
  const hits = keywordHits(open, 'Nach UMSATZ sortieren, dann kumulieren. a-kunden zuerst.');
  assert.deepEqual(hits, { used: ['Umsatz', 'A-Kunden', 'kumul'], total: 4 });
  assert.deepEqual(keywordHits(open, ''), { used: [], total: 4 });
});

test('gradeAnswer dispatches by type and rejects unknown types', () => {
  assert.equal(gradeAnswer(single, 2).correct, true);
  assert.equal(gradeAnswer(open, { text: '', met: [true, true, true] }).correct, true);
  assert.throws(() => gradeAnswer({ ...base, type: 'essay' }, 1), /Unbekannter Fragetyp/);
});

test('every lf14-2 question: the content solution scores full points', () => {
  const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
  /** @param {any} q */
  const solutionOf = (q) => {
    switch (q.type) {
      case 'single':
      case 'multi':
      case 'truefalse':
      case 'numeric':
        return q.answer;
      case 'categorize':
        return q.items.map((/** @type {any} */ item) => item.category);
      case 'order':
        return q.items.map((/** @type {any} */ _, /** @type {number} */ i) => i);
      case 'cloze':
        return q.gaps.map((/** @type {any} */ gap) => gap.answer);
      case 'open':
        return { text: q.modelAnswer, met: q.rubric.map(() => true) };
      default:
        throw new Error(q.type);
    }
  };
  for (const q of unit.questions) {
    const g = gradeAnswer(q, solutionOf(q));
    assert.equal(g.correct, true, q.id);
    assert.equal(g.points, g.maxPoints, q.id);
    assert.ok(g.maxPoints > 0, q.id);
  }
});
