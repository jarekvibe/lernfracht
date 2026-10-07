// Kalender-Erinnerung als .ics (RFC 5545, SPEC §4.9): täglich wiederkehrender Termin mit Alarm.

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;

/**
 * Escapes a TEXT value: backslash, semicolon, comma and line breaks.
 * @param {string} text
 */
export function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/**
 * Folds a content line to at most 75 octets per line (CRLF + space), never inside a UTF-8 character.
 * @param {string} line
 * @returns {string}
 */
export function foldLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1; // Folgezeilen beginnen mit Leerzeichen
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/**
 * UTC timestamp for DTSTAMP, e.g. `20261007T160000Z`.
 * @param {number} ms
 */
export function utcStamp(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * Daily reminder at the learner's time, 10 minutes long, alarm at the start.
 * ASSUMPTION: DTSTART ist „floating“ (ohne Zeitzone) – der Termin gilt so in der Ortszeit des
 * Geräts, auf dem er landet, auch über die Zeitumstellung hinweg. Google, Apple und Outlook
 * verstehen das ohne VTIMEZONE-Block.
 * @param {Object} input
 * @param {string} input.time `HH:MM`
 * @param {string} input.startDate `YYYY-MM-DD`
 * @param {number} input.stamp creation time (epoch ms) for DTSTAMP
 * @param {string} input.uid stable id, so a re-import replaces the old reminder
 * @param {string} [input.appUrl] link to the hosted app
 * @param {string} [input.version]
 * @returns {string}
 */
export function buildReminderIcs({ time, startDate, stamp, uid, appUrl = '', version = '0' }) {
  const [hh, mm] = time.split(':');
  const date = startDate.replace(/-/g, '');
  const title = '📦 5 Minuten Lernfracht';
  const description = appUrl
    ? `Kurz lernen, Streak halten. Hier geht’s los: ${appUrl}`
    : 'Kurz lernen, Streak halten. Öffne Lernfracht auf deinem Gerät.';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Lernfracht//Lernfracht ${version}//DE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART:${date}T${hh}${mm}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    appUrl && `URL:${appUrl}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map((line) => foldLine(/** @type {string} */ (line))).join(CRLF) + CRLF;
}
