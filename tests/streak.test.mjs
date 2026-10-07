process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayLocal } from '../src/engine/dates.js';
import { MAX_FREEZES, recordStreakDay, settleStreak, streakView } from '../src/engine/streak.js';

const empty = () => ({ current: 0, longest: 0, lastActiveDate: null, freezes: 0, frozenDates: [] });
/** Local clock helper → `YYYY-MM-DD` */
const at = (y, m, d, h = 12, min = 0) => todayLocal(() => new Date(y, m - 1, d, h, min).getTime());

/** Plays activity on the given days and returns the streak. */
function play(days, start = empty()) {
  return days.reduce((s, day) => recordStreakDay(s, day), start);
}

test('first session starts the streak; more sessions on the same day do not count twice', () => {
  let s = recordStreakDay(empty(), '2026-10-07');
  assert.deepEqual(s, { current: 1, longest: 1, lastActiveDate: '2026-10-07', freezes: 0, frozenDates: [] });
  s = recordStreakDay(s, '2026-10-07');
  assert.equal(s.current, 1);
});

test('midnight: 23:59 and 00:01 are two different days', () => {
  const s = play([at(2026, 10, 7, 23, 59), at(2026, 10, 8, 0, 1)]);
  assert.equal(s.current, 2);
  assert.equal(s.lastActiveDate, '2026-10-08');
});

test('DST: the 25-hour day (2026-10-25) and the 23-hour day (2026-03-29) are single days', () => {
  const autumn = play([at(2026, 10, 24, 23, 30), at(2026, 10, 25, 0, 30), at(2026, 10, 25, 23, 30), at(2026, 10, 26, 0, 30)]);
  assert.equal(autumn.current, 3, '24. · 25. · 26.');
  const spring = play([at(2026, 3, 28, 22, 0), at(2026, 3, 29, 3, 30), at(2026, 3, 30, 1, 0)]);
  assert.equal(spring.current, 3, '28. · 29. · 30.');
});

test('one missed day without a freeze ends the streak; the next session starts at 1', () => {
  const s = play(['2026-10-01', '2026-10-02', '2026-10-03']);
  const settled = settleStreak(s, '2026-10-05');
  assert.equal(settled.broken, true);
  assert.equal(settled.streak.current, 0);
  assert.equal(settled.streak.longest, 3, 'longest is kept');
  assert.equal(recordStreakDay(s, '2026-10-05').current, 1);
});

test('a freeze is earned every 7 days, at most 2 in stock', () => {
  const days = Array.from({ length: 21 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const after6 = play(days.slice(0, 6));
  assert.equal(after6.freezes, 0);
  const after7 = play(days.slice(0, 7));
  assert.equal(after7.freezes, 1);
  assert.equal(play(days.slice(0, 14)).freezes, 2);
  assert.equal(play(days.slice(0, 21)).freezes, MAX_FREEZES, 'capped');
});

test('missed day with a freeze: freeze is used, streak survives', () => {
  const s = { current: 9, longest: 9, lastActiveDate: '2026-10-09', freezes: 1, frozenDates: [] };
  const settled = settleStreak(s, '2026-10-11');
  assert.deepEqual(settled.frozen, ['2026-10-10']);
  assert.equal(settled.broken, false);
  assert.equal(settled.streak.freezes, 0);
  assert.equal(settled.streak.current, 9);
  const next = recordStreakDay(s, '2026-10-11');
  assert.equal(next.current, 10);
  assert.equal(next.lastActiveDate, '2026-10-11');
});

test('several missed days: freezes cover as many as they can, then the streak ends', () => {
  const s = { current: 15, longest: 15, lastActiveDate: '2026-10-15', freezes: 2, frozenDates: [] };
  const twoMissed = settleStreak(s, '2026-10-18');
  assert.deepEqual(twoMissed.frozen, ['2026-10-16', '2026-10-17']);
  assert.equal(twoMissed.streak.current, 15);
  const threeMissed = settleStreak(s, '2026-10-19');
  assert.equal(threeMissed.broken, true);
  assert.equal(threeMissed.streak.current, 0);
  assert.equal(threeMissed.streak.freezes, 0, 'freezes are used day by day');
});

test('settling is idempotent – reopening the app does not burn freezes twice', () => {
  const s = { current: 9, longest: 9, lastActiveDate: '2026-10-09', freezes: 2, frozenDates: [] };
  const once = settleStreak(s, '2026-10-11').streak;
  const twice = settleStreak(once, '2026-10-11');
  assert.deepEqual(twice.frozen, []);
  assert.equal(twice.streak.freezes, 1);
  assert.equal(twice.streak, once, 'unchanged object');
  // the next day bridges only the new gap
  const nextDay = settleStreak(once, '2026-10-12');
  assert.deepEqual(nextDay.frozen, ['2026-10-11']);
  assert.equal(nextDay.streak.freezes, 0);
});

test('activity yesterday or today: nothing to settle', () => {
  const s = play(['2026-10-06']);
  assert.equal(settleStreak(s, '2026-10-07').streak, s);
  assert.equal(settleStreak(s, '2026-10-06').streak, s);
});

test('streakView: at risk until today is done, without changing state', () => {
  const s = play(['2026-10-05', '2026-10-06']);
  assert.deepEqual(streakView(s, '2026-10-07'), { current: 2, freezes: 0, activeToday: false, atRisk: true });
  assert.deepEqual(streakView(recordStreakDay(s, '2026-10-07'), '2026-10-07'), { current: 3, freezes: 0, activeToday: true, atRisk: false });
  assert.deepEqual(streakView(s, '2026-10-09'), { current: 0, freezes: 0, activeToday: false, atRisk: false });
  assert.equal(s.current, 2, 'input untouched');
});
