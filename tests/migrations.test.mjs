import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_VERSION, MIGRATIONS, MigrationError, migrate } from '../src/engine/migrations.js';

test('current version passes through unchanged', () => {
  const input = { version: CURRENT_VERSION, profile: { nickname: 'a' } };
  const { state, fromVersion } = migrate(input);
  assert.deepEqual(state, input);
  assert.equal(fromVersion, CURRENT_VERSION);
  assert.notEqual(state, input, 'returns a copy');
});

test('every version below the current one has a migration step', () => {
  for (let v = 1; v < CURRENT_VERSION; v += 1) {
    assert.equal(typeof MIGRATIONS[v], 'function', `missing step ${v} → ${v + 1}`);
  }
});

test('steps run in order and set the version after each step', () => {
  const calls = [];
  const migrations = {
    1: (s) => {
      calls.push(['1→2', s.version]);
      return { ...s, renamed: s.old, old: undefined };
    },
    2: (s) => {
      calls.push(['2→3', s.version]);
      return { ...s, added: true };
    },
  };
  const input = { version: 1, old: 'x' };
  const { state, fromVersion } = migrate(input, { migrations, targetVersion: 3 });
  assert.deepEqual(calls, [['1→2', 1], ['2→3', 2]]);
  assert.equal(fromVersion, 1);
  assert.equal(state.version, 3);
  assert.equal(state.renamed, 'x');
  assert.equal(state.added, true);
  assert.deepEqual(input, { version: 1, old: 'x' }, 'input not mutated');
});

test('migration starts at the stored version', () => {
  const migrations = { 1: () => assert.fail('must not run'), 2: (s) => ({ ...s, two: true }) };
  const { state } = migrate({ version: 2 }, { migrations, targetVersion: 3 });
  assert.equal(state.two, true);
  assert.equal(state.version, 3);
});

test('a step mutating its argument does not touch the input', () => {
  const migrations = { 1: (s) => { s.profile.nickname = 'neu'; return s; } };
  const input = { version: 1, profile: { nickname: 'alt' } };
  migrate(input, { migrations, targetVersion: 2 });
  assert.equal(input.profile.nickname, 'alt');
});

test('missing step → MigrationError missing-step', () => {
  assert.throws(
    () => migrate({ version: 1 }, { migrations: {}, targetVersion: 2 }),
    (e) => e instanceof MigrationError && e.code === 'missing-step' && e.version === 1,
  );
});

test('newer version → MigrationError newer', () => {
  assert.throws(
    () => migrate({ version: CURRENT_VERSION + 1 }),
    (e) => e instanceof MigrationError && e.code === 'newer' && e.version === CURRENT_VERSION + 1,
  );
});

test('invalid input → MigrationError invalid', () => {
  for (const input of [null, [], 'x', 3, { version: 0 }, { version: -1 }, { version: 1.5 }, { version: '1' }]) {
    assert.throws(() => migrate(input), (e) => e instanceof MigrationError && e.code === 'invalid', JSON.stringify(input));
  }
});

test('missing version is treated as version 1', () => {
  const { state, fromVersion } = migrate({ profile: {} });
  assert.equal(fromVersion, 1);
  assert.equal(state.version, CURRENT_VERSION);
});
