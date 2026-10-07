import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { leagueSnapshot } from '../gamification.js';
import { DEMOTE_COUNT, LEAGUE_SIZE, PROMOTE_COUNT, TIERS, tierName } from '../../engine/league.js';

/**
 * Demo-Liga (SPEC §4.8): Wochentabelle mit 19 simulierten Gegnern, klar als Demo gekennzeichnet.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ store, now }) {
  const state = store.get();
  const snap = leagueSnapshot(state, now);
  const pending = state.league.pendingResult;
  const canGoUp = snap.tier < TIERS.length;
  const canGoDown = snap.tier > 1;
  const daysLeft = 7 - snap.dayIndex;

  const dismiss = () =>
    store.update((s) => ({ ...s, league: { ...s.league, pendingResult: null } }));

  return [
    screenHeader({ title: 'Liga' }),
    h('p', { class: 'demo-banner', role: 'note' }, 'Demo-Liga: Gegner sind simuliert. Echte Ligen mit deiner Klasse kommen in Phase 2.'),
    pending && resultCard(pending, dismiss),
    h(
      'section',
      { class: 'tier-head' },
      h('span', { class: 'tier-badge', 'aria-hidden': 'true' }, String(snap.tier)),
      h(
        'div',
        null,
        h('h2', null, `Liga ${snap.tierName}`),
        h('p', { class: 'muted small' }, `Stufe ${snap.tier} von ${TIERS.length} · ${daysLeft === 1 ? 'endet heute um Mitternacht' : `noch ${daysLeft} Tage`}`),
      ),
    ),
    !snap.joined && h('p', { class: 'league-hint' }, 'Schließ diese Woche eine Lektion ab, dann zählst du in der Wertung.'),
    h(
      'p',
      { class: 'league-rules muted small' },
      [canGoUp && `Platz 1–${PROMOTE_COUNT} steigen auf`, canGoDown && `Platz ${LEAGUE_SIZE - DEMOTE_COUNT + 1}–${LEAGUE_SIZE} steigen ab`]
        .filter(Boolean)
        .join(' · ') || 'Oberste Stufe – hier geht es nur noch um die Ehre.',
    ),
    h(
      'ol',
      { class: 'league-table', 'aria-label': `Tabelle ${snap.tierName}` },
      snap.table.map((row) => {
        const zone = canGoUp && row.rank <= PROMOTE_COUNT ? 'up' : canGoDown && row.rank > LEAGUE_SIZE - DEMOTE_COUNT ? 'down' : '';
        return h(
          'li',
          { class: `league-row${zone ? ` zone-${zone}` : ''}${row.isUser ? ' is-user' : ''}`, 'aria-current': row.isUser ? 'true' : null },
          h('span', { class: 'league-rank' }, String(row.rank)),
          h('span', { class: 'league-name' }, row.name, row.isUser && h('span', { class: 'you' }, ' (du)')),
          h('span', { class: 'league-xp' }, `${row.xp} XP`),
          zone && h('span', { class: 'visually-hidden' }, zone === 'up' ? ' – Aufstiegszone' : ' – Abstiegszone'),
        );
      }),
    ),
  ];
}

/**
 * Result of the finished week, shown once when a new week starts.
 * @param {import('../../engine/league.js').LeagueResult} result
 * @param {() => void} onDismiss
 */
function resultCard(result, onDismiss) {
  const newTier = result.tier + (result.result === 'up' ? 1 : result.result === 'down' ? -1 : 0);
  const headline = {
    up: `Aufstieg! Willkommen in ${tierName(newTier)}.`,
    down: `Abstieg nach ${tierName(newTier)}.`,
    stay: `Klassenerhalt in ${tierName(newTier)}.`,
  }[result.result];
  const text = {
    up: 'Starke Woche – jetzt wird’s härter.',
    down: 'Kein Drama. Diese Woche holst du es zurück.',
    stay: 'Solide gehalten. Für den Aufstieg fehlt nicht viel.',
  }[result.result];
  const card = h(
    'section',
    { class: `card league-result is-${result.result}`, role: 'status' },
    h('p', { class: 'league-result-eyebrow' }, `Letzte Woche · Platz ${result.rank}`),
    h('h2', null, headline),
    h('p', { class: 'muted' }, text),
    h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { onDismiss(); card.remove(); } }, 'Weiter'),
  );
  return card;
}
