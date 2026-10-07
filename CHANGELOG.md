# Changelog

## M1 – Fundament · 2026-10-07

### Neu
- **Projekt:** Struktur nach SPEC §9, `package.json` mit `build`, `dev`, `test` und `validate`.
  Einzige Dev-Dependency ist `esbuild`. Dazu `CLAUDE.md` mit den Arbeitsregeln.
- **Content:** `engine/content.js` mit Katalog (Themen nach `order`, globale Frage-IDs, Fragen je Thema)
  und Validator für alle Regeln aus SPEC §7.4. `npm run validate` gibt einen lesbaren Bericht aus und
  endet mit Exit-Code 1 bei Fehlern. `lf14-2.json`: 0 Fehler, 0 Warnungen.
- **Storage:** `engine/storage.js` mit einem Key (`lernfracht.state.v1`) und gebündeltem Schreiben
  (Debounce, `flush()` bei `pagehide`/Tab-Wechsel). Fehlende Felder werden mit Defaults ergänzt, unbekannte
  bleiben erhalten. Das Event-Log ist auf 2.000 Einträge begrenzt.
  - Kaputtes JSON: Backup unter `lernfracht.state.backup.<timestamp>`, Neustart, Hinweis.
  - Lässt sich das Backup nicht anlegen, wird nichts überschrieben.
  - Ist localStorage gesperrt, läuft die App im Speicher weiter und zeigt einen Hinweis.
- **Migrationen:** `engine/migrations.js` mit Versionskette. Daten einer neueren App-Version werden
  nur gelesen, nie überschrieben.
- **App-Gerüst:** Hash-Router (`#/home`, `#/cando/:unitId`, …) und Store mit `subscribe()`.
  Bottom-Navigation: Lernen · Fehlerkiste · Klausur · Liga · Profil.
  11 Screens, bisher als Platzhalter. Die Debug-Route ist nur mit `?debug=1` erreichbar.
- **Home:** Lernpfad mit den 9 Themen von LF14.2 (Icon, Titel, Anzahl Fragen) und Link zur Kann-Liste.
- **Design:** Tokens aus SPEC §6 als CSS Custom Properties, System-Fonts, mobile-first (Spalte max. 480 px).
  `prefers-reduced-motion` wird respektiert.
- **Theme:** Dunkel (Default), Hell oder System, umschaltbar in den Einstellungen und gespeichert.
  „System“ folgt dem Gerät live.
- **Build:** `dist/lernfracht.html` (≈ 91 KB) enthält JS als IIFE, CSS und Content als
  `<script type="application/json" id="content-…">`. Die Datei funktioniert per `file://`.
  Eine CSP sperrt alle Netzwerk-Requests. Ungültiger Content bricht den Build ab.
- **CI:** GitHub Actions prüft jeden PR und `main` mit Tests, Validator und Build auf Node 20 und 22.
  Das gebaute HTML hängt als Artefakt am Lauf.
- **Tests:** 56 Unit-Tests für Storage, Migrationen, Validator, Katalog, Router, Store, Datum,
  Template-Befüllung und Theme.

### Annahmen (`// ASSUMPTION:` im Code)
- Ein gespeicherter Zustand ohne `version` gilt als Version 1.
- Daten einer neueren Version → nur lesen, nicht speichern (Hinweis an Nutzer:in).
- Liga-`seed`/`weekId` bleiben `null`, bis M4 die Liga-Logik bringt.
- Der Validator ist strenger als SPEC §7.4:
  - Fehler: doppelte Optionen/Items/Kategorien, Kontext-Tabellen mit falscher Spaltenzahl,
    Dateiname ≠ Einheiten-ID.
  - Nur Warnung: unbekannte Felder.
- Ungültiger Content bricht `npm run build` ab.
- Das Onboarding (SPEC §4.1) ist keinem Meilenstein zugeordnet und existiert bisher nur als Platzhalter.
- `dist/` wird nicht eingecheckt (entsteht mit `npm run build`).
