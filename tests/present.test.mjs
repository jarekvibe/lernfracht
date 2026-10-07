import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareQuestion } from '../src/engine/present.js';
import { createRng, hashString, shuffle } from '../src/engine/random.js';
import { describeSolution, splitCloze } from '../src/engine/solution.js';

const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
/** @param {string} id */
const byId = (id) => unit.questions.find((/** @type {any} */ q) => q.id === id);
/** @param {number[]} list */
const sorted = (list) => [...list].sort((a, b) => a - b);

test('rng is deterministic per seed and stays in [0, 1)', () => {
  const a = createRng(4711);
  const b = createRng(4711);
  const seqA = Array.from({ length: 50 }, a);
  assert.deepEqual(seqA, Array.from({ length: 50 }, b));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(seqA, Array.from({ length: 50 }, createRng(4712)));
  assert.equal(hashString('2026-W41:3'), hashString('2026-W41:3'));
  assert.notEqual(hashString('2026-W41:3'), hashString('2026-W41:4'));
});

test('shuffle returns a permutation and leaves the input alone', () => {
  const input = [1, 2, 3, 4, 5, 6, 7];
  const out = shuffle(input, createRng(1));
  assert.deepEqual(sorted(out), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7]);
});

test('every lf14-2 question can be prepared; orders are permutations of content indices', () => {
  for (const q of unit.questions) {
    const p = prepareQuestion(q, createRng(hashString(q.id)));
    if (q.type === 'single' || q.type === 'multi') assert.deepEqual(sorted(p.optionOrder), q.options.map((_, i) => i), q.id);
    if (q.type === 'categorize') assert.deepEqual(sorted(p.itemOrder), q.items.map((_, i) => i), q.id);
    if (q.type === 'order') assert.deepEqual(sorted(p.start), q.items.map((_, i) => i), q.id);
    if (q.type === 'cloze') assert.equal(p.wordBank.length, q.gaps.length + q.distractors.length, q.id);
  }
});

test('same seed → same presentation', () => {
  const q = byId('abc-11');
  assert.deepEqual(prepareQuestion(q, createRng(9)), prepareQuestion(q, createRng(9)));
});

test('order questions never start already solved', () => {
  const q = byId('abc-03');
  for (let seed = 0; seed < 500; seed += 1) {
    const { start } = prepareQuestion(q, createRng(seed));
    assert.ok(start.some((v, i) => v !== i), `seed ${seed}`);
  }
  // even with a degenerate rng that always returns the identity
  const { start } = prepareQuestion(q, () => 0.999999);
  assert.ok(start.some((v, i) => v !== i));
});

test('cloze word bank holds every solution and every distractor once', () => {
  const q = byId('pr-08');
  const { wordBank } = prepareQuestion(q, createRng(3));
  const texts = wordBank.map((w) => w.text).sort();
  assert.deepEqual(texts, [...q.gaps.map((g) => g.answer), ...q.distractors].sort());
  assert.equal(new Set(wordBank.map((w) => w.id)).size, wordBank.length, 'unique ids');
});

test('splitCloze alternates text and gap indices', () => {
  assert.deepEqual(splitCloze('A {0} B {1}'), ['A ', 0, ' B ', 1, '']);
  assert.deepEqual(splitCloze('{0}'), ['', 0, '']);
  assert.deepEqual(splitCloze('ohne'), ['ohne']);
});

test('describeSolution for every type', () => {
  assert.deepEqual(describeSolution(byId('abc-01')), { kind: 'text', text: 'Nach ihrem Umsatz in einer Periode (meist ein Jahr)' });
  assert.deepEqual(describeSolution(byId('abc-11')), { kind: 'list', ordered: false, items: ['Mirage', 'Mohls', 'Miesbach'] });
  assert.deepEqual(describeSolution(byId('abc-14')), { kind: 'text', text: 'Stimmt nicht' });
  const groups = describeSolution(byId('abc-04'));
  assert.equal(groups.kind, 'groups');
  assert.deepEqual(groups.groups.map((g) => [g.title, g.items.length]), [['Vorteil', 3], ['Nachteil', 3]]);
  const ord = describeSolution(byId('abc-03'));
  assert.equal(ord.kind, 'list');
  assert.equal(ord.ordered, true);
  assert.equal(ord.items[0], 'Gesamtumsatz aller Kunden ermitteln');
  const cl = describeSolution(byId('pr-08'));
  assert.equal(cl.kind, 'cloze');
  assert.deepEqual(cl.segments.filter((s) => 'gap' in s).map((s) => s.gap), ['Entgelt', 'Maßstab', 'Erträge', 'konkurrenzfähig']);
  assert.deepEqual(describeSolution(byId('abc-05')), { kind: 'text', text: '64 %' });
  assert.equal(describeSolution(byId('abc-16')).kind, 'text');
});
