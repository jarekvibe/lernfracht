// Persistenz: ein Key in localStorage, Zugriff ausschließlich über dieses Modul.
// Das Backend (localStorage oder Speicher-Attrappe) und die Uhr werden injiziert.

import { CURRENT_VERSION, migrate } from './migrations.js';
import { isDateString, todayLocal } from './dates.js';

export const STORAGE_KEY = 'lernfracht.state.v1';
export const BACKUP_KEY_PREFIX = 'lernfracht.state.backup.';
export const MAX_EVENTS = 2000;
export const THEMES = /** @type {const} */ (['dark', 'light', 'system']);
export const MAX_FREEZES = 2;
export const LEAGUE_TIERS = 7;

/**
 * @typedef {Object} StorageBackend
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 *
 * @typedef {Object} Profile
 * @property {string} nickname
 * @property {number} dailyGoalXp
 * @property {string} reminderTime `HH:MM`
 * @property {string} appUrl
 * @property {Record<string, string>} examDates unitId → `YYYY-MM-DD`
 * @property {'dark'|'light'|'system'} theme
 * @property {boolean} haptics
 * @property {string} createdAt `YYYY-MM-DD`
 *
 * @typedef {Object} AppState
 * @property {number} version
 * @property {Profile} profile
 * @property {Record<string, Object>} cards
 * @property {Record<string, Object>} days
 * @property {{current: number, longest: number, lastActiveDate: string|null, freezes: number}} streak
 * @property {{weekId: string|null, tier: number, seed: number|null, history: Object[]}} league
 * @property {Object[]} exams
 * @property {Record<string, string>} selfAssessment
 * @property {Record<string, string>} badges
 * @property {Object[]} events
 *
 * @typedef {'corrupt'|'newer'|'unavailable'} LoadNoticeCode
 *
 * @typedef {Object} LoadResult
 * @property {AppState} state
 * @property {{code: LoadNoticeCode, backupKey?: string|null, version?: number}|null} notice
 * @property {boolean} readOnly true → nothing may be written (stored data must be preserved)
 * @property {number|null} migratedFrom version the stored data had, if it was migrated
 */

/**
 * @param {() => number} now
 * @returns {AppState}
 */
export function createDefaultState(now) {
  return {
    version: CURRENT_VERSION,
    profile: {
      nickname: '',
      dailyGoalXp: 60,
      reminderTime: '18:00',
      appUrl: '',
      examDates: {},
      theme: 'dark',
      haptics: true,
      createdAt: todayLocal(now),
    },
    cards: {},
    days: {},
    streak: { current: 0, longest: 0, lastActiveDate: null, freezes: 0 },
    // ASSUMPTION: Seed und Woche setzt erst die Liga-Logik (M4); bis dahin null.
    league: { weekId: null, tier: 1, seed: null, history: [] },
    exams: [],
    selfAssessment: {},
    badges: {},
    events: [],
  };
}

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @param {number} min @param {number} max */
const intIn = (v, min, max) => Number.isInteger(v) && /** @type {number} */ (v) >= min && /** @type {number} */ (v) <= max;
/** @param {Record<string, any>} obj */
const onlyObjectValues = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => isObject(v)));

/**
 * Fills missing fields with defaults and replaces values of the wrong type.
 * Unknown keys are kept so that no data gets lost. Does not mutate the input.
 * @param {unknown} input a state of the current version (see migrate())
 * @param {() => number} now
 * @returns {AppState}
 */
export function normalizeState(input, now) {
  const base = createDefaultState(now);
  const src = isObject(input) ? input : {};
  const p = isObject(src.profile) ? src.profile : {};
  const s = isObject(src.streak) ? src.streak : {};
  const l = isObject(src.league) ? src.league : {};

  const examDates = isObject(p.examDates)
    ? Object.fromEntries(Object.entries(p.examDates).filter(([, v]) => isDateString(v)))
    : {};
  const current = intIn(s.current, 0, Number.MAX_SAFE_INTEGER) ? s.current : 0;

  return {
    ...src,
    version: CURRENT_VERSION,
    profile: {
      ...p,
      nickname: typeof p.nickname === 'string' ? p.nickname : base.profile.nickname,
      dailyGoalXp: typeof p.dailyGoalXp === 'number' && p.dailyGoalXp > 0 ? p.dailyGoalXp : base.profile.dailyGoalXp,
      reminderTime:
        typeof p.reminderTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.reminderTime)
          ? p.reminderTime
          : base.profile.reminderTime,
      appUrl: typeof p.appUrl === 'string' ? p.appUrl : base.profile.appUrl,
      examDates,
      theme: THEMES.includes(p.theme) ? p.theme : base.profile.theme,
      haptics: typeof p.haptics === 'boolean' ? p.haptics : base.profile.haptics,
      createdAt: isDateString(p.createdAt) ? p.createdAt : base.profile.createdAt,
    },
    cards: isObject(src.cards) ? onlyObjectValues(src.cards) : {},
    days: isObject(src.days) ? onlyObjectValues(src.days) : {},
    streak: {
      ...s,
      current,
      longest: intIn(s.longest, current, Number.MAX_SAFE_INTEGER) ? s.longest : current,
      lastActiveDate: isDateString(s.lastActiveDate) ? s.lastActiveDate : null,
      freezes: intIn(s.freezes, 0, MAX_FREEZES) ? s.freezes : 0,
    },
    league: {
      ...l,
      weekId: typeof l.weekId === 'string' && /^\d{4}-W\d{2}$/.test(l.weekId) ? l.weekId : null,
      tier: intIn(l.tier, 1, LEAGUE_TIERS) ? l.tier : 1,
      seed: typeof l.seed === 'number' && Number.isFinite(l.seed) ? l.seed : null,
      history: Array.isArray(l.history) ? l.history.filter(isObject) : [],
    },
    exams: Array.isArray(src.exams) ? src.exams.filter(isObject) : [],
    selfAssessment: isObject(src.selfAssessment) ? src.selfAssessment : {},
    badges: isObject(src.badges) ? src.badges : {},
    events: Array.isArray(src.events) ? src.events.slice(-MAX_EVENTS) : [],
  };
}

/**
 * @param {AppState} state
 * @returns {string}
 */
export function serializeState(state) {
  const events = Array.isArray(state.events) ? state.events.slice(-MAX_EVENTS) : [];
  return JSON.stringify({ ...state, events });
}

/**
 * Reads, migrates and normalizes the stored state.
 * Corrupt data is copied to `lernfracht.state.backup.<timestamp>` before starting fresh.
 * @param {{backend: StorageBackend, now: () => number}} deps
 * @returns {LoadResult}
 */
export function loadState({ backend, now }) {
  /** @type {string|null} */
  let raw;
  try {
    raw = backend.getItem(STORAGE_KEY);
  } catch {
    return { state: createDefaultState(now), notice: { code: 'unavailable' }, readOnly: true, migratedFrom: null };
  }
  if (raw === null || raw === undefined) {
    return { state: createDefaultState(now), notice: null, readOnly: false, migratedFrom: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recoverFromCorrupt(raw, backend, now);
  }

  try {
    const { state, fromVersion } = migrate(parsed);
    return {
      state: normalizeState(state, now),
      notice: null,
      readOnly: false,
      migratedFrom: fromVersion === CURRENT_VERSION ? null : fromVersion,
    };
  } catch (error) {
    if (error && /** @type {any} */ (error).code === 'newer') {
      // ASSUMPTION: Daten einer neueren App-Version werden nicht angefasst (nur lesen, nicht
      // speichern) – sonst überschreibt eine alte HTML-Datei den neueren Fortschritt.
      return {
        state: createDefaultState(now),
        notice: { code: 'newer', version: /** @type {any} */ (error).version },
        readOnly: true,
        migratedFrom: null,
      };
    }
    return recoverFromCorrupt(raw, backend, now);
  }
}

/**
 * @param {string} raw
 * @param {StorageBackend} backend
 * @param {() => number} now
 * @returns {LoadResult}
 */
function recoverFromCorrupt(raw, backend, now) {
  const backupKey = `${BACKUP_KEY_PREFIX}${now()}`;
  try {
    backend.setItem(backupKey, raw);
  } catch {
    // Sicherung ging nicht (z. B. Speicher voll): dann auch nichts überschreiben.
    return { state: createDefaultState(now), notice: { code: 'corrupt', backupKey: null }, readOnly: true, migratedFrom: null };
  }
  const state = createDefaultState(now);
  try {
    // Sofort ersetzen, damit nicht jedes weitere Laden ein neues Backup anlegt.
    backend.setItem(STORAGE_KEY, serializeState(state));
  } catch {
    // Backup existiert; der nächste reguläre Speichervorgang versucht es erneut.
  }
  return { state, notice: { code: 'corrupt', backupKey }, readOnly: false, migratedFrom: null };
}

/**
 * Debounced writer around loadState(). Writes at most once per `debounceMs`,
 * always with the latest state; flush() writes immediately (e.g. on pagehide).
 * @param {Object} deps
 * @param {StorageBackend} deps.backend
 * @param {() => number} deps.now
 * @param {number} [deps.debounceMs]
 * @param {(fn: () => void, ms: number) => any} [deps.setTimer]
 * @param {(handle: any) => void} [deps.clearTimer]
 * @param {(error: unknown) => void} [deps.onError] called when a write fails
 */
export function createStorage({
  backend,
  now,
  debounceMs = 400,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
  onError = () => {},
}) {
  let readOnly = false;
  /** @type {AppState|null} */
  let pending = null;
  /** @type {any} */
  let timer = null;

  function write() {
    timer = null;
    if (pending === null || readOnly) return;
    const state = pending;
    pending = null;
    try {
      backend.setItem(STORAGE_KEY, serializeState(state));
    } catch (error) {
      onError(error);
    }
  }

  return {
    /** @returns {LoadResult} */
    load() {
      const result = loadState({ backend, now });
      readOnly = result.readOnly;
      return result;
    },
    /** @param {AppState} state */
    save(state) {
      if (readOnly) return;
      pending = state;
      if (timer === null) timer = setTimer(write, debounceMs);
    },
    flush() {
      if (timer !== null) clearTimer(timer);
      write();
    },
    get readOnly() {
      return readOnly;
    },
  };
}

/**
 * In-memory backend for tests and for browsers that block localStorage.
 * @param {Record<string, string>} [initial]
 * @returns {StorageBackend & {dump: () => Record<string, string>}}
 */
export function createMemoryBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? /** @type {string} */ (data.get(key)) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}
