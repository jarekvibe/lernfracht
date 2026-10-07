// Gemeinsame Ableitungen für Home, Lektion, Ergebnis, Liga und Profil.

import { todayLocal } from '../engine/dates.js';
import { standings, tierName, weekPosition, weekXp } from '../engine/league.js';
import { mastery } from '../engine/mastery.js';

/**
 * @param {import('./app.js').ScreenContext['catalog']} catalog
 * @param {Record<string, any>} cards
 */
export function greenTopicCount(catalog, cards) {
  return catalog.units
    .flatMap((u) => u.topics.map((t) => mastery(catalog.getTopicQuestions(u.id, t.id), cards).light))
    .filter((light) => light === 'green').length;
}

/**
 * @param {import('../engine/storage.js').AppState} state
 * @param {() => number} now
 */
export function todayXp(state, now) {
  return /** @type {{xp?: number}} */ (state.days[todayLocal(now)] ?? {}).xp ?? 0;
}

/**
 * Current league table for the learner.
 * @param {import('../engine/storage.js').AppState} state
 * @param {() => number} now
 */
export function leagueSnapshot(state, now) {
  const pos = weekPosition(now);
  const userXp = weekXp(state.days, pos.weekId);
  const table = standings({
    weekId: pos.weekId,
    tier: state.league.tier,
    seed: state.league.seed ?? 0,
    userXp,
    userName: state.profile.nickname.trim() || 'Du',
    dayIndex: pos.dayIndex,
    dayFraction: pos.dayFraction,
  });
  const user = /** @type {(typeof table)[number]} */ (table.find((row) => row.isUser));
  return { ...pos, table, userXp, rank: user.rank, tier: state.league.tier, tierName: tierName(state.league.tier), joined: state.league.weekId === pos.weekId };
}
