process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPORT_FORMAT, exportState, parseImport } from '../src/engine/backup.js';
import { createCatalog } from '../src/engine/content.js';
import { drawExam, scoreExam } from '../src/engine/exam.js';
import { finishExam, finishSession, recordAnswer } from '../src/engine/progress.js';
import { createRng } from '../src/engine/random.js';
import { shouldNotify } from '../src/engine/reminder.js';
import { heatmap, totals, xpSeries } from '../src/engine/stats.js';
import { createDefaultState, createMemoryBackend, createStorage, normalizeState } from '../src/engine/storage.js';

const unit = JSON.parse(readFileSync(new URL('../content/lf14-2.json', import.meta.url), 'utf8'));
const catalog = createCatalog([unit]);
const at = (d, h = 18) => () => new Date(2026, 9, d, h, 0).getTime();

/** A state that has been through lessons, an exam and settings – everything export must keep. */
function richState() {
  let state = createDefaultState(at(1));
  state = { ...state, profile: { ...state.profile, nickname: 'PalettenProfi', dailyGoalXp: 100, theme: 'light', examDates: { 'lf14-2': '2026-11-20' }, onboardedAt: '2026-10-01', notify: true }, league: { ...state.league, seed: 77 } };
  for (const d of [1, 2, 3, 5]) {
    const now = at(d);
    for (const q of catalog.getPathQuestions('lf14-2').slice(d * 3, d * 3 + 5)) {
      state = recordAnswer(state, { gid: q.gid, grade: { correct: d !== 3, points: 1 }, now, ms: 9000, mode: 'path', xp: 10 });
    }
    state = finishSession(state, { now, summary: { mode: 'path', total: 5, perfect: d !== 3, durationMs: 240000 }, mistakesBefore: 0, greenTopics: () => 0 }).state;
  }
  const qs = drawExam({ questions: catalog.getPathQuestions('lf14-2'), config: unit.exam, rng: createRng(4) }).map((g) => catalog.getQuestion(g));
  state = finishExam(state, { now: at(6), unitId: 'lf14-2', result: scoreExam({ questions: qs, answers: {} }), durationSec: 600, greenTopics: () => 0 }).state;
  return { ...state, selfAssessment: { 'lf14-2/abc.c1': 'unsicher' } };
}

test('export → reset → import restores the identical state', () => {
  const now = at(7);
  const backend = createMemoryBackend();
  const storage = createStorage({ backend, now, setTimer: () => 0, clearTimer: () => {} });
  const original = normalizeState(richState(), now);
  storage.save(original);
  storage.flush();

  const file = exportState(original, now);
  storage.save(createDefaultState(now)); // Reset
  storage.flush();
  assert.notDeepEqual(storage.load().state, original);

  const parsed = parseImport(file, now);
  assert.equal(parsed.ok, true);
  storage.save(parsed.state);
  storage.flush();
  assert.deepEqual(storage.load().state, original);
});

test('import preview tells what will be restored', () => {
  const now = at(7);
  const state = normalizeState(richState(), now);
  const parsed = parseImport(exportState(state, now), now);
  assert.equal(parsed.ok, true);
  const p = parsed.preview;
  assert.equal(p.cards, Object.keys(state.cards).length);
  assert.equal(p.streak, state.streak.current);
  assert.equal(p.exams, 1);
  assert.equal(p.nickname, 'PalettenProfi');
  assert.ok(p.xp > 0);
  assert.equal(typeof p.exportedAt, 'string');
  const file = JSON.parse(exportState(state, now));
  assert.equal(file.format, EXPORT_FORMAT);
});

test('import accepts a bare state and fills gaps', () => {
  const parsed = parseImport(JSON.stringify({ version: 1, profile: { nickname: 'alt' }, cards: {} }), at(7));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.profile.nickname, 'alt');
  assert.equal(parsed.state.profile.dailyGoalXp, 60);
  assert.equal(parsed.preview.exportedAt, null);
});

test('import rejects broken, foreign and newer files', () => {
  assert.deepEqual(parseImport('{kaputt', at(7)), { ok: false, error: 'Die Datei ist kein gültiges JSON.' });
  assert.equal(parseImport('{"hello":"world"}', at(7)).error, 'Das ist keine Lernfracht-Sicherung.');
  assert.equal(parseImport('[]', at(7)).ok, false);
  assert.match(parseImport(JSON.stringify({ format: EXPORT_FORMAT, state: { version: 99, profile: {} } }), at(7)).error, /neueren/);
});

test('heatmap: 12 weeks × 7 days, Monday first, ending with the current week', () => {
  const state = richState();
  const grid = heatmap({ days: state.days, frozenDates: ['2026-10-04'], today: '2026-10-07' });
  assert.equal(grid.length, 12);
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(grid[11][0].date, '2026-10-05', 'last column starts on Monday of this week');
  assert.equal(grid[0][0].date, '2026-07-20');
  const cell = grid.flat().find((c) => c.date === '2026-10-01');
  assert.equal(cell.active, true);
  assert.ok(cell.xp > 0);
  assert.equal(grid.flat().find((c) => c.date === '2026-10-04').frozen, true);
  assert.equal(grid.flat().find((c) => c.date === '2026-10-07').today, true);
  assert.equal(grid[11][6].future, true, 'Sunday later this week');
});

test('XP series: last 14 days, oldest first, zero-filled', () => {
  const series = xpSeries({ '2026-10-07': { xp: 120 }, '2026-09-24': { xp: 30 }, '2026-09-23': { xp: 999 } }, '2026-10-07');
  assert.equal(series.length, 14);
  assert.deepEqual(series[0], { date: '2026-09-24', xp: 30 });
  assert.deepEqual(series[13], { date: '2026-10-07', xp: 120 });
  assert.equal(series.filter((d) => d.xp === 0).length, 12);
});

test('totals: answered questions, hit rate, minutes', () => {
  const t = totals(richState());
  assert.equal(t.answered, 40, '4 × 5 lesson answers + 20 exam answers');
  assert.equal(t.correct, 15);
  assert.equal(t.hitRate, 15 / 40);
  assert.equal(t.minutes, 4 * 4 + 10);
  assert.equal(totals(createDefaultState(at(1))).hitRate, null);
});

test('in-app reminder: from the reminder time, once a day, only if the goal is open', () => {
  const base = { reminderTime: '18:00', lastReminderDate: null, xpToday: 0, goal: 60 };
  assert.equal(shouldNotify({ ...base, now: at(7, 17) }), false, 'too early');
  assert.equal(shouldNotify({ ...base, now: at(7, 18) }), true);
  assert.equal(shouldNotify({ ...base, now: at(7, 23) }), true, 'later the same evening');
  assert.equal(shouldNotify({ ...base, now: at(7, 19), lastReminderDate: '2026-10-07' }), false, 'once a day');
  assert.equal(shouldNotify({ ...base, now: at(8, 19), lastReminderDate: '2026-10-07' }), true, 'next day again');
  assert.equal(shouldNotify({ ...base, now: at(7, 19), xpToday: 60 }), false, 'goal reached');
});
