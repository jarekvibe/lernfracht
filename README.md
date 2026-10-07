# Lernfracht

Prüfungstrainer für Azubis – Kaufleute für Spedition und Logistikdienstleistung.
Die App ist **eine einzige HTML-Datei**, läuft komplett offline, und alle Daten bleiben im Browser
auf deinem Gerät.

> **Stand:** Phase 1, Meilenstein M1 (Fundament). Was fertig ist, steht in [`CHANGELOG.md`](CHANGELOG.md),
> der Plan in [`SPEC.md`](SPEC.md).

## Schnellstart

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
npm run build
```

Danach `dist/lernfracht.html` per Doppelklick im Browser öffnen – fertig.

## Befehle

| Befehl | Was passiert |
|---|---|
| `npm run build` | baut `dist/lernfracht.html` (JS, CSS und alle Inhalte in einer Datei) |
| `npm run dev` | wie `build`, baut bei jeder Änderung in `src/` oder `content/` neu |
| `npm test` | Unit-Tests (`node --test`) |
| `npm run validate` | prüft alle `content/*.json` gegen das Schema |

## Aufbau

```
content/        Lerneinheiten als JSON (Schema: SPEC §7), z. B. lf14-2.json
src/engine/     Logik ohne DOM: Content, Storage, Migrationen, Datum …
src/ui/         Router, Screens und Komponenten
src/main.js     Start: Inhalte + Zustand laden, alles verdrahten
scripts/        Build und Content-Validator
tests/          Unit-Tests
```

Debug-Ansicht: `dist/lernfracht.html#/debug/questions?debug=1`

Hosting (Netlify, GitHub Pages) und „neue Content-Datei anlegen“ beschreibt dieses README ab M7.
