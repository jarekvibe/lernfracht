import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog, globalQuestionId, validateUnit } from '../src/engine/content.js';

const realUnit = () => JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));

/** Smallest valid unit with one question of every type. */
function makeUnit() {
  const base = { topic: 't1', difficulty: 1, prompt: 'Frage?', explanation: 'Weil.', sourceRef: 'S. 1' };
  return {
    schemaVersion: 1,
    id: 'test-unit',
    lernfeld: { id: 'LF1', title: 'Testfeld' },
    title: 'Testeinheit',
    description: 'Nur für Tests',
    reviewStatus: 'draft',
    exam: { title: 'Test', questionCount: 4, durationMinutes: 10, maxOpenQuestions: 1, topicWeights: { t1: 1, t2: 2 } },
    topics: [
      { id: 't2', title: 'Zweites', order: 2, icon: '🧪', canDo: [{ id: 't2.c1', text: 'Ich kann …', questionIds: ['q-tf', 'q-cat', 'q-ord', 'q-cloze', 'q-num', 'q-open'] }] },
      { id: 't1', title: 'Erstes', order: 1, icon: '📦', canDo: [{ id: 't1.c1', text: 'Ich kann …', questionIds: ['q-single', 'q-multi'] }] },
    ],
    questions: [
      { ...base, id: 'q-single', type: 'single', options: ['a', 'b', 'c'], answer: 1 },
      { ...base, id: 'q-multi', type: 'multi', options: ['a', 'b', 'c'], answer: [0, 2] },
      { ...base, id: 'q-tf', topic: 't2', type: 'truefalse', answer: false },
      { ...base, id: 'q-cat', topic: 't2', type: 'categorize', categories: ['X', 'Y'], items: [{ text: 'x1', category: 0 }, { text: 'y1', category: 1 }] },
      { ...base, id: 'q-ord', topic: 't2', type: 'order', items: ['eins', 'zwei', 'drei'] },
      { ...base, id: 'q-cloze', topic: 't2', type: 'cloze', text: 'A {0} und {1}.', gaps: [{ answer: 'B' }, { answer: 'C', alternatives: ['Cc'] }], distractors: ['D'] },
      {
        ...base, id: 'q-num', topic: 't2', type: 'numeric', answer: 64, tolerance: 0.5, unit: '%', decimals: 0,
        context: { text: 'Tabelle:', table: { headers: ['A', 'B'], rows: [['1', '2']] } },
      },
      { ...base, id: 'q-open', topic: 't2', type: 'open', modelAnswer: 'Muster', rubric: [{ criterion: 'K1', points: 2 }], keywords: ['Muster'] },
    ],
  };
}

/** @param {(u: any) => void} mutate */
function errorsAfter(mutate) {
  const unit = makeUnit();
  mutate(unit);
  return validateUnit(unit).errors;
}

/** @param {any} unit @param {string} id */
const q = (unit, id) => unit.questions.find((x) => x.id === id);

/** @param {string[]} errors @param {RegExp} pattern */
function assertError(errors, pattern) {
  assert.ok(errors.some((e) => pattern.test(e)), `expected error ${pattern}, got:\n${errors.join('\n') || '(none)'}`);
}

test('lf14-2.json validates without errors or warnings', () => {
  const { errors, warnings } = validateUnit(realUnit());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('catalog of lf14-2 has 9 topics in path order and 90 questions', () => {
  const catalog = createCatalog([realUnit()]);
  const unit = catalog.getUnit('lf14-2');
  assert.ok(unit);
  assert.equal(unit.topics.length, 9);
  assert.deepEqual(unit.topics.map((t) => t.order), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(unit.topics[0].id, 'abc');
  assert.equal(catalog.questionCount, 90);
  const total = unit.topics.reduce((n, t) => n + catalog.getTopicQuestions('lf14-2', t.id).length, 0);
  assert.equal(total, 90);
});

test('catalog: topics sorted by order, global ids, lookups', () => {
  const catalog = createCatalog([makeUnit()]);
  const unit = catalog.getUnit('test-unit');
  assert.deepEqual(unit.topics.map((t) => t.id), ['t1', 't2']);
  assert.equal(globalQuestionId('test-unit', 'q-tf'), 'test-unit/q-tf');
  const question = catalog.getQuestion('test-unit/q-tf');
  assert.equal(question.type, 'truefalse');
  assert.equal(question.unitId, 'test-unit');
  assert.deepEqual(catalog.getTopicQuestions('test-unit', 't1').map((x) => x.id), ['q-single', 'q-multi']);
  assert.deepEqual(catalog.getPathQuestions('test-unit').map((x) => x.id), ['q-single', 'q-multi', 'q-tf', 'q-cat', 'q-ord', 'q-cloze', 'q-num', 'q-open']);
  assert.deepEqual(catalog.getPathQuestions('nope'), []);
  assert.equal(catalog.getQuestion('test-unit/nope'), null);
  assert.equal(catalog.getUnit('nope'), null);
  assert.deepEqual(catalog.getTopicQuestions('test-unit', 'nope'), []);
});

test('catalog does not mutate the input units', () => {
  const unit = makeUnit();
  createCatalog([unit]);
  assert.equal(unit.topics[0].id, 't2');
  assert.equal(unit.questions[0].gid, undefined);
});

test('fixture is valid', () => {
  assert.deepEqual(validateUnit(makeUnit()), { errors: [], warnings: [] });
});

test('unit level: schema version, ids, required fields', () => {
  assertError(errorsAfter((u) => { u.schemaVersion = 2; }), /schemaVersion/);
  assertError(errorsAfter((u) => { u.id = 'Mit Leerzeichen'; }), /^id:/);
  assertError(errorsAfter((u) => { delete u.title; }), /^title:/);
  assertError(errorsAfter((u) => { u.lernfeld = { id: 'LF1' }; }), /^lernfeld:/);
  assertError(errorsAfter((u) => { u.reviewStatus = 'fertig'; }), /reviewStatus/);
  assertError(errorsAfter((u) => { u.topics = []; }), /^topics:/);
  assert.equal(validateUnit(null).errors.length, 1);
});

test('required question fields and unknown types', () => {
  for (const field of ['prompt', 'explanation', 'sourceRef']) {
    assertError(errorsAfter((u) => { delete q(u, 'q-single')[field]; }), new RegExp(`\\[q-single\\].*${field}`));
  }
  assertError(errorsAfter((u) => { q(u, 'q-single').difficulty = 4; }), /difficulty/);
  assertError(errorsAfter((u) => { q(u, 'q-single').type = 'essay'; }), /unbekannter Typ „essay“/);
  assertError(errorsAfter((u) => { q(u, 'q-single').examPoints = 0; }), /examPoints/);
});

test('ids unique, topics exist, every topic has a question', () => {
  assertError(errorsAfter((u) => { q(u, 'q-multi').id = 'q-single'; }), /doppelte Frage-ID/);
  assertError(errorsAfter((u) => { u.topics[1].id = 't2'; }), /doppelte Themen-ID/);
  assertError(errorsAfter((u) => { q(u, 'q-single').topic = 'gibtsnicht'; }), /Thema „gibtsnicht“ existiert nicht/);
  assertError(
    errorsAfter((u) => {
      u.topics.push({ id: 't3', title: 'Leer', order: 3 });
    }),
    /topics\[t3\]: hat keine Fragen/,
  );
  assertError(errorsAfter((u) => { u.topics[0].canDo[0].id = 't1.c1'; }), /doppelte canDo-ID/);
});

test('single: answer index in range', () => {
  assertError(errorsAfter((u) => { q(u, 'q-single').answer = 3; }), /Options-Index/);
  assertError(errorsAfter((u) => { q(u, 'q-single').answer = -1; }), /Options-Index/);
  assertError(errorsAfter((u) => { q(u, 'q-single').options = ['nur eine']; }), /options/);
  assertError(errorsAfter((u) => { q(u, 'q-single').options = ['a', 'A', 'b']; }), /Duplikate/);
});

test('multi: ≥ 1 solution, indices in range, ≥ 1 wrong option', () => {
  assertError(errorsAfter((u) => { q(u, 'q-multi').answer = []; }), /mindestens eine Lösung/);
  assertError(errorsAfter((u) => { q(u, 'q-multi').answer = [0, 5]; }), /ungültige Indizes/);
  assertError(errorsAfter((u) => { q(u, 'q-multi').answer = [0, 1, 2]; }), /mindestens eine Option muss falsch/);
  assertError(errorsAfter((u) => { q(u, 'q-multi').answer = [0, 0]; }), /doppelte Indizes/);
});

test('truefalse: boolean answer', () => {
  assertError(errorsAfter((u) => { q(u, 'q-tf').answer = 'false'; }), /true oder false/);
});

test('categorize: every category used, valid indices', () => {
  assertError(errorsAfter((u) => { q(u, 'q-cat').items[1].category = 0; }), /Kategorie „Y“ wird nie benutzt/);
  assertError(errorsAfter((u) => { q(u, 'q-cat').items[1].category = 2; }), /keine gültige `category`/);
  assertError(errorsAfter((u) => { q(u, 'q-cat').categories = ['X']; }), /categories/);
});

test('order: ≥ 3 items, no duplicates', () => {
  assertError(errorsAfter((u) => { q(u, 'q-ord').items = ['eins', 'zwei']; }), /mindestens drei/);
  assertError(errorsAfter((u) => { q(u, 'q-ord').items = ['eins', 'zwei', 'eins']; }), /Duplikate/);
});

test('cloze: placeholders match gaps exactly, no distractor equals a solution', () => {
  assertError(errorsAfter((u) => { q(u, 'q-cloze').text = 'A {0}.'; }), /Lücke 1 hat keinen Platzhalter/);
  assertError(errorsAfter((u) => { q(u, 'q-cloze').text = 'A {0} {1} {2}.'; }), /Platzhalter \{2\} hat keine Lücke/);
  assertError(errorsAfter((u) => { q(u, 'q-cloze').text = 'A {0} {0} {1}.'; }), /\{0\} kommt mehrfach vor/);
  assertError(errorsAfter((u) => { q(u, 'q-cloze').distractors = ['b']; }), /Distraktor „b“ ist auch eine Lösung/);
  assertError(errorsAfter((u) => { q(u, 'q-cloze').distractors = ['cc']; }), /Distraktor „cc“ ist auch eine Lösung/);
  assertError(errorsAfter((u) => { q(u, 'q-cloze').distractors = ['D', 'd']; }), /distractors.*Duplikate/);
});

test('numeric: tolerance ≥ 0', () => {
  assertError(errorsAfter((u) => { q(u, 'q-num').tolerance = -0.1; }), /tolerance/);
  assertError(errorsAfter((u) => { delete q(u, 'q-num').tolerance; }), /tolerance/);
  assertError(errorsAfter((u) => { q(u, 'q-num').answer = '64'; }), /`answer` muss eine Zahl/);
  assert.deepEqual(errorsAfter((u) => { q(u, 'q-num').tolerance = 0; }), []);
});

test('open: rubric points > 0, model answer not empty', () => {
  assertError(errorsAfter((u) => { q(u, 'q-open').rubric[0].points = 0; }), /points muss > 0/);
  assertError(errorsAfter((u) => { q(u, 'q-open').modelAnswer = '  '; }), /modelAnswer/);
  assertError(errorsAfter((u) => { q(u, 'q-open').rubric = []; }), /rubric/);
});

test('context table: rows must match header width', () => {
  assertError(errorsAfter((u) => { q(u, 'q-num').context.table.rows.push(['nur eins']); }), /rows\[1\] hat 1 statt 2 Spalten/);
  assertError(errorsAfter((u) => { q(u, 'q-num').context = {}; }), /context/);
});

test('cross references: canDo ids, exam weights and question count', () => {
  assertError(errorsAfter((u) => { u.topics[0].canDo[0].questionIds.push('gibtsnicht'); }), /Frage „gibtsnicht“ existiert nicht/);
  assertError(errorsAfter((u) => { u.exam.topicWeights.t9 = 1; }), /Thema „t9“ existiert nicht/);
  assertError(errorsAfter((u) => { u.exam.questionCount = 9; }), /9 > Anzahl Fragen \(8\)/);
  assertError(errorsAfter((u) => { u.exam.topicWeights = { t1: 0 }; }), /Summe der Gewichte/);
  assertError(errorsAfter((u) => { delete u.exam; }), /^exam: fehlt/);
});

test('warnings: unlinked questions and unknown fields do not fail validation', () => {
  const unit = makeUnit();
  unit.topics[0].canDo[0].questionIds = ['q-tf'];
  q(unit, 'q-single').explaination = 'Tippfehler';
  const { errors, warnings } = validateUnit(unit);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /nicht in der Kann-Liste verlinkt: .*q-cat/.test(w)), warnings.join('\n'));
  assert.ok(warnings.some((w) => /unbekanntes Feld „explaination“/.test(w)), warnings.join('\n'));
});
