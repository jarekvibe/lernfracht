process.env.TZ = 'Europe/Berlin';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderIcs, escapeText, foldLine, utcStamp } from '../src/engine/ics.js';

const stamp = new Date(Date.UTC(2026, 9, 7, 16, 5, 9)).getTime();
const ics = (extra = {}) => buildReminderIcs({ time: '18:00', startDate: '2026-10-07', stamp, uid: 'lernfracht-daily-123@lernfracht', version: '0.1.0', ...extra });
/** Unfolds and splits into logical content lines (RFC 5545 §3.1). */
const unfold = (text) => text.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
const octets = (s) => new TextEncoder().encode(s).length;

test('every line ends with CRLF, no bare LF, file ends with CRLF', () => {
  const text = ics({ appUrl: 'https://lernfracht.netlify.app' });
  assert.ok(text.endsWith('\r\n'));
  assert.equal(text.replace(/\r\n/g, '').includes('\n'), false, 'no bare LF');
  assert.equal(text.replace(/\r\n/g, '').includes('\r'), false, 'no bare CR');
});

test('calendar and event structure', () => {
  const lines = unfold(ics({ appUrl: 'https://lernfracht.netlify.app' }));
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  for (const required of ['VERSION:2.0', 'PRODID:-//Lernfracht//Lernfracht 0.1.0//DE', 'BEGIN:VEVENT', 'END:VEVENT', 'UID:lernfracht-daily-123@lernfracht']) {
    assert.ok(lines.includes(required), required);
  }
  assert.ok(lines.indexOf('BEGIN:VEVENT') < lines.indexOf('BEGIN:VALARM'));
  assert.ok(lines.indexOf('END:VALARM') < lines.indexOf('END:VEVENT'));
});

test('daily recurrence at the reminder time, 10 minutes, floating local time', () => {
  const lines = unfold(ics());
  assert.ok(lines.includes('DTSTART:20261007T180000'), 'no Z, no TZID → device time');
  assert.ok(lines.includes('DURATION:PT10M'));
  assert.ok(lines.includes('RRULE:FREQ=DAILY'));
  assert.ok(lines.includes('DTSTAMP:20261007T160509Z'));
  assert.ok(unfold(buildReminderIcs({ time: '07:05', startDate: '2026-12-31', stamp, uid: 'x' })).includes('DTSTART:20261231T070500'));
});

test('VALARM: display alarm at the start of the event', () => {
  const lines = unfold(ics());
  const alarm = lines.slice(lines.indexOf('BEGIN:VALARM'), lines.indexOf('END:VALARM') + 1);
  assert.deepEqual(alarm, ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:📦 5 Minuten Lernfracht', 'TRIGGER:PT0M', 'END:VALARM']);
});

test('title and link to the app', () => {
  const lines = unfold(ics({ appUrl: 'https://lernfracht.netlify.app' }));
  assert.ok(lines.includes('SUMMARY:📦 5 Minuten Lernfracht'));
  assert.ok(lines.includes('URL:https://lernfracht.netlify.app'));
  assert.ok(lines.some((l) => l.startsWith('DESCRIPTION:Kurz lernen\\, Streak halten. Hier geht’s los: https://lernfracht.netlify.app')));
  const offline = unfold(ics());
  assert.equal(offline.some((l) => l.startsWith('URL:')), false, 'no URL without app URL');
});

test('escaping of TEXT values', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
  assert.equal(escapeText('Zeile 1\r\nZeile 2'), 'Zeile 1\\nZeile 2');
  const lines = unfold(ics({ appUrl: 'https://x.test/?a=1,2;3' }));
  assert.ok(lines.some((l) => l.includes('https://x.test/?a=1\\,2\;3')), 'URL inside DESCRIPTION is escaped');
  assert.ok(lines.includes('URL:https://x.test/?a=1,2;3'), 'URL property itself is a URI, not TEXT');
});

test('long lines are folded at 75 octets without splitting characters', () => {
  const long = `DESCRIPTION:${'Lernfracht 📦 Übung macht den Meister – '.repeat(6)}`;
  const folded = foldLine(long);
  const physical = folded.split('\r\n');
  assert.ok(physical.length > 1);
  physical.forEach((line, i) => {
    assert.ok(octets(line) <= 75, `line ${i}: ${octets(line)} octets`);
    if (i > 0) assert.ok(line.startsWith(' '), 'continuation starts with a space');
  });
  assert.equal(folded.replace(/\r\n /g, ''), long, 'unfolding restores the line');
  assert.equal(foldLine('kurz'), 'kurz');
  const whole = ics({ appUrl: `https://lernfracht.netlify.app/${'x'.repeat(120)}` });
  for (const line of whole.split('\r\n')) assert.ok(octets(line) <= 75);
});

test('DTSTAMP is UTC', () => {
  assert.equal(utcStamp(Date.UTC(2026, 0, 2, 3, 4, 5)), '20260102T030405Z');
});
