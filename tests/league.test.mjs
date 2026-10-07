process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekId, weekDates } from '../src/engine/dates.js';
import {
  LEAGUE_SIZE,
  OPPONENT_NAMES,
  TIERS,
  generateOpponents,
  opponentXp,
  resultForRank,
  standings,
  syncLeague,
  tierName,
  weekPosition,
  weekXp,
} from '../src/engine/league.js';

test('ISO week ids, including year boundaries', () => {
  assert.equal(isoWeekId('2026-10-07'), '2026-W41');
  assert.equal(isoWeekId('2026-10-05'), '2026-W41', 'Monday');
  assert.equal(isoWeekId('2026-10-11'), '2026-W41', 'Sunday');
  assert.equal(isoWeekId('2026-10-12'), '2026-W42');
  assert.equal(isoWeekId('2027-01-01'), '2026-W53', 'Friday 1 Jan 2027 belongs to 2026-W53');
  assert.equal(isoWeekId('2025-12-29'), '2026-W01', 'Monday 29 Dec 2025 starts 2026-W01');
  assert.deepEqual(weekDates('2026-W41'), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.equal(weekDates('2026-W01')[0], '2025-12-29');
});

test('week position: Monday 00:00 to Sunday 23:59 local, also in the DST week', () => {
  const mon = weekPosition(() => new Date(2026, 9, 19, 0, 0).getTime());
  assert.deepEqual([mon.weekId, mon.dayIndex, mon.dayFraction], ['2026-W43', 0, 0]);
  const sun = weekPosition(() => new Date(2026, 9, 25, 23, 59).getTime()); // DST day
  assert.equal(sun.weekId, '2026-W43');
  assert.equal(sun.dayIndex, 6);
  assert.ok(sun.dayFraction > 0.99);
});

test('opponents are deterministic for the same seed and differ otherwise', () => {
  const a = generateOpponents({ weekId: '2026-W41', tier: 2, seed: 4711 });
  const b = generateOpponents({ weekId: '2026-W41', tier: 2, seed: 4711 });
  assert.deepEqual(a, b);
  assert.equal(a.length, LEAGUE_SIZE - 1);
  assert.equal(new Set(a.map((o) => o.name)).size, a.length, 'unique names');
  assert.ok(a.every((o) => OPPONENT_NAMES.includes(o.name) && o.daily.length === 7 && o.daily.every((x) => x >= 0 && x % 5 === 0)));
  assert.notDeepEqual(a, generateOpponents({ weekId: '2026-W42', tier: 2, seed: 4711 }), 'other week');
  assert.notDeepEqual(a, generateOpponents({ weekId: '2026-W41', tier: 3, seed: 4711 }), 'other tier');
  assert.notDeepEqual(a, generateOpponents({ weekId: '2026-W41', tier: 2, seed: 4712 }), 'other learner');
});

test('there are inactive opponents and XP grows over the week', () => {
  let inactive = 0;
  for (let seed = 0; seed < 20; seed += 1) {
    const opps = generateOpponents({ weekId: '2026-W41', tier: 3, seed });
    inactive += opps.filter((o) => o.daily.every((x) => x === 0)).length;
    for (const o of opps) {
      let last = 0;
      for (let d = 0; d <= 7; d += 1) {
        const xp = opponentXp(o, d, 0);
        assert.ok(xp >= last);
        last = xp;
      }
      assert.equal(opponentXp(o, 7, 0), o.daily.reduce((a, b) => a + b, 0));
    }
  }
  assert.ok(inactive > 0, 'some opponents never show up');
});

test('standings: 20 rows, sorted, ranks 1–20, ties go to the learner', () => {
  const table = standings({ weekId: '2026-W41', tier: 1, seed: 1, userXp: 0, userName: 'Du', dayIndex: 7 });
  assert.equal(table.length, LEAGUE_SIZE);
  assert.deepEqual(table.map((r) => r.rank), Array.from({ length: 20 }, (_, i) => i + 1));
  for (let i = 1; i < table.length; i += 1) assert.ok(table[i - 1].xp >= table[i].xp);
  const user = table.find((r) => r.isUser);
  const zeroOpponents = table.filter((r) => !r.isUser && r.xp === 0);
  if (zeroOpponents.length) assert.ok(user.rank < Math.min(...zeroOpponents.map((r) => r.rank)));
  assert.deepEqual(standings({ weekId: '2026-W41', tier: 1, seed: 1, userXp: 0, userName: 'Du', dayIndex: 7 }), table, 'deterministic');
});

test('promotion / relegation: top 5 up, bottom 5 down, never below tier 1 or above tier 7', () => {
  assert.equal(resultForRank(1, 3), 'up');
  assert.equal(resultForRank(5, 3), 'up');
  assert.equal(resultForRank(6, 3), 'stay');
  assert.equal(resultForRank(15, 3), 'stay');
  assert.equal(resultForRank(16, 3), 'down');
  assert.equal(resultForRank(20, 3), 'down');
  assert.equal(resultForRank(20, 1), 'stay', 'tier 1 cannot go down');
  assert.equal(resultForRank(1, 7), 'stay', 'tier 7 cannot go up');
  assert.equal(TIERS.length, 7);
  assert.equal(tierName(1), 'Palette');
  assert.equal(tierName(7), 'Mega-Carrier');
});

test('tuning: an active learner climbs the low tiers and has to fight from tier 5 on', () => {
  // „Aktiv“ = Tagesziel an 5 von 7 Tagen ≈ eine Lektion ≈ 100 XP
  const promotionRate = (tier) => {
    let up = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const table = standings({ weekId: '2026-W41', tier, seed: seed * 7919, userXp: 500, userName: 'Du', dayIndex: 7 });
      if (resultForRank(table.find((r) => r.isUser).rank, tier) === 'up') up += 1;
    }
    return up / 300;
  };
  for (const tier of [1, 2, 3]) assert.ok(promotionRate(tier) >= 0.9, `tier ${tier}: mostly up`);
  assert.ok(promotionRate(4) >= 0.6, 'tier 4: usually up');
  const t5 = promotionRate(5);
  assert.ok(t5 > 0.2 && t5 < 0.7, `tier 5: a fight (${t5})`);
  assert.ok(promotionRate(6) < 0.35, 'tier 6: hard');
});

test('weekly XP is read from days', () => {
  const days = { '2026-10-04': { xp: 999 }, '2026-10-05': { xp: 40 }, '2026-10-11': { xp: 60 }, '2026-10-12': { xp: 7 } };
  assert.equal(weekXp(days, '2026-W41'), 100);
});

test('week rollover: the finished week is ranked, tier moves, result is kept for the result screen', () => {
  const days = Object.fromEntries(weekDates('2026-W41').map((d) => [d, { xp: 200 }])); // 1.400 XP – top
  const league = { weekId: '2026-W41', tier: 2, seed: 4711, history: [], pendingResult: null };
  const { league: next, result } = syncLeague(league, { weekId: '2026-W42', days });
  assert.equal(result.result, 'up');
  assert.equal(result.rank, 1);
  assert.equal(next.tier, 3);
  assert.equal(next.weekId, '2026-W42');
  assert.deepEqual(next.history, [{ weekId: '2026-W41', tier: 2, rank: 1, result: 'up' }]);
  assert.deepEqual(next.pendingResult, result);
  assert.equal(syncLeague(next, { weekId: '2026-W42', days }).league, next, 'same week → unchanged');
});

test('week rollover: bottom 5 go down; a week without XP is not ranked', () => {
  const tiny = { [weekDates('2026-W41')[0]]: { xp: 5 } };
  const league = { weekId: '2026-W41', tier: 6, seed: 3, history: [], pendingResult: null };
  const down = syncLeague(league, { weekId: '2026-W42', days: tiny });
  assert.equal(down.result.result, 'down');
  assert.equal(down.league.tier, 5);
  const absent = syncLeague(league, { weekId: '2026-W45', days: {} });
  assert.equal(absent.result, null);
  assert.equal(absent.league.tier, 6);
  assert.equal(absent.league.weekId, '2026-W45');
});
