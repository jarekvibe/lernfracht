import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, parseNumberInput } from '../src/engine/numbers.js';

/** @param {string} input @param {number} expected */
function parses(input, expected) {
  assert.deepEqual(parseNumberInput(input), { ok: true, value: expected }, JSON.stringify(input));
}

test('comma present → comma is the decimal separator, dots are dropped', () => {
  parses('57.380,5', 57380.5);
  parses('1.234.567,89', 1234567.89);
  parses('12,5', 12.5);
  parses('0,25', 0.25);
  parses(',5', 0.5);
  parses('3,', 3);
});

test('no comma, groups of three after dots → thousands separators', () => {
  parses('57.380', 57380);
  parses('1.280.000', 1280000);
  parses('1.500', 1500);
  parses('-2.000', -2000);
});

test('otherwise the dot is the decimal separator', () => {
  parses('40.43', 40.43);
  parses('1.5', 1.5);
  parses('3.14159', 3.14159);
  parses('1234.5', 1234.5);
  parses('.5', 0.5);
});

test('plain integers and signs', () => {
  parses('64', 64);
  parses('0', 0);
  parses('-3,5', -3.5);
  parses('−3,5', -3.5); // typographic minus
  parses('+7', 7);
});

test('spaces, € and % are ignored', () => {
  parses(' 64 % ', 64);
  parses('1.280.000 €', 1280000);
  parses('€ 12,50', 12.5);
  parses('1 280 000', 1280000);
  parses('1 280', 1280);
  parses('1 280 000', 1280000);
});

test('invalid input is reported, not guessed', () => {
  for (const input of ['abc', '1,2,3', '12a', '1.2.3', '12.345.6', '--1', '1-', '1,5.3', '.', ',', '1e5', 'Infinity']) {
    assert.deepEqual(parseNumberInput(input), { ok: false, reason: 'invalid' }, JSON.stringify(input));
  }
});

test('empty input (also only spaces/symbols) is reported as empty', () => {
  for (const input of ['', '   ', '€', '%', ' € ', /** @type {any} */ (undefined)]) {
    assert.deepEqual(parseNumberInput(input), { ok: false, reason: 'empty' }, JSON.stringify(input));
  }
});

test('formatNumber uses German separators', () => {
  assert.equal(formatNumber(57380.5), '57.380,5');
  assert.equal(formatNumber(1280000), '1.280.000');
  assert.equal(formatNumber(64, 0), '64');
  assert.equal(formatNumber(40.425, 2), '40,43');
  assert.equal(formatNumber(2.5, 2), '2,50');
  assert.equal(formatNumber(-3.5), '-3,5');
});
