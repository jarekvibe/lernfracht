import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { SIZE_BUDGET_BYTES, buildHtml, fillTemplate } from '../scripts/lib/build-html.mjs';
import { jsonForHtml } from '../scripts/lib/content-files.mjs';
import { resolveTheme } from '../src/ui/theme.js';

const TEMPLATE = '<style>/*__STYLES__*/</style><!--__CONTENT__--><script>/*__SCRIPT__*/</script>';

test('fillTemplate inserts every part exactly once', () => {
  const html = fillTemplate(TEMPLATE, { styles: 'a{}', content: '<x>', script: 'go()' });
  assert.equal(html, '<style>a{}</style><x><script>go()</script>');
});

test('fillTemplate keeps `$` sequences and later placeholders in inserted text literally', () => {
  const html = fillTemplate(TEMPLATE, { styles: '', content: "$& $1 $' /*__SCRIPT__*/", script: 's' });
  assert.equal(html, "<style></style>$& $1 $' /*__SCRIPT__*/<script>s</script>");
});

test('fillTemplate rejects missing or duplicated placeholders', () => {
  assert.throws(() => fillTemplate('<!--__CONTENT__-->/*__SCRIPT__*/', { styles: '', content: '', script: '' }), /STYLES/);
  assert.throws(() => fillTemplate(`${TEMPLATE}/*__SCRIPT__*/`, { styles: '', content: '', script: '' }), /gefunden: 2/);
});

test('jsonForHtml cannot close the surrounding script element and still parses', () => {
  const value = { text: '</script><script>alert(1)</script> <!-- a < b', ls: '\u2028\u2029' };
  const encoded = jsonForHtml(value);
  assert.ok(!encoded.includes('<'));
  assert.deepEqual(JSON.parse(encoded), value);
});

test('resolveTheme: dark default, light, system follows the device', () => {
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('system', true), 'light');
  assert.equal(resolveTheme('system', false), 'dark');
  assert.equal(resolveTheme(/** @type {any} */ ('pink'), true), 'dark');
});

test('real build: under the size budget, CSP present, nothing loaded from outside', async () => {
  const { html } = await buildHtml(fileURLToPath(new URL('..', import.meta.url)));
  assert.ok(Buffer.byteLength(html, 'utf8') < SIZE_BUDGET_BYTES, 'dist/lernfracht.html exceeds the budget');
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
  assert.doesNotMatch(html, /<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /@import|url\((?:'|")?https?:/i);
});
