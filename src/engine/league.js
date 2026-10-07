// Demo-Liga (SPEC §4.8): 19 simulierte Gegner pro Woche, deterministisch aus Woche + Stufe + Nutzer-Seed.
// Phase 2 ersetzt die Simulation durch echte Ligen – die Schnittstelle (Tabelle, Auf-/Abstieg) bleibt.

import { isoWeekId, todayLocal, weekDates } from './dates.js';
import { createRng, hashString, shuffle } from './random.js';

export const TIERS = Object.freeze([
  { tier: 1, name: 'Palette' },
  { tier: 2, name: 'Gitterbox' },
  { tier: 3, name: 'Wechselbrücke' },
  { tier: 4, name: 'Sattelauflieger' },
  { tier: 5, name: '20’-Container' },
  { tier: 6, name: '40’-High-Cube' },
  { tier: 7, name: 'Mega-Carrier' },
]);
export const LEAGUE_SIZE = 20;
export const PROMOTE_COUNT = 5;
export const DEMOTE_COUNT = 5;

/** Logistik-Spitznamen der simulierten Gegner. */
export const OPPONENT_NAMES = Object.freeze([
  'Disponentin Dana', 'ZollZauberer', 'PalettenPaul', 'Lademeter-Lena', 'StaplerStefan', 'FrachtbriefFrida',
  'Containerkönig', 'IncotermIrina', 'Sammelgut-Sven', 'KühlketteKim', 'Tourenplanerin Tina', 'BahnfrachtBen',
  'Luftfracht-Lu', 'Hafenhexe', 'Gitterbox-Gabi', 'ZurrgurtZoe', 'Rampenrudi', 'WechselbrückenWilli', 'Lagerlotte',
  'CMR-Chris', 'Stauplan-Steffi', 'Kranführer Kalle', 'Packstück-Pia', 'Umschlag-Uwe', 'TrailerTom', 'VGM-Vicky',
]);

/**
 * Typical weekly XP of an active opponent per tier. Tuned so that a learner who reaches a
 * 60-XP goal on 5 of 7 days usually climbs the low tiers and has to fight from tier 5 on
 * (see tests/league.test.mjs).
 */
const TIER_WEEKLY_XP = [0, 170, 230, 290, 350, 430, 520, 640];
/** Opponent types: share of the league, days active per week, factor on the tier's weekly XP. */
const PROFILES = [
  { kind: 'inactive', share: 0.15, activeShare: 0, factor: 0 },
  { kind: 'casual', share: 0.3, activeShare: 0.4, factor: 0.45 },
  { kind: 'regular', share: 0.4, activeShare: 0.75, factor: 1 },
  { kind: 'grinder', share: 0.15, activeShare: 0.95, factor: 1.7 },
];

/**
 * @typedef {{name: string, daily: number[]}} Opponent  XP per weekday, Monday first
 * @typedef {{name: string, xp: number, isUser: boolean, rank: number}} Standing
 * @typedef {{weekId: string, tier: number, rank: number, result: 'up'|'down'|'stay'}} LeagueResult
 */

/** @param {number} tier */
export const tierName = (tier) => TIERS[Math.min(Math.max(tier, 1), TIERS.length) - 1].name;

/** @param {number} n */
const roundTo5 = (n) => Math.round(n / 5) * 5;

/**
 * The 19 opponents of a week – identical for the same week, tier and seed.
 * @param {{weekId: string, tier: number, seed: number}} key
 * @returns {Opponent[]}
 */
export function generateOpponents({ weekId, tier, seed }) {
  const rng = createRng(hashString(`${weekId}|${tier}|${seed}`));
  const names = shuffle(OPPONENT_NAMES, rng).slice(0, LEAGUE_SIZE - 1);
  return names.map((name) => {
    let roll = rng();
    const profile = PROFILES.find((p) => (roll -= p.share) < 0) ?? PROFILES[PROFILES.length - 1];
    const weekly = TIER_WEEKLY_XP[tier] * profile.factor * (0.7 + rng() * 0.6);
    const perActiveDay = profile.activeShare > 0 ? weekly / (7 * profile.activeShare) : 0;
    const daily = Array.from({ length: 7 }, () =>
      rng() < profile.activeShare ? roundTo5(perActiveDay * (0.5 + rng())) : 0,
    );
    return { name, daily };
  });
}

/**
 * Where in the week we are: weekday index (Mo = 0) and share of today already over.
 * @param {() => number} now
 */
export function weekPosition(now) {
  const t = new Date(now());
  const today = todayLocal(now);
  return {
    today,
    weekId: isoWeekId(today),
    dayIndex: (t.getDay() + 6) % 7,
    dayFraction: (t.getHours() * 60 + t.getMinutes()) / 1440,
  };
}

/**
 * XP of an opponent so far: full past days plus the elapsed share of today.
 * @param {Opponent} opponent
 * @param {number} dayIndex 0–6, or 7 for the finished week
 * @param {number} dayFraction 0–1
 */
export function opponentXp(opponent, dayIndex, dayFraction) {
  let xp = 0;
  for (let d = 0; d < Math.min(dayIndex, 7); d += 1) xp += opponent.daily[d];
  if (dayIndex < 7) xp += roundTo5(opponent.daily[dayIndex] * dayFraction);
  return xp;
}

/**
 * Learner's XP in a week, from `days` (never stored separately, SPEC §8).
 * @param {Record<string, {xp?: number}>} days
 * @param {string} weekId
 */
export function weekXp(days, weekId) {
  return weekDates(weekId).reduce((sum, date) => sum + (days[date]?.xp ?? 0), 0);
}

/**
 * League table, best first.
 * ASSUMPTION: Bei Gleichstand steht der Nutzer vor den simulierten Gegnern.
 * @param {Object} input
 * @param {string} input.weekId
 * @param {number} input.tier
 * @param {number} input.seed
 * @param {number} input.userXp
 * @param {string} input.userName
 * @param {number} input.dayIndex 7 = week finished
 * @param {number} [input.dayFraction]
 * @returns {Standing[]}
 */
export function standings({ weekId, tier, seed, userXp, userName, dayIndex, dayFraction = 0 }) {
  const rows = generateOpponents({ weekId, tier, seed }).map((o) => ({
    name: o.name,
    xp: opponentXp(o, dayIndex, dayFraction),
    isUser: false,
  }));
  rows.push({ name: userName, xp: userXp, isUser: true });
  rows.sort((a, b) => b.xp - a.xp || Number(b.isUser) - Number(a.isUser) || a.name.localeCompare(b.name, 'de'));
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Top 5 go up, bottom 5 go down – not below tier 1, not above tier 7.
 * @param {number} rank
 * @param {number} tier
 * @returns {'up'|'down'|'stay'}
 */
export function resultForRank(rank, tier) {
  if (rank <= PROMOTE_COUNT && tier < TIERS.length) return 'up';
  if (rank > LEAGUE_SIZE - DEMOTE_COUNT && tier > 1) return 'down';
  return 'stay';
}

/**
 * Closes the stored week when a new one has begun and moves the learner up or down.
 * ASSUMPTION: Gewertet wird nur die zuletzt gespeicherte Woche, und nur wenn darin XP gesammelt
 * wurden (wer nicht lernt, tritt nicht an – keine Abstiege durch Abwesenheit).
 * @param {{weekId: string|null, tier: number, seed: number|null, history: LeagueResult[], pendingResult?: LeagueResult|null}} league
 * @param {{weekId: string, days: Record<string, {xp?: number}>}} input
 * @returns {{league: typeof league, result: LeagueResult|null}}
 */
export function syncLeague(league, { weekId, days }) {
  if (league.weekId === weekId) return { league, result: null };
  if (!league.weekId || league.seed === null) return { league: { ...league, weekId }, result: null };

  const userXp = weekXp(days, league.weekId);
  if (userXp === 0) return { league: { ...league, weekId }, result: null };

  const table = standings({ weekId: league.weekId, tier: league.tier, seed: league.seed, userXp, userName: '', dayIndex: 7 });
  const rank = /** @type {Standing} */ (table.find((row) => row.isUser)).rank;
  const result = resultForRank(rank, league.tier);
  const entry = { weekId: league.weekId, tier: league.tier, rank, result };
  const tier = league.tier + (result === 'up' ? 1 : result === 'down' ? -1 : 0);
  return {
    league: { ...league, weekId, tier, history: [...league.history, entry].slice(-52), pendingResult: entry },
    result: entry,
  };
}
