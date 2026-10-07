// Baut die Single-File-App: JS (esbuild, IIFE), CSS und alle Content-Dateien inline in eine HTML.

import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { formatReport, jsonForHtml, loadContentDir } from './content-files.mjs';

export const SIZE_BUDGET_BYTES = 400 * 1024;

const SLOTS = {
  styles: '/*__STYLES__*/',
  content: '<!--__CONTENT__-->',
  script: '/*__SCRIPT__*/',
};

/**
 * Fills the template placeholders in one pass, so inserted text can never be
 * mistaken for a later placeholder. Each placeholder must occur exactly once.
 * @param {string} template
 * @param {{styles: string, content: string, script: string}} parts
 * @returns {string}
 */
export function fillTemplate(template, parts) {
  /** @type {Record<string, string>} */
  const byToken = {};
  for (const [name, token] of Object.entries(SLOTS)) {
    const count = template.split(token).length - 1;
    if (count !== 1) throw new Error(`Platzhalter ${token} muss genau einmal im Template stehen (gefunden: ${count})`);
    byToken[token] = parts[/** @type {keyof typeof parts} */ (name)];
  }
  const pattern = new RegExp(Object.values(SLOTS).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return template.replace(pattern, (token) => byToken[token]);
}

/**
 * @param {string} root project root
 * @returns {Promise<{html: string, units: {id: string, questions: number}[]}>}
 */
export async function buildHtml(root) {
  const r = (/** @type {string[]} */ ...p) => path.join(root, ...p);

  // ASSUMPTION: Ungültiger Content bricht den Build ab – lieber kein Build als eine kaputte App.
  const content = await loadContentDir(r('content'));
  if (content.errors > 0) {
    const broken = content.files.filter((f) => f.errors.length > 0);
    throw new Error(`Content ungültig – Build abgebrochen (Details: npm run validate):\n${formatReport(broken)}`);
  }

  const pkg = JSON.parse(await readFile(r('package.json'), 'utf8'));
  const [template, cssSource] = await Promise.all([
    readFile(r('src', 'index.html'), 'utf8'),
    readFile(r('src', 'styles.css'), 'utf8'),
  ]);

  const css = (await transform(cssSource, { loader: 'css', minify: true, charset: 'utf8' })).code.trim();
  const bundle = await build({
    entryPoints: [r('src', 'main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    write: false,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  });
  const script = bundle.outputFiles[0].text.trim();

  // Inline-Elemente dürfen ihr eigenes End-Tag nicht enthalten.
  if (/<\/script/i.test(script)) throw new Error('JS-Bundle enthält „</script“ – kann nicht inline eingebettet werden');
  if (/<\/style/i.test(css)) throw new Error('CSS enthält „</style“ – kann nicht inline eingebettet werden');

  const units = content.files.map((f) => f.unit);
  const contentTags = units
    .map((u) => `<script type="application/json" id="content-${u.id}">${jsonForHtml(u)}</script>`)
    .join('\n');

  return {
    html: fillTemplate(template, { styles: css, content: contentTags, script }),
    units: units.map((u) => ({ id: u.id, questions: u.questions.length })),
  };
}
