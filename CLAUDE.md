# CLAUDE.md – Lernfracht

Prüfungstrainer für Azubis (Kaufleute für Spedition und Logistikdienstleistung). Phase 1 ist eine
offline-fähige Single-File-Web-App (`dist/lernfracht.html`): kein Backend, keine Accounts, keine
KI-Calls, keine externen Requests. Die vollständige Spezifikation steht in `SPEC.md` – sie ist die Quelle.

## Arbeitsregeln (SPEC §15)

1. Ein Meilenstein (SPEC §12) pro Durchgang. Vor jeder Scope-Erweiterung nachfragen.
2. Engine (`src/engine/`) ohne DOM, Uhr immer injizierbar (`now()` als Parameter, kein `Date.now()`
   in der Engine), reine Funktionen bevorzugen.
3. Keine neuen Dependencies außer `esbuild` ohne Rückfrage.
4. Content nie im Code hardcoden. Content-Änderungen nur in `content/*.json`, danach `npm run validate`.
   Frage-IDs nie ändern – der Lernfortschritt hängt an `${unit.id}/${question.id}`.
5. UI-Texte Deutsch (duzen, kurz, nicht cringe), Code und Identifier Englisch, JSDoc-Typen für
   öffentliche Funktionen.
6. Bei Unklarheiten: sinnvolle Annahme treffen, im Code mit `// ASSUMPTION:` markieren und in der
   Meilenstein-Zusammenfassung auflisten.
7. Nach jedem Meilenstein: `npm test && npm run validate && npm run build` grün, `CHANGELOG.md`
   ergänzen, manuelle Testschritte nennen.

## Technische Leitplanken

- Kalendertage immer `YYYY-MM-DD` in lokaler Zeit (`engine/dates.js`), nie über `toISOString()`.
- Persistenz nur über `engine/storage.js` (ein Key: `lernfracht.state.v1`). Formatänderung →
  `CURRENT_VERSION` erhöhen, Schritt in `engine/migrations.js` ergänzen, Test schreiben.
- Zur Laufzeit keine Netzwerk-Requests, keine externen Fonts/CDNs. Die CSP in `src/index.html`
  erzwingt das – nicht aufweichen, ohne zu fragen.
- DOM nur über `h()` aus `ui/dom.js`: Texte als Textknoten, kein `innerHTML` mit Content.
- Screens bekommen einen `ScreenContext` (`ui/app.js`) und liefern DOM-Knoten; Aufräumen über
  `ctx.onCleanup()`.
- Antworten beziehen sich immer auf Content-Indizes, nie auf die gemischte Anzeige-Position
  (`engine/present.js`). Bewertung nur über `engine/grading.js`.
- Die UI spricht KI nur über das `AiProvider`-Interface an (`engine/ai/`); gewählt wird in `main.js`.
- Rechtliches (SPEC §13): Das Berufsschul-Skript (PDF) kommt nicht ins Repo. Keine Daten aus dem
  Ausbildungsbetrieb in Content, Beispielen oder Tests.
