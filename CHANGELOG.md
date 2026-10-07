# Changelog

## M4 – Gamification · 2026-10-07

### Neu
- **XP** (`engine/xp.js`):
  - richtig beim ersten Versuch 10 (Schwierigkeit 3: 15)
  - Teilpunkte bei Zuordnen, Lückentext, Reihenfolge und Multiple Choice anteilig
  - Freitext: Rubrik-Anteil × 20
  - Fehlerkiste: 5
  - Lektion geschafft +10, perfekt +10 extra
  - Wiederholung am Ende: 0

  XP stehen im Feedback-Sheet („+10 XP“) und im Ergebnis („Ladung gesichert. +125 XP“).
- **Tagesziel:** Chill 30, Solide 60, Ehrgeizig 100, Prüfungsmodus 150. Fortschrittsring auf Home,
  kleine Animation, sobald es geschafft ist.
- **Streak mit Freeze** (`engine/streak.js`):
  - Ein Tag zählt ab der ersten abgeschlossenen Session.
  - Ein verpasster Tag verbraucht einen Freeze, ohne Freeze reißt der Streak.
  - +1 Freeze je 7 Tage, höchstens 2.

  Beim Öffnen wird nachgerechnet, mit Hinweis („Streak-Freeze eingesetzt“ / „Streak ist gerissen“).
- **Demo-Liga** (`engine/league.js`):
  - Woche Mo–So (`2026-W41`), 7 Stufen von Palette bis Mega-Carrier.
  - 19 simulierte Gegner mit Logistik-Spitznamen, deterministisch aus Woche, Stufe und Nutzer-Seed,
    auch inaktive.
  - Top 5 steigen auf, die letzten 5 ab.
  - Beim ersten Öffnen einer neuen Woche erscheint das Ergebnis.
  - Der Hinweis „Demo-Liga: Gegner sind simuliert …“ steht immer sichtbar oben.
  - Abgestimmt per Test: Bei ~100 XP an 5 Tagen steigt man in Stufe 1–3 praktisch immer auf, in
    Stufe 4 meist; ab Stufe 5 wird es knapp.
- **Mastery & Ampel** je Thema (`engine/mastery.js`): Anteil Fragen in Box ≥ 4. Rot < 40 %,
  gelb 40–79 %, grün ≥ 80 % („Klausurbereit“). Ring und Ampel im Lernpfad.
- **Klausur-Countdown:** „Noch 23 Tage bis LF14.2“ plus empfohlenes Tagespensum
  (ungesehene + schwache Fragen / Tage, aufgerundet auf Lektionen).
- **Badges** (`engine/badges.js`, datengetrieben): alle 11 aus SPEC §4.8. Neue erscheinen im
  Ergebnis, alle im Profil.
- **Home-Dashboard:** Streak, XP-Ring, Liga-Platz, Streak-Microcopy, Countdown.
- **Onboarding** (4 Schritte, überspringbar): Spitzname, Tagesziel, Klausurdatum, Erinnerungszeit.
  Erscheint beim ersten Start.
- **Einstellungen:** Spitzname, Tagesziel und Klausurtermine sind jetzt änderbar (Tagesziel laut
  §4.8 „jederzeit änderbar“, Termin für den Countdown).
- **Tests:** 138 Unit-Tests. Neu: Streak (Mitternacht, beide Zeitumstellungen, verpasste Tage mit und
  ohne Freeze, Idempotenz), Liga (deterministisch, Auf- und Abstieg, Wochenwechsel, Abstimmung),
  XP, Badges, Mastery und Countdown.

### Annahmen (`// ASSUMPTION:` im Code)
- Fehlerkiste: 5 XP nur für ganz richtige Antworten, keine Teil-XP.
- Der Lektions-Bonus (+10/+10) gilt auch für „Thema üben“ und „Fehler üben“.
- Freezes werden Tag für Tag verbraucht. Reichen sie nicht, reißt der Streak trotzdem.
- Liga:
  - Gewertet wird nur die zuletzt gespielte Woche und nur, wenn darin XP gesammelt wurden. Keine
    Abstiege durch Abwesenheit.
  - Bei Gleichstand steht der Nutzer vorn.
- „Thema gemeistert“ heißt Ampel grün (≥ 80 %), nicht 100 %.
- Der Kalender-Export (.ics) für die Erinnerung kommt mit M6. Im Onboarding wird nur die Uhrzeit
  gewählt.
- Das Profil zeigt schon die Abzeichen. Heatmap und XP-Verlauf folgen mit M6.

## M3 – Lektionen & Spaced Repetition · 2026-10-07

### Neu
- **Leitner-Boxen** (`engine/scheduler.js`): Richtig bringt die Frage eine Box höher (Intervalle 1 · 3 ·
  7 · 16 · 35 Tage). Falsch bringt sie zurück in Box 1, sie ist heute fällig und landet in der
  Fehlerkiste. Ab Box 4 gilt sie als gemeistert.
- **Session-Builder** (`engine/session.js`) für eine Lektion mit ~10 Fragen, in dieser Reihenfolge:
  1. bis zu 4 fällige Wiederholungen, die am längsten überfälligen zuerst
  2. neue Fragen in Pfad-Reihenfolge
  3. weitere Wiederholungen
  4. Festigen (niedrigste Box, älteste zuerst)

  Dazu: höchstens 1 Freitext-Frage je Lektion, nicht mehr als 3 gleiche Fragetypen in Folge.
  Reine Funktion mit injizierter Uhr.
- **Lektionsablauf:** Fortschrittsbalken, falsch beantwortete Fragen kommen einmal am Ende wieder.
  Abbrechen fragt nach, die Antworten bis dahin bleiben gespeichert.
- **Ergebnis-Screen:** „Ladung gesichert.“ bzw. „Perfekte Lektion.“, Trefferquote, Dauer,
  Fragen zum Nachüben, weiter zur nächsten Lektion oder in die Fehlerkiste. Dazu stapeln sich
  drei Pakete (CSS-Animation, respektiert `prefers-reduced-motion`).
- **Fehlerkiste:** Fragen nach Thema gruppiert, mit „noch 2×/1× richtig“. „Fehler üben“ startet eine
  Session nur daraus. Nach 2 richtigen Antworten in Folge ist eine Frage raus.
- **Home:** „Weiterlernen“ folgt dem Pfad und zeigt das aktuelle Thema und die fälligen
  Wiederholungen.
- **Thema üben:** Tipp auf ein Thema startet eine Lektion nur aus diesem Thema.
- **Fortschritt:** Jede Erstantwort aktualisiert sofort die Karte und landet im `events`-Log.
  Abgeschlossene Sessions zählen in `days` (Lektionen, Lernminuten).
- **Tests:** 110 Unit-Tests. Neu ist eine **14-Tage-Simulation** mit injizierter Uhr über die
  Zeitumstellung am 25.10.2026. Sie prüft bei jeder Antwort Box-Wechsel und Fälligkeit, dass
  immer die am längsten überfälligen Wiederholungen drankommen, und Rein und Raus der Fehlerkiste.

### Annahmen (`// ASSUMPTION:` im Code)
- Für das Verlassen der Fehlerkiste zählen richtige Antworten aus allen Modi.
- Die Wiederholung am Lektionsende ändert die Karte nicht. Nur der erste Versuch zählt.
- „Fehler üben“ und „Thema üben“ zählen als Lektion des Tages, eine abgebrochene Lektion nicht.
- `events` tragen zusätzlich `mode` (path/topic/mistakes). Wiederholungen werden nicht geloggt.

## Hosting · 2026-10-07

- `netlify.toml`: Netlify baut mit `npm run build` und veröffentlicht `dist/`. `/` zeigt auf
  `lernfracht.html`, `X-Robots-Tag: noindex` hält Suchmaschinen fern, Deploy-Previews je PR.

## M2 – Fragen-Engine · 2026-10-07

### Neu
- **Alle 8 Fragetypen** im Lernmodus (`ui/components/questions/`):
  - Single und Multiple Choice als Antwortkarten mit gemischten Optionen.
  - Stimmt / Stimmt nicht als zwei große Buttons.
  - Zuordnen per Tippen: Begriff, dann Kategorie. Der nächste Begriff wird automatisch gewählt.
  - Reihenfolge mit ↑/↓. Die Liste startet nie schon fertig sortiert.
  - Lückentext mit Wortbank.
  - Zahlenfeld mit Dezimaltastatur und Einheit.
  - Freitext: erst schreiben, dann Musterlösung, Selbstbewertung je Rubrik-Kriterium und
    Hinweis auf die verwendeten Schlüsselbegriffe.
- **Bewertung** (`engine/grading.js`) inklusive Teilpunkten und Klausurpunkten nach SPEC §4.3,
  `examPoints` überschreibt den Default. `open` zählt ab 60 % als richtig.
- **Zahlenparser** (`engine/numbers.js`) für `57.380,5`, `57.380` und `40.43`. Leerzeichen, € und %
  werden ignoriert. Ungültige Eingaben zeigen einen Hinweis und zählen nicht als Fehlversuch.
- **Feedback-Sheet** von unten in Grün oder Rot: Lösung, Erklärung, Quelle und der Hinweis
  „Ergänzung – mit Unterricht abgleichen“ (bei `supplemented` oder `note`). Haptik, wo verfügbar.
- **Context-Block:** Text und seitlich scrollbare Tabelle über der Frage, Zahlen rechtsbündig.
- **Tastatur:** `1–9` wählt Optionen, Kategorien, Wörter oder Rubrik-Kriterien, `Enter` prüft
  bzw. geht weiter.
- **KI-Schicht:** `engine/ai/provider.js` (Interface aus SPEC §5) und `engine/ai/local.js`
  (Selbstbewertung, Erklärung aus dem Content). Der Provider wird zentral in `main.js` gewählt.
- **Debug-Route** `#/debug/questions?debug=1`: alle 90 Fragen durchklicken, vor und zurück, Sprung
  per Auswahlliste, Metadaten (Typ, Thema, Schwierigkeit, Ergänzung/Notiz).
- **Tests:** 87 Unit-Tests (31 neue). Sie decken jede Bewertungsfunktion, alle Zahlenformate aus
  §4.3, das Mischen und die Lösungsanzeige ab. Ein Test prüft außerdem, dass die Content-Lösung
  jeder der 90 Fragen volle Punkte ergibt.

### Annahmen (`// ASSUMPTION:` im Code)
- `gradeOpenAnswer(question, text, context?)`: Der optionale dritte Parameter trägt die
  Selbstbewertung aus der UI. Ein KI-Provider kann ihn ignorieren.
- `1,5.3` gilt als ungültige Zahl (Hinweis statt Raten).
- Bei Teilpunkten heißt die Überschrift „Teilweise richtig – schau mal:“.
- Bei Zuordnen, Reihenfolge und Lückentext steht die Korrektur direkt an der Antwort statt
  noch einmal im Sheet.
- Freitext: Die Musterlösung erscheint erst, wenn etwas geschrieben wurde.

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
