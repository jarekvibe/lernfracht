#!/usr/bin/env node
// `npm run build` → dist/lernfracht.html · `npm run dev` → dasselbe im Watch-Modus.

import { watch } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIZE_BUDGET_BYTES, buildHtml } from './lib/build-html.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outFile = path.join(root, 'dist', 'lernfracht.html');
const watchMode = process.argv.includes('--watch');

/** @returns {Promise<boolean>} */
async function buildOnce() {
  const started = Date.now();
  try {
    const { html, units } = await buildHtml(root);
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, html, 'utf8');
    const bytes = Buffer.byteLength(html, 'utf8');
    const kb = (bytes / 1024).toFixed(1).replace('.', ',');
    const unitInfo = units.map((u) => `${u.id} (${u.questions} Fragen)`).join(', ');
    if (bytes > SIZE_BUDGET_BYTES) {
      // Budget aus SPEC §9: die Datei muss auch über schwaches Netz schnell auf dem Handy sein.
      console.error(`✖ dist/lernfracht.html – ${kb} KB, erlaubt sind ${SIZE_BUDGET_BYTES / 1024} KB. Bilder oder große Inhalte verkleinern.`);
      return false;
    }
    console.log(`✔ dist/lernfracht.html – ${kb} KB von ${SIZE_BUDGET_BYTES / 1024} KB · ${unitInfo} · ${Date.now() - started} ms`);
    return true;
  } catch (error) {
    console.error(`✖ Build fehlgeschlagen\n${error instanceof Error ? error.message : error}`);
    return false;
  }
}

const ok = await buildOnce();

if (!watchMode) {
  process.exitCode = ok ? 0 : 1;
} else {
  /** @type {NodeJS.Timeout|undefined} */
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(buildOnce, 100);
  };
  for (const dir of ['src', 'content']) {
    watch(path.join(root, dir), { recursive: true }, schedule);
  }
  console.log('👀 Watch-Modus: src/ und content/ werden beobachtet (Strg+C beendet)');
}
