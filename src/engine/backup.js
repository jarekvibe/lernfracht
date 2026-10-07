// Export / Import des Lernstands (SPEC §4.11, §8): JSON-Datei, beim Import geprüft und migriert.

import { MigrationError, migrate } from './migrations.js';
import { normalizeState, serializeState } from './storage.js';

export const EXPORT_FORMAT = 'lernfracht-export';

/**
 * ASSUMPTION: Die Exportdatei hüllt den Zustand in `{format, exportedAt, state}` ein. Beim Import
 * wird auch ein „nackter“ Zustand akzeptiert (z. B. aus den Entwicklertools kopiert).
 * @param {import('./storage.js').AppState} state
 * @param {() => number} now
 * @returns {string}
 */
export function exportState(state, now) {
  return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date(now()).toISOString(), state: JSON.parse(serializeState(state)) }, null, 2);
}

/**
 * @typedef {Object} ImportPreview
 * @property {number} cards
 * @property {number} streak
 * @property {number} xp
 * @property {number} exams
 * @property {number} badges
 * @property {string} nickname
 * @property {string} createdAt
 * @property {string|null} exportedAt
 */

/**
 * Reads an export file. Nothing is written – the caller shows the preview and asks first.
 * @param {string} text
 * @param {() => number} now
 * @returns {{ok: true, state: import('./storage.js').AppState, preview: ImportPreview} | {ok: false, error: string}}
 */
export function parseImport(text, now) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  const wrapped = data && typeof data === 'object' && data.format === EXPORT_FORMAT;
  const raw = wrapped ? data.state : data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('cards' in raw || 'profile' in raw)) {
    return { ok: false, error: 'Das ist keine Lernfracht-Sicherung.' };
  }
  let migrated;
  try {
    migrated = migrate(raw).state;
  } catch (error) {
    if (error instanceof MigrationError && error.code === 'newer') {
      return { ok: false, error: 'Die Sicherung stammt aus einer neueren Lernfracht-Version. Bitte erst die App aktualisieren.' };
    }
    return { ok: false, error: 'Die Sicherung ist beschädigt.' };
  }
  const state = normalizeState(migrated, now);
  const xp = Object.values(state.days).reduce((sum, d) => sum + (/** @type {{xp?: number}} */ (d).xp ?? 0), 0);
  return {
    ok: true,
    state,
    preview: {
      cards: Object.keys(state.cards).length,
      streak: state.streak.current,
      xp,
      exams: state.exams.length,
      badges: Object.keys(state.badges).length,
      nickname: state.profile.nickname,
      createdAt: state.profile.createdAt,
      exportedAt: wrapped && typeof data.exportedAt === 'string' ? data.exportedAt : null,
    },
  };
}
