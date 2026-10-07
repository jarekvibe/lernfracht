// Kalendertage immer als `YYYY-MM-DD` in LOKALER Zeit – nie über toISOString() (UTC).

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a Date as a local calendar day.
 * @param {Date} date
 * @returns {string} `YYYY-MM-DD`
 */
export function toLocalDateString(date) {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Today's local calendar day for an injected clock.
 * @param {() => number} now epoch milliseconds
 * @returns {string}
 */
export function todayLocal(now) {
  return toLocalDateString(new Date(now()));
}

/**
 * True for a real calendar day in `YYYY-MM-DD` form (rejects e.g. 2026-02-30).
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDateString(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/**
 * @param {string} dateString `YYYY-MM-DD`
 * @returns {number} UTC midnight of that calendar day (only for day arithmetic)
 */
function utcDay(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Calendar arithmetic on `YYYY-MM-DD` – independent of time zone and DST.
 * @param {string} dateString
 * @param {number} days may be negative
 * @returns {string}
 */
export function addDays(dateString, days) {
  const t = new Date(utcDay(dateString) + days * 86400000);
  const y = String(t.getUTCFullYear()).padStart(4, '0');
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Whole calendar days from `a` to `b` (positive if b is later).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function diffDays(a, b) {
  return Math.round((utcDay(b) - utcDay(a)) / 86400000);
}
