// Liest und prüft alle content/*.json – gemeinsam genutzt von validate-content.mjs und build.mjs.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateUnit } from '../../src/engine/content.js';

/**
 * @typedef {Object} ContentFile
 * @property {string} file file name, e.g. `lf14-2.json`
 * @property {any} unit parsed unit (null if unparsable)
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * @param {string} dir
 * @returns {Promise<{files: ContentFile[], errors: number, warnings: number}>}
 */
export async function loadContentDir(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  /** @type {ContentFile[]} */
  const files = [];
  const seenIds = new Map();

  for (const file of names) {
    /** @type {ContentFile} */
    const entry = { file, unit: null, errors: [], warnings: [] };
    files.push(entry);
    try {
      entry.unit = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    } catch (error) {
      entry.errors.push(`JSON ungültig: ${/** @type {Error} */ (error).message}`);
      continue;
    }
    const result = validateUnit(entry.unit);
    entry.errors.push(...result.errors);
    entry.warnings.push(...result.warnings);

    const id = entry.unit?.id;
    if (typeof id === 'string') {
      // ASSUMPTION: Dateiname = Einheiten-ID (SPEC §7: `content/<unit-id>.json`) ist Pflicht.
      if (file !== `${id}.json`) entry.errors.push(`Dateiname muss „${id}.json“ heißen (id der Einheit)`);
      if (seenIds.has(id)) entry.errors.push(`Einheit „${id}“ gibt es schon in ${seenIds.get(id)}`);
      seenIds.set(id, file);
    }
  }

  if (files.length === 0) {
    files.push({ file: '(content/)', unit: null, errors: ['keine *.json-Dateien gefunden'], warnings: [] });
  }

  return {
    files,
    errors: files.reduce((n, f) => n + f.errors.length, 0),
    warnings: files.reduce((n, f) => n + f.warnings.length, 0),
  };
}

/**
 * Human readable report (German, for content authors).
 * @param {ContentFile[]} files
 * @returns {string}
 */
export function formatReport(files) {
  const lines = [];
  for (const f of files) {
    const ok = f.errors.length === 0;
    const u = f.unit;
    const summary = ok && u
      ? ` – ${u.questions.length} Fragen, ${u.topics.length} Themen, Status ${u.reviewStatus}`
      : '';
    lines.push(`${ok ? '✔' : '✖'} ${f.file}${summary}`);
    for (const e of f.errors) lines.push(`    ✖ ${e}`);
    for (const w of f.warnings) lines.push(`    ⚠ ${w}`);
  }
  return lines.join('\n');
}

/**
 * Serializes JSON so it can sit inside `<script type="application/json">`:
 * `<` is escaped, so neither `</script>` nor `<!--` can end the element early.
 * @param {unknown} value
 * @returns {string}
 */
export function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
