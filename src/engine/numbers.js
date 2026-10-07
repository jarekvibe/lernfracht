// Zahleneingabe deutsch/englisch tolerant parsen (SPEC §4.3) und deutsch formatieren.

/** Leerzeichen (auch geschützte), Euro- und Prozentzeichen werden ignoriert. */
const IGNORED_RE = /[\s  €%]/g;
const THOUSANDS_ONLY_RE = /^[+-]?\d{1,3}(?:\.\d{3})+$/;
const PLAIN_NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * @typedef {{ok: true, value: number} | {ok: false, reason: 'empty'|'invalid'}} ParsedNumber
 */

/**
 * Parses what a learner typed into a numeric field.
 * - comma present → comma is the decimal separator, dots are dropped (`57.380,5` → 57380.5)
 * - no comma and only groups of three after dots → dots are thousands separators (`57.380` → 57380)
 * - otherwise the dot is the decimal separator (`40.43` → 40.43)
 * Invalid input is reported, never guessed (the UI shows a hint instead of counting a mistake).
 * @param {string} input
 * @returns {ParsedNumber}
 */
export function parseNumberInput(input) {
  let s = String(input ?? '').replace(IGNORED_RE, '').replace(/−/g, '-');
  if (s === '') return { ok: false, reason: 'empty' };

  if (s.includes(',')) {
    const [whole, fraction, ...rest] = s.split(',');
    // ASSUMPTION: Nach dem Dezimalkomma sind nur Ziffern erlaubt – `1,5.3` gilt als ungültig
    // (Hinweis statt Raten), obwohl „Punkte entfernen“ wörtlich 1,53 ergäbe.
    if (rest.length > 0 || !/^\d*$/.test(fraction)) return { ok: false, reason: 'invalid' };
    s = `${whole.replace(/\./g, '')}.${fraction}`;
  } else if (THOUSANDS_ONLY_RE.test(s)) {
    s = s.replace(/\./g, '');
  }

  if (!PLAIN_NUMBER_RE.test(s)) return { ok: false, reason: 'invalid' };
  return { ok: true, value: Number(s) };
}

/**
 * German number formatting, e.g. 57380.5 → `57.380,5`.
 * @param {number} value
 * @param {number} [decimals] fixed number of decimals; omitted → as many as needed
 * @returns {string}
 */
export function formatNumber(value, decimals) {
  const options = decimals === undefined
    ? { maximumFractionDigits: 10 }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return new Intl.NumberFormat('de-DE', options).format(value);
}
