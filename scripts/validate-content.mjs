#!/usr/bin/env node
// `npm run validate` – prüft alle content/*.json gegen das Schema (SPEC §7.4).
// Exit-Code 1 bei Fehlern; Warnungen lassen die Prüfung bestehen.

import { fileURLToPath } from 'node:url';
import { formatReport, loadContentDir } from './lib/content-files.mjs';

const contentDir = fileURLToPath(new URL('../content/', import.meta.url));
const { files, errors, warnings } = await loadContentDir(contentDir);

console.log(formatReport(files));
console.log(`\n${files.length} Datei(en), ${errors} Fehler, ${warnings} Warnung(en)`);
process.exitCode = errors > 0 ? 1 : 0;
