// Erinnerungen in der UI: Kalenderdatei (.ics) und Browser-Benachrichtigung bei offener App.

import { downloadText } from './download.js';
import { todayXp } from './gamification.js';
import { todayLocal } from '../engine/dates.js';
import { buildReminderIcs } from '../engine/ics.js';
import { shouldNotify } from '../engine/reminder.js';

/**
 * Link for the calendar entry: the configured app URL, otherwise the current address if the
 * app is hosted (not for a local file).
 * ASSUMPTION: Ohne eingetragene App-URL nimmt der Termin die aktuelle Adresse, sofern die App online läuft.
 * @param {{appUrl: string}} profile
 * @param {Location} location
 */
export function effectiveAppUrl(profile, location) {
  if (profile.appUrl.trim()) return profile.appUrl.trim();
  return /^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}` : '';
}

/**
 * Builds and downloads the daily calendar reminder.
 * @param {import('../engine/storage.js').AppState} state
 * @param {() => number} now
 * @param {string} version
 */
export function downloadReminderIcs(state, now, version) {
  const text = buildReminderIcs({
    time: state.profile.reminderTime,
    startDate: todayLocal(now),
    stamp: now(),
    // ASSUMPTION: UID aus dem Liga-Seed – gleich bleibend pro Gerät, damit Kalender, die nach UID
    // abgleichen, beim erneuten Eintragen den alten Termin ersetzen.
    uid: `lernfracht-daily-${state.league.seed ?? 0}@lernfracht`,
    appUrl: effectiveAppUrl(state.profile, window.location),
    version,
  });
  downloadText('lernfracht-erinnerung.ics', 'text/calendar;charset=utf-8', text);
}

/** Notification API vorhanden? (iOS-Safari nur als Home-Bildschirm-App.) */
export const notificationsSupported = () => typeof window.Notification === 'function';

/**
 * Checks every 30 s whether a reminder is due and shows it – only while the app is open.
 * @param {import('./app.js').ScreenContext['store']} store
 * @param {() => number} now
 * @returns {() => void} stop
 */
export function startReminderLoop(store, now) {
  const check = () => {
    const state = store.get();
    if (!state.profile.notify || !notificationsSupported() || Notification.permission !== 'granted') return;
    const goal = state.profile.dailyGoalXp;
    const xp = todayXp(state, now);
    if (!shouldNotify({ now, reminderTime: state.profile.reminderTime, lastReminderDate: state.profile.lastReminderDate, xpToday: xp, goal })) return;
    try {
      new Notification('📦 Zeit für Lernfracht', { body: `Noch ${goal - xp} XP bis zum Tagesziel. 5 Minuten reichen.`, tag: 'lernfracht-daily' });
    } catch {
      return; // manche Browser erlauben Notifications nur über einen Service Worker
    }
    store.update((s) => ({ ...s, profile: { ...s.profile, lastReminderDate: todayLocal(now) } }));
  };
  check();
  const id = window.setInterval(check, 30000);
  return () => window.clearInterval(id);
}
