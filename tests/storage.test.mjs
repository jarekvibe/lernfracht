import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_KEY_PREFIX,
  MAX_EVENTS,
  STORAGE_KEY,
  createDefaultState,
  createMemoryBackend,
  createStorage,
  loadState,
  normalizeState,
  serializeState,
} from '../src/engine/storage.js';
import { CURRENT_VERSION } from '../src/engine/migrations.js';

// 2026-10-07 12:00 lokale Zeit
const NOW = new Date(2026, 9, 7, 12, 0, 0).getTime();
const now = () => NOW;

/** Fake timers: run() fires all scheduled callbacks. */
function fakeTimers() {
  /** @type {Map<number, () => void>} */
  const pending = new Map();
  let next = 1;
  return {
    setTimer: (fn) => {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clearTimer: (id) => pending.delete(id),
    run() {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((fn) => fn());
    },
    get size() {
      return pending.size;
    },
  };
}

test('default state has the documented shape and a local createdAt', () => {
  const s = createDefaultState(now);
  assert.equal(s.version, CURRENT_VERSION);
  assert.deepEqual(s.profile, {
    nickname: '',
    dailyGoalXp: 60,
    reminderTime: '18:00',
    appUrl: '',
    examDates: {},
    theme: 'dark',
    haptics: true,
    createdAt: '2026-10-07',
    onboardedAt: null,
    notify: false,
    lastReminderDate: null,
  });
  assert.deepEqual(s.streak, { current: 0, longest: 0, lastActiveDate: null, freezes: 0, frozenDates: [] });
  assert.deepEqual(s.cards, {});
  assert.deepEqual(s.events, []);
});

test('createdAt uses the local day just before midnight (no UTC shift)', () => {
  const lateEvening = () => new Date(2026, 9, 7, 23, 59, 30).getTime();
  assert.equal(createDefaultState(lateEvening).profile.createdAt, '2026-10-07');
});

test('empty storage → default state, no notice, writable', () => {
  const result = loadState({ backend: createMemoryBackend(), now });
  assert.deepEqual(result.state, createDefaultState(now));
  assert.equal(result.notice, null);
  assert.equal(result.readOnly, false);
});

test('save → load roundtrip keeps the state', () => {
  const backend = createMemoryBackend();
  const timers = fakeTimers();
  const storage = createStorage({ backend, now, ...timers });
  const state = createDefaultState(now);
  state.profile.nickname = 'jarek';
  state.cards['lf14-2/abc-05'] = { box: 2, due: '2026-10-10', seen: 3, correct: 2, streakCorrect: 1, lastAnswered: '2026-10-07', inMistakeBox: false };
  state.days['2026-10-07'] = { xp: 70, lessons: 2, minutes: 9 };
  storage.save(state);
  storage.flush();
  const loaded = loadState({ backend, now });
  assert.deepEqual(loaded.state, state);
  assert.equal(loaded.notice, null);
});

test('saves are debounced and always write the latest state', () => {
  const backend = createMemoryBackend();
  const timers = fakeTimers();
  let writes = 0;
  const counting = { ...backend, setItem: (k, v) => { writes += 1; backend.setItem(k, v); } };
  const storage = createStorage({ backend: counting, now, ...timers });
  const a = createDefaultState(now);
  const b = { ...a, profile: { ...a.profile, nickname: 'b' } };
  const c = { ...a, profile: { ...a.profile, nickname: 'c' } };
  storage.save(a);
  storage.save(b);
  storage.save(c);
  assert.equal(writes, 0, 'nothing written before the timer fires');
  assert.equal(timers.size, 1, 'only one timer scheduled');
  timers.run();
  assert.equal(writes, 1);
  assert.equal(JSON.parse(backend.getItem(STORAGE_KEY)).profile.nickname, 'c');
});

test('flush writes immediately and cancels the pending timer', () => {
  const backend = createMemoryBackend();
  const timers = fakeTimers();
  const storage = createStorage({ backend, now, ...timers });
  storage.save(createDefaultState(now));
  storage.flush();
  assert.notEqual(backend.getItem(STORAGE_KEY), null);
  assert.equal(timers.size, 0);
  storage.flush(); // nothing pending → no error, no extra write
});

test('write errors (e.g. quota) are reported, not thrown', () => {
  const errors = [];
  const backend = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  const storage = createStorage({ backend, now, ...fakeTimers(), onError: (e) => errors.push(e) });
  storage.save(createDefaultState(now));
  assert.doesNotThrow(() => storage.flush());
  assert.equal(errors.length, 1);
});

test('corrupt JSON → raw data backed up, fresh state, notice', () => {
  const backend = createMemoryBackend({ [STORAGE_KEY]: '{"version":1, kaputt' });
  const result = loadState({ backend, now });
  const backupKey = `${BACKUP_KEY_PREFIX}${NOW}`;
  assert.deepEqual(result.notice, { code: 'corrupt', backupKey });
  assert.equal(backend.getItem(backupKey), '{"version":1, kaputt');
  assert.deepEqual(result.state, createDefaultState(now));
  assert.equal(result.readOnly, false);
});

test('corrupt data is backed up only once (fresh state replaces it right away)', () => {
  const backend = createMemoryBackend({ [STORAGE_KEY]: 'kaputt' });
  loadState({ backend, now });
  const second = loadState({ backend, now: () => NOW + 1000 });
  assert.equal(second.notice, null);
  const backups = Object.keys(backend.dump()).filter((k) => k.startsWith(BACKUP_KEY_PREFIX));
  assert.deepEqual(backups, [`${BACKUP_KEY_PREFIX}${NOW}`]);
});

test('valid JSON that is not a state object counts as corrupt', () => {
  for (const raw of ['[]', '"hallo"', '42', 'null', '{"version":"eins"}', '{"version":0}']) {
    const backend = createMemoryBackend({ [STORAGE_KEY]: raw });
    const result = loadState({ backend, now });
    assert.equal(result.notice?.code, 'corrupt', raw);
    assert.equal(backend.getItem(`${BACKUP_KEY_PREFIX}${NOW}`), raw);
  }
});

test('corrupt data that cannot be backed up is protected by read-only mode', () => {
  const store = createMemoryBackend({ [STORAGE_KEY]: 'kaputt' });
  const backend = { ...store, setItem: () => { throw new Error('QuotaExceededError'); } };
  const storage = createStorage({ backend, now, ...fakeTimers() });
  const result = storage.load();
  assert.deepEqual(result.notice, { code: 'corrupt', backupKey: null });
  assert.equal(storage.readOnly, true);
  storage.save(createDefaultState(now));
  storage.flush();
  assert.equal(store.getItem(STORAGE_KEY), 'kaputt', 'original untouched');
});

test('state from a newer app version is left untouched (read-only)', () => {
  const raw = JSON.stringify({ version: CURRENT_VERSION + 1, profile: { nickname: 'zukunft' } });
  const backend = createMemoryBackend({ [STORAGE_KEY]: raw });
  const timers = fakeTimers();
  const storage = createStorage({ backend, now, ...timers });
  const result = storage.load();
  assert.deepEqual(result.notice, { code: 'newer', version: CURRENT_VERSION + 1 });
  assert.equal(storage.readOnly, true);
  storage.save(createDefaultState(now));
  storage.flush();
  assert.equal(backend.getItem(STORAGE_KEY), raw);
  assert.equal(timers.size, 0);
});

test('unreadable storage → default state, read-only, notice', () => {
  const backend = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => {}, removeItem: () => {} };
  const result = loadState({ backend, now });
  assert.deepEqual(result.notice, { code: 'unavailable' });
  assert.equal(result.readOnly, true);
});

test('normalizeState fills missing fields and repairs wrong types', () => {
  const partial = {
    version: 1,
    profile: { nickname: 'jarek', dailyGoalXp: 'viel', theme: 'pink', reminderTime: '25:00', examDates: { 'lf14-2': '2026-11-20', bad: '2026-02-30' } },
    streak: { current: 5, longest: 3, freezes: 9 },
    league: { tier: 12, weekId: '2026-W41' },
    cards: { 'lf14-2/abc-01': { box: 1 }, broken: 'x' },
    exams: 'keine',
  };
  const s = normalizeState(partial, now);
  assert.equal(s.profile.nickname, 'jarek');
  assert.equal(s.profile.dailyGoalXp, 60);
  assert.equal(s.profile.theme, 'dark');
  assert.equal(s.profile.reminderTime, '18:00');
  assert.deepEqual(s.profile.examDates, { 'lf14-2': '2026-11-20' });
  assert.equal(s.profile.haptics, true);
  assert.equal(s.profile.createdAt, '2026-10-07');
  assert.deepEqual(s.streak, { current: 5, longest: 5, lastActiveDate: null, freezes: 0, frozenDates: [] });
  assert.equal(s.league.tier, 1);
  assert.equal(s.league.weekId, '2026-W41');
  assert.deepEqual(s.cards, { 'lf14-2/abc-01': { box: 1 } });
  assert.deepEqual(s.exams, []);
  assert.deepEqual(s.badges, {});
  assert.equal(partial.profile.theme, 'pink', 'input not mutated');
});

test('normalizeState keeps unknown keys (no silent data loss)', () => {
  const s = normalizeState({ version: 1, future: { a: 1 }, profile: { extra: true } }, now);
  assert.deepEqual(s.future, { a: 1 });
  assert.equal(s.profile.extra, true);
});

test('normalizeState accepts every theme option', () => {
  for (const theme of ['dark', 'light', 'system']) {
    assert.equal(normalizeState({ profile: { theme } }, now).profile.theme, theme);
  }
});

test('event log is capped at the last MAX_EVENTS entries', () => {
  const state = createDefaultState(now);
  state.events = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => ({ t: i, qid: 'x', correct: true, points: 1, ms: 1 }));
  const stored = JSON.parse(serializeState(state));
  assert.equal(stored.events.length, MAX_EVENTS);
  assert.equal(stored.events[0].t, 5);
  const normalized = normalizeState(state, now);
  assert.equal(normalized.events.length, MAX_EVENTS);
  assert.equal(normalized.events.at(-1).t, MAX_EVENTS + 4);
});

test('unversioned legacy object loads and gets defaults', () => {
  const backend = createMemoryBackend({ [STORAGE_KEY]: JSON.stringify({ profile: { nickname: 'alt' } }) });
  const result = loadState({ backend, now });
  assert.equal(result.notice, null);
  assert.equal(result.state.version, CURRENT_VERSION);
  assert.equal(result.state.profile.nickname, 'alt');
  assert.deepEqual(result.state.streak, { current: 0, longest: 0, lastActiveDate: null, freezes: 0, frozenDates: [] });
});
