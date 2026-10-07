# SPEC – Lernfracht: Prüfungstrainer für Azubis in Spedition & Logistik

> **Arbeitstitel:** Lernfracht · **Version:** 0.1 · **Stand:** 07.10.2026 · **Owner:** Jarek
> **Erster Content:** `content/lf14-2.json` – Klausurteil LF14.2 (90 Fragen, Status `draft`)

---

## 0. TL;DR für Claude Code

- Baue **Phase 1**: eine offline-fähige Lern-Web-App, ausgeliefert als **eine einzige HTML-Datei** (`dist/lernfracht.html`). Kein Backend, keine Accounts, keine KI-Calls, keine externen Requests.
- Inhalte kommen ausschließlich aus `content/*.json` (Schema in Abschnitt 7). Nichts davon im Code hardcoden.
- Kern: tägliche Lektionen à ~10 Fragen, Spaced Repetition, XP, Tagesziel, Streak, Demo-Liga, Fehlerkiste, Klausur-Simulation, Kann-Liste, Erinnerungen.
- Arbeite die **Meilensteine aus Abschnitt 12 nacheinander** ab. Nach jedem Meilenstein: `npm test && npm run validate && npm run build` grün, kurze Zusammenfassung, manuelle Testschritte.
- Schneide die Architektur so, dass Phase 2 (Backend, echte Ligen, Push, KI) **ohne Rewrite** andocken kann – insbesondere über die Interfaces in Abschnitt 5 und 8.

---

## 1. Vision

**Problem:** Azubis lernen für Berufsschul-Klausuren und die Abschlussprüfung mit PDF-Skripten, Kann-Listen auf Papier – und meistens erst kurz vorher. Das Wissen wird im Unterricht vermittelt, aber regelmäßige Wiederholung fehlt.

**Lösung:** Drei bewährte Prinzipien in einer App:

1. **Fahrschul-App:** fester Fragenkatalog pro Lernfeld, Prüfungssimulation unter Zeitdruck, Fehler gezielt nachüben.
2. **Duolingo:** 5-Minuten-Sessions, Tagesziel, Streak, wöchentliche Ligen – Lernen als tägliche Gewohnheit.
3. **KI-Tutor (ab Phase 2):** erklärt Fehler individuell und bewertet Freitext-Antworten wie in der Klausur („Erläutern Sie …“).

**Zielgruppe:** Azubis Kaufleute für Spedition und Logistikdienstleistung, 1.–3. Lehrjahr, überwiegend 16–25, mobil, wenig Zeit. Später: weitere Logistikberufe, Ausbilder:innen, Berufsschulklassen.

**Produktprinzipien:**
- **5 Minuten reichen.** Jede Session muss in der Bahn machbar sein.
- **Fehler sind Futter.** Falsche Antworten landen automatisch in der Wiederholung.
- **Klausurnah.** Gleiche Aufgabentypen wie in der Berufsschule: zuordnen, berechnen, Reihenfolge, erläutern.
- **Echte Inhalte.** Content orientiert sich am tatsächlichen Unterricht (Kann-Listen).
- **Ehrlich.** Simulierte Social-Features werden klar als Demo gekennzeichnet. Keine Dark Patterns.

---

## 2. Scope

### Phase 1 – dieser Auftrag
- Single-File-Web-App, mobile-first, offline, Daten nur in `localStorage`
- Lernpfad, Lektionen, 8 Fragetypen, Spaced Repetition, Fehlerkiste
- Gamification: XP, Tagesziel, Streak inkl. Streak-Freeze, Badges, Mastery, **Demo-Liga**
- Klausur-Simulation mit Timer und Notenschlüssel
- Kann-Liste mit Selbsteinschätzung
- Erinnerungen über Kalender-Export (.ics) + In-App-Notification
- Profil/Statistik, Einstellungen, Export/Import/Reset
- Content-Validator und Build-Pipeline

### Nicht in Phase 1
- Backend, Login, Sync zwischen Geräten
- Echte Multiplayer-Ligen
- Web Push bei geschlossener App
- KI-Aufrufe (nur das Interface + lokale Fallback-Implementierung)
- App-Store-Veröffentlichung
- Sounds

Phase 2/3: siehe Abschnitte 10 und 11.

---

## 3. Core Loop

```
App öffnen
  → Home: 🔥 Streak · XP heute / Tagesziel · fällige Wiederholungen · Klausur-Countdown
  → „Weiterlernen“ → Lektion (≈10 Fragen, Sofort-Feedback)
  → Ergebnis: XP, Streak +1, Liga-Rang, ggf. Badge
  → optional: Fehlerkiste / weitere Lektion / Klausur-Simulation
  → nächster Tag: Erinnerung zur gewählten Uhrzeit
```

---

## 4. Features (Phase 1)

### 4.1 Onboarding (max. 4 Screens, überspringbar)
1. Willkommen + Nickname (kein Klarname nötig, Hinweis darauf)
2. Tagesziel wählen: **Chill 30 XP · Solide 60 XP · Ehrgeizig 100 XP · Prüfungsmodus 150 XP**
3. Optional: Klausurdatum für LF14.2 (Datepicker)
4. Erinnerungszeit (Default 18:00) + Button „Erinnerung in Kalender eintragen“ (siehe 4.9)

### 4.2 Home & Lernpfad
- Kopfzeile: Streak 🔥, XP heute als Fortschrittsring zum Tagesziel, Liga-Badge.
- Optionaler **Klausur-Countdown:** „Noch 23 Tage bis LF14.2“ + empfohlenes Tagespensum = (ungesehene + schwache Fragen) / verbleibende Tage, gerundet auf Lektionen.
- **Lernpfad** als vertikale Liste der Themen einer Einheit (Reihenfolge = `topic.order`), je Thema: Icon, Titel, Mastery-Ring, Ampel (siehe 4.8).
- Alle Themen sind freigeschaltet (Klausurvorbereitung braucht Freiheit); der Button „Weiterlernen“ folgt aber dem Pfad.
- Bottom-Navigation: **Lernen · Fehlerkiste · Klausur · Liga · Profil**.

### 4.3 Lektion & Fragetypen

**Ablauf Lernmodus:** Frage → Antwort geben → „Prüfen“ → Feedback-Sheet von unten (grün/rot), korrekte Lösung, `explanation`, `sourceRef`, ggf. Hinweis „Ergänzung – mit Unterricht abgleichen“ bei `supplemented: true` oder vorhandener `note` → „Weiter“.
Falsch beantwortete Fragen kommen **einmal erneut am Ende derselben Lektion** (ohne XP).

| Typ | UI | Richtig, wenn | Klausurpunkte (Default) |
|---|---|---|---|
| `single` | Antwortkarten, eine Auswahl (Optionen mischen) | Index stimmt | 2 |
| `multi` | Mehrfachauswahl, Hinweis „Mehrere Antworten richtig“ | Auswahl = Lösungsmenge | 3; Teilpunkte: max(0, richtige − falsche Auswahlen) / Anzahl richtige × 3 |
| `truefalse` | Zwei große Buttons „Stimmt“ / „Stimmt nicht“ | Wert stimmt | 1 |
| `categorize` | Items als Chips; Tap auf Item → Tap auf Kategorie (kein Drag&Drop-Zwang). Items mischen | alle Items korrekt | 1 je Item |
| `order` | Liste gemischt, Sortieren über ↑/↓-Buttons (Drag optional) | Reihenfolge identisch | 3; Teilpunkte: Anteil korrekt platzierter Items |
| `cloze` | Text mit Lücken + Wortbank (Lösungen + `distractors` gemischt); Tap Lücke → Tap Wort | alle Lücken korrekt | 1 je Lücke |
| `numeric` | Zahlenfeld (`inputmode="decimal"`), Einheit rechts daneben | \|Eingabe − answer\| ≤ tolerance | 3 |
| `open` | Textarea → „Musterlösung anzeigen“ → Selbstbewertung je Rubrik-Kriterium (Checkboxen) | ≥ 60 % der Rubrikpunkte | Summe der Rubrikpunkte |

**Context-Block:** Hat eine Frage `context`, wird er über dem Prompt angezeigt (`text` als Absatz, `table` als scrollbare Tabelle).

**Zahleneingabe parsen (`engine/numbers.js`, mit Tests):**
- Komma vorhanden → Komma = Dezimaltrenner, Punkte entfernen (`57.380,5` → 57380.5)
- Kein Komma, Muster `^\d{1,3}(\.\d{3})+$` → Punkte sind Tausendertrenner (`57.380` → 57380)
- Sonst Punkt = Dezimaltrenner (`40.43` → 40.43)
- Leerzeichen, `€`, `%` ignorieren; ungültig → Hinweis, kein Fehlversuch

**Freitext (`open`) in Phase 1:** Nutzer schreibt Antwort → Musterlösung + Rubrik erscheinen → Nutzer hakt erfüllte Kriterien ab. Zusätzlich ein dezenter Hinweis „Du hast 4 von 6 Schlüsselbegriffen verwendet“ (case-insensitive Teilstring-Match auf `keywords`) – **nur Hinweis, keine Bewertung.** Die Bewertung läuft über `AiProvider` (Abschnitt 5), in Phase 1 = Selbstbewertung.

**Tastatur (Desktop):** `1–9` wählt Optionen, `Enter` = Prüfen/Weiter.

### 4.4 Spaced Repetition (Leitner)

Jede Frage hat pro Nutzer einen Kartenzustand (siehe Abschnitt 8).

- Boxen 0 (neu) bis 5. Intervalle nach richtiger Antwort: **Box 1 → 1 Tag · Box 2 → 3 · Box 3 → 7 · Box 4 → 16 · Box 5 → 35 Tage**
- Richtig → Box + 1 (max. 5), `due` = heute + Intervall der neuen Box
- Falsch → Box 1, `due` = heute, Flag `inMistakeBox = true`
- „Gemeistert“ = Box ≥ 4
- Bei `open`: richtig = ≥ 60 % der Rubrikpunkte

**Session-Builder (`engine/session.js`, reine Funktion mit injizierbarer Uhr):**
1. Bis zu 4 fällige Wiederholungen (am längsten überfällig zuerst)
2. Auffüllen mit neuen Fragen aus dem aktuellen Pfad-Thema (in Content-Reihenfolge), dann aus dem nächsten Thema
3. Sind keine neuen Fragen mehr da → weitere Wiederholungen → dann „Festigen“: niedrigste Box, älteste zuerst
4. Max. 1 `open`-Frage pro Lektion, Standardlänge 10 Fragen
5. Weich vermeiden: mehr als 3 Fragen desselben Typs hintereinander
6. Variante „Thema üben“: gleiche Logik, aber auf ein Thema bzw. eine Kann-Liste-Zeile beschränkt

### 4.5 Fehlerkiste
- Liste aller Fragen mit `inMistakeBox = true`, gruppiert nach Thema
- „Fehler üben“ startet eine Session nur aus diesen Fragen
- Eine Frage verlässt die Fehlerkiste nach **2 aufeinanderfolgenden richtigen Antworten**
- Leerer Zustand: positive Message („Fehlerkiste leer. Läuft.“)

### 4.6 Klausur-Simulation
- Konfiguration aus `unit.exam`: Anzahl Fragen, Dauer, Themengewichtung, max. `open`-Fragen.
- Ziehung: Fragen proportional zu `topicWeights` zufällig, jede Frage max. einmal.
- Während der Simulation **kein Feedback**, Navigation vor/zurück, Fragen markierbar, Timer sichtbar, Auto-Abgabe bei 0:00, Warnung bei 5 Min Restzeit.
- Nach Abgabe: Selbstbewertung der `open`-Fragen (Rubrik), dann Ergebnis.
- Ergebnis: Punkte, Prozent, Note nach Notenschlüssel, Auswertung pro Thema, Liste der Fehler (Tap → Erklärung). Alle falschen Fragen → Fehlerkiste + Box 1.
- Notenschlüssel als Konfiguration (Default IHK-Schlüssel; Berufsschulen nutzen evtl. einen eigenen → konfigurierbar halten):

| Prozent | Note |
|---|---|
| 92–100 | 1 sehr gut |
| 81–<92 | 2 gut |
| 67–<81 | 3 befriedigend |
| 50–<67 | 4 ausreichend |
| 30–<50 | 5 mangelhaft |
| 0–<30 | 6 ungenügend |

- Verlauf aller Versuche (Datum, Note, Dauer) im Profil.
- XP: `round(prozent / 2)` + 10 Bonus bei ≥ 50 %.

### 4.7 Kann-Liste
Die Berufsschule arbeitet mit Kann-Listen („Ich kann …“) und Selbsteinschätzung. Die App übernimmt das:
- Pro Thema die `canDo`-Einträge aus dem Content.
- Je Eintrag: Selbsteinschätzung (**sehr sicher · ziemlich sicher · unsicher · sehr unsicher**) + automatische Mastery aus den verknüpften `questionIds`.
- Auffälligkeit, wenn Selbsteinschätzung und Mastery stark auseinanderliegen („Du fühlst dich sicher, aber 3 von 5 Fragen sitzen noch nicht.“).
- Button „Jetzt üben“ → Session nur aus den verknüpften Fragen.

### 4.8 Gamification

**XP**
| Aktion | XP |
|---|---|
| Richtig beim ersten Versuch | 10 (Schwierigkeit 3: 15) |
| Teilweise richtig (`categorize`, `cloze`, `order`, `multi`) | anteilig, gerundet |
| `open` | Rubrik-Prozent × 20, gerundet |
| Richtig in der Fehlerkiste | 5 |
| Lektion abgeschlossen | +10 |
| Perfekte Lektion (alles beim ersten Versuch) | +10 |
| Wiederholung am Lektionsende | 0 |

**Tagesziel:** wie im Onboarding gewählt, jederzeit änderbar. Ring auf Home, kleine Animation bei Erreichen.

**Streak**
- Ein Tag zählt, wenn **mindestens eine Lektion** (oder Fehlerkiste-Session, oder Klausur-Simulation) abgeschlossen wurde. Das Tagesziel ist davon unabhängig.
- Tagesgrenze: 00:00 **lokale Zeit**. Datumsangaben als `YYYY-MM-DD` in lokaler Zeit speichern (nie UTC-Strings aus `toISOString()` für Kalendertage verwenden).
- Verpasster Tag → automatisch Streak-Freeze verbrauchen, falls vorhanden, sonst Streak = 0.
- Freeze: +1 pro 7 Tage Streak, max. 2 auf Lager.
- `longest` mitführen. Tests müssen Mitternacht, Zeitumstellung (DST) und mehrere verpasste Tage abdecken.

**Demo-Liga (Phase 1)**
- Wöchentliche Liga, Woche = Montag 00:00 bis Sonntag 23:59 lokal, `weekId` im ISO-Format `2026-W41`.
- 20 Teilnehmende: Nutzer + 19 simulierte Gegner mit deterministischem Seed (`weekId` + Tier), plausiblen XP-Kurven über die Woche (inkl. inaktiver Gegner) und lustigen Logistik-Nicknames (z. B. „Disponentin Dana“, „ZollZauberer“, „PalettenPaul“).
- **Gut sichtbar gekennzeichnet:** Banner „Demo-Liga: Gegner sind simuliert. Echte Ligen mit deiner Klasse kommen in Phase 2.“
- Wochenende: Top 5 steigen auf, letzte 5 steigen ab (nicht unter Tier 1 / über Tier 7). Ergebnis-Screen beim ersten Öffnen der neuen Woche.
- Ligastufen (Logistik-Theme): **1 Palette · 2 Gitterbox · 3 Wechselbrücke · 4 Sattelauflieger · 5 20'-Container · 6 40'-High-Cube · 7 Mega-Carrier**
- Gegner-Stärke so tunen, dass aktive Nutzer (Tagesziel an 5 von 7 Tagen) in niedrigen Tiers meist aufsteigen und ab Tier 5 kämpfen müssen. Die Simulation liegt in `engine/league.js` und wird in Phase 2 durch echte Daten ersetzt.

**Mastery & Ampel pro Thema:** Anteil gemeisterter Fragen (Box ≥ 4). **Rot < 40 % · Gelb 40–79 % · Grün ≥ 80 % („Klausurbereit“).**

**Badges (Startset):** Erste Lektion · 3-Tage-Streak · 7-Tage-Streak · 30-Tage-Streak · Perfekte Lektion · Thema gemeistert · Erste Klausur-Simulation · Klausur ≥ Note 2 · Fehlerkiste geleert · Nachtschicht (Lektion nach 22 Uhr) · Frühschicht (vor 7 Uhr). Badge-Definitionen datengetrieben in `engine/badges.js`.

### 4.9 Erinnerungen
Ehrliche Ausgangslage: Eine reine HTML-Datei kann **keine zuverlässigen Push-Benachrichtigungen bei geschlossener App** senden. Phase 1 löst das so:

1. **Kalender-Erinnerung (Hauptweg):** Button erzeugt eine `.ics`-Datei (`engine/ics.js`) mit täglich wiederholtem Termin zur Erinnerungszeit, `RRULE:FREQ=DAILY`, `VALARM` mit `TRIGGER:PT0M`, Dauer 10 Min, Titel z. B. „📦 5 Minuten Lernfracht“, Beschreibung mit Link zur App (falls gehostet; URL in Settings hinterlegbar). Download via Blob. Funktioniert in Google Kalender, Apple Kalender und Outlook.
2. **In-App-Notification:** Wenn Berechtigung erteilt und die App (Tab) offen ist, zur Erinnerungszeit eine Notification, falls das Tagesziel noch nicht erreicht ist. In den Settings klar beschriften: „funktioniert nur, solange die App geöffnet ist“.
3. Phase 2: echte Web-Push-Notifications (Abschnitt 10).

### 4.10 Profil & Statistik
- Streak-Kalender (Heatmap der letzten 12 Wochen)
- XP pro Tag (letzte 14 Tage, simples SVG-Balkendiagramm, keine Chart-Library)
- Mastery pro Thema, Klausur-Verlauf, Badges
- Gesamtzahlen: beantwortete Fragen, Trefferquote, Lernminuten (aus Session-Dauer)

### 4.11 Einstellungen & Datenhoheit
Nickname · Tagesziel · Erinnerungszeit + .ics neu erzeugen · App-URL (für .ics-Link) · Klausurdaten je Einheit · Theme (Dunkel [Default] / Hell / System) · Haptik an/aus · **Export** (JSON-Download) · **Import** (Datei wählen, validieren, Vorschau, bestätigen) · **Reset** (doppelte Bestätigung) · Infoseite „Über & Datenschutz“ (Daten bleiben auf dem Gerät).

---

## 5. KI-Schicht

### 5.1 In Phase 1 umsetzen: nur das Interface
```js
/**
 * @typedef {Object} GradeResult
 * @property {number} points
 * @property {number} maxPoints
 * @property {{criterion: string, met: boolean, comment?: string}[]} criteria
 * @property {string} feedback
 * @property {'self'|'ai'} source
 */

/**
 * @typedef {Object} AiProvider
 * @property {(question: object, answerText: string) => Promise<GradeResult>} gradeOpenAnswer
 * @property {(question: object, userAnswer: unknown) => Promise<string|null>} explainMistake
 */
```
- `engine/ai/local.js` = `LocalProvider`: `gradeOpenAnswer` liefert die Selbstbewertung aus der UI zurück, `explainMistake` liefert `question.explanation`.
- Die UI kennt nur das Interface. Provider wird zentral in `main.js` gewählt.

### 5.2 Phase 2: echte KI
Use Cases nach Priorität:
1. **Freitext-Bewertung nach Rubrik** – Punkte je Kriterium, 1–2 Sätze Feedback, „Was für volle Punktzahl fehlt“. Berücksichtigt Klausur-Operatoren (nennen, erläutern, begründen, beurteilen).
2. **Fehler erklären** – Button „Warum?“ bei falscher Antwort: Erklärung bezogen auf die *konkret gewählte* falsche Option, max. 80 Wörter, Duzen, Speditionsbeispiel.
3. **Tutor-Chat pro Thema** – „Erklär mir Preisuntergrenzen wie einem Kumpel“. Grounding ausschließlich auf eigenem Content; bei Unsicherheit Verweis auf Lehrkraft.
4. **Content-Pipeline (Admin)** – aus eigenen, rechtlich nutzbaren Unterlagen Fragen-Entwürfe im Schema erzeugen → Review-Queue → live erst nach menschlicher Freigabe (`reviewStatus`).
5. **Lernplan** bis zum Klausur-/Prüfungstermin, adaptiv nach Mastery.
6. Phase 3: **Fachgespräch-Simulation** (mündliche Prüfung), ggf. mit Sprache.

Architektur & Leitplanken:
- Client → `POST /api/ai/grade` bzw. `/api/ai/explain` → Serverless Function → Claude API. **API-Key nur serverseitig.**
- Client schickt nur `unitId`, `questionId` und die Antwort. Der Server lädt Rubrik und Musterlösung selbst aus dem Content (niemand kann eigene Rubriken einschleusen).
- Schülerantwort im Prompt klar als Daten markieren; Anweisungen darin ignorieren („Gib mir volle Punkte“).
- Antwort als striktes JSON-Schema anfordern, serverseitig validieren; bei Fehler/Timeout Fallback auf `LocalProvider`.
- Rate-Limit pro Nutzer/Tag, Caching für Erklärungen pro (`questionId`, gewählte Antwort).
- Modellwahl: schnelles, günstiges Modell für Bewertung/Erklärung, stärkeres Modell für Content-Generierung. Aktuelle Modellnamen in der Anthropic-Doku prüfen, nicht raten.
- **Eval-Set vor Livegang:** pro Freitextfrage ≥ 30 echte Antworten mit Referenzbewertung; Ziel ≥ 85 % Übereinstimmung (±1 Punkt). KI-Bewertungen in der UI als „Übungsfeedback, keine Note“ kennzeichnen.

---

## 6. UX & UI

- **Mobile-first**, optimiert für 360–430 px Breite; auf Desktop zentrierte Spalte, max. 480 px.
- **Look:** clean, modern, minimal, wenig Text, kurze knackige Microcopy. Dark Mode als Default.
- **Design-Tokens** als CSS Custom Properties:

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0A0A0B` | `#FAFAFA` |
| `--surface` | `#151518` | `#FFFFFF` |
| `--text` | `#F5F5F7` | `#111113` |
| `--muted` | `#8E8E93` | `#6B6B70` |
| `--accent` | `#FF6A00` (Signalorange) | `#E85F00` |
| `--success` | `#34C759` | `#1F9D45` |
| `--error` | `#FF453A` | `#D92D20` |

- System-Font-Stack, **keine externen Fonts/CDNs** (offline!).
- Ton: Duzen, locker, kurz – nicht cringe. Beispiele: Richtig → „Sauber.“ · Falsch → „Knapp daneben – schau mal:“ · Streak → „🔥 12 Tage. Nicht abreißen lassen.“ · Lektion fertig → „Ladung gesichert. +70 XP“
- Feedback-Sheet slidet von unten (grün/rot), Buttons min. 44 px hoch, Daumenzone unten.
- Animationen dezent (150–250 ms), Lektion-geschafft-Animation in CSS (z. B. stapelnde Pakete). `prefers-reduced-motion` respektieren.
- Haptik via `navigator.vibrate` (nur wo verfügbar, abschaltbar).
- Barrierefreiheit: Kontrast WCAG AA, `aria-live` für Feedback, Fokus-Reihenfolge, Screenreader-Labels für Icon-Buttons.
- Leere Zustände und Fehlerzustände für jeden Screen gestalten.

**Screens:** Onboarding · Home/Lernpfad · Lektion · Lektions-Ergebnis · Fehlerkiste · Klausur (Start, Durchlauf, Freitext-Bewertung, Ergebnis) · Liga · Profil · Kann-Liste · Einstellungen · Debug (`#/debug/questions`, nur mit `?debug=1`).

---

## 7. Content-Schema

Eine Datei pro Lerneinheit: `content/<unit-id>.json`. Globale Frage-ID = `${unit.id}/${question.id}` (z. B. `lf14-2/abc-05`). **IDs nie ändern** – Lernfortschritt hängt daran.

### 7.1 Einheit
```jsonc
{
  "schemaVersion": 1,
  "id": "lf14-2",
  "lernfeld": { "id": "LF14", "title": "Marketingmaßnahmen entwickeln und durchführen" },
  "title": "LF14.2 – …",
  "description": "…",
  "reviewStatus": "draft",            // draft | reviewed
  "source": { "type": "…", "note": "…" },
  "exam": {
    "title": "Klausur-Simulation LF14.2",
    "questionCount": 20,
    "durationMinutes": 45,
    "maxOpenQuestions": 2,
    "topicWeights": { "abc": 3, "verkauf": 2 }
  },
  "topics": [
    {
      "id": "abc", "title": "Kunden-ABC-Analyse", "order": 1, "icon": "📊",
      "canDo": [ { "id": "abc.c1", "text": "Ich kann …", "questionIds": ["abc-01"] } ]
    }
  ],
  "questions": [ /* siehe 7.2 */ ]
}
```

### 7.2 Frage – gemeinsame Felder
| Feld | Pflicht | Beschreibung |
|---|---|---|
| `id` | ✔ | eindeutig innerhalb der Einheit |
| `topic` | ✔ | verweist auf `topics[].id` |
| `type` | ✔ | `single` · `multi` · `truefalse` · `categorize` · `order` · `cloze` · `numeric` · `open` |
| `difficulty` | ✔ | 1–3 |
| `prompt` | ✔ | Fragetext |
| `context` | – | `{ text?: string, table?: { headers: string[], rows: string[][] } }` |
| `explanation` | ✔ | kurze Erklärung, Duzen |
| `sourceRef` | ✔ | Fundstelle (z. B. „PDF S. 41“) |
| `supplemented` | – | `true`, wenn Inhalt über das Skript hinausgeht |
| `note` | – | Hinweis für Review, wird klein angezeigt |
| `examPoints` | – | überschreibt die Default-Punkte aus 4.3 |

### 7.3 Typ-spezifische Felder
| Typ | Felder |
|---|---|
| `single` | `options: string[]`, `answer: number` |
| `multi` | `options: string[]`, `answer: number[]` |
| `truefalse` | `answer: boolean` |
| `categorize` | `categories: string[]`, `items: { text, category: number }[]` |
| `order` | `items: string[]` (in korrekter Reihenfolge, UI mischt) |
| `cloze` | `text` mit Platzhaltern `{0}`, `{1}` …, `gaps: { answer, alternatives?: string[] }[]`, `distractors: string[]` |
| `numeric` | `answer: number`, `tolerance: number`, `unit?: string`, `decimals?: number` |
| `open` | `modelAnswer: string`, `rubric: { criterion, points }[]`, `keywords: string[]` |

### 7.4 Validator (`npm run validate`, Exit-Code ≠ 0 bei Fehlern)
- Schema-Version bekannt, alle Pflichtfelder vorhanden, keine unbekannten Typen
- IDs eindeutig; `topic` existiert; jedes Thema hat ≥ 1 Frage
- `single`: Index im Bereich · `multi`: ≥ 1 Lösung, alle Indizes im Bereich, ≥ 1 falsche Option
- `categorize`: jede Kategorie wird mindestens einmal benutzt
- `order`: ≥ 3 Items, keine Duplikate
- `cloze`: Platzhalter `{n}` stimmen exakt mit `gaps` überein; keine Distractor-Duplikate zu Lösungen
- `numeric`: `tolerance ≥ 0`
- `open`: Rubrikpunkte > 0, `modelAnswer` nicht leer
- `canDo.questionIds` existieren; `exam.topicWeights` verweisen auf existierende Themen; `exam.questionCount` ≤ Anzahl Fragen
- Warnung (kein Fehler), wenn eine Frage in keiner `canDo`-Zeile verlinkt ist

### 7.5 Regeln für neue Fragen
- Eigene Formulierungen, keine Textpassagen aus Skripten oder Büchern kopieren (Abschnitt 13).
- Plausible Distraktoren – keine offensichtlichen Quatsch-Antworten (max. eine „Spaß-Option“ pro Thema).
- Jede Erklärung sagt, *warum* – nicht nur *was* richtig ist.
- Speditionsbeispiele bevorzugen, keine echten Firmendaten aus dem Ausbildungsbetrieb.
- Rechenaufgaben: Lösung im Content nachrechnen (Validator-Testfall oder Kommentar).

---

## 8. Datenmodell & Persistenz

Ein Storage-Key: `lernfracht.state.v1`, Inhalt ein JSON-Objekt. Zugriff ausschließlich über `engine/storage.js` (Debounce beim Schreiben, Migrationen beim Laden).

```jsonc
{
  "version": 1,
  "profile": {
    "nickname": "jarek",
    "dailyGoalXp": 60,
    "reminderTime": "18:00",
    "appUrl": "",
    "examDates": { "lf14-2": "2026-11-20" },
    "theme": "dark",
    "haptics": true,
    "createdAt": "2026-10-07"
  },
  "cards": {
    "lf14-2/abc-05": {
      "box": 2, "due": "2026-10-10", "seen": 3, "correct": 2,
      "streakCorrect": 1, "lastAnswered": "2026-10-07", "inMistakeBox": false
    }
  },
  "days": { "2026-10-07": { "xp": 70, "lessons": 2, "minutes": 9 } },
  "streak": { "current": 5, "longest": 9, "lastActiveDate": "2026-10-07", "freezes": 1 },
  "league": { "weekId": "2026-W41", "tier": 2, "seed": 4711, "history": [ { "weekId": "2026-W40", "tier": 1, "rank": 3, "result": "up" } ] },
  "exams": [ { "unitId": "lf14-2", "date": "2026-10-07", "points": 41, "maxPoints": 55, "percent": 74.5, "grade": 3, "durationSec": 2210 } ],
  "selfAssessment": { "lf14-2/abc.c1": "ziemlich_sicher" },
  "badges": { "first_lesson": "2026-10-01" },
  "events": []
}
```

- `events`: Append-only-Log der Antworten (`{ t, qid, correct, points, ms }`), in Phase 1 auf die letzten 2.000 Einträge begrenzt. **Zweck:** In Phase 2 wird daraus serverseitig XP neu berechnet (Sync + Anti-Cheat).
- Wochen-XP der Liga wird aus `days` berechnet, nicht separat gespeichert.
- Korruptes JSON beim Laden → Rohdaten unter `lernfracht.state.backup.<timestamp>` sichern, frischer Zustand, Hinweis an Nutzer.
- Import: Version prüfen, migrieren, Vorschau („90 Karten, Streak 5, …“), erst nach Bestätigung überschreiben.

---

## 9. Technik & Architektur

- **Vanilla JS (ES2020+), HTML, CSS.** Kein Framework. Kleiner Hash-Router (`#/home`, `#/lesson`, `#/exam`, …). Einfacher Store mit `subscribe()`.
- **Strikte Trennung:** `src/engine/` = reine Logik ohne DOM, vollständig testbar, Uhr injizierbar (`now()` als Parameter; kein direktes `Date.now()` in der Engine). `src/ui/` = Rendering und Events.
- **Build:** Node ≥ 20. Einzige Dev-Dependency: `esbuild`. `scripts/build.mjs` bündelt `src/main.js` als IIFE und inlined CSS, JS und **alle** `content/*.json` (als `<script type="application/json" id="content-<unit>">`) in `dist/lernfracht.html`. Muss per Doppelklick (`file://`) **und** gehostet funktionieren. Zur Laufzeit keine Netzwerk-Requests.
- **Scripts:** `npm run build` · `npm run dev` (Watch-Build) · `npm test` (`node --test`) · `npm run validate`
- **Tests (Pflicht):** numbers, grading (alle Typen inkl. Teilpunkte), scheduler, session builder, xp, streak (Mitternacht, DST, verpasste Tage, Freeze), league (deterministisch, Auf-/Abstieg), exam (Ziehung nach Gewichtung, Scoring, Notenschlüssel), ics (gültiges Format, CRLF, Escaping), storage/migrations, badges. UI wird manuell getestet (Checkliste pro Meilenstein).
- **Budget:** `dist/lernfracht.html` < 400 KB, erste Interaktion < 1 s auf einem Mittelklasse-Handy.
- **Hosting Phase 1:** statische Datei, z. B. Netlify oder GitHub Pages (für Nutzung am Handy empfohlen). README erklärt beides.

```
lernfracht/
├─ SPEC.md
├─ CLAUDE.md                 # Kurzregeln aus Abschnitt 15
├─ README.md
├─ package.json
├─ content/
│  └─ lf14-2.json
├─ src/
│  ├─ index.html             # Template mit Platzhaltern für CSS/JS/Content
│  ├─ styles.css
│  ├─ main.js                # Bootstrap, Router, Provider-Wahl
│  ├─ engine/
│  │  ├─ content.js  dates.js  numbers.js  grading.js
│  │  ├─ scheduler.js  session.js  xp.js  streak.js
│  │  ├─ league.js  exam.js  badges.js  ics.js
│  │  ├─ storage.js  migrations.js
│  │  └─ ai/ provider.js  local.js
│  └─ ui/
│     ├─ components/         # Button, Sheet, ProgressRing, QuestionRenderer je Typ …
│     └─ screens/            # onboarding, home, lesson, result, mistakes, exam, league, profile, cando, settings, debug
├─ scripts/
│  ├─ build.mjs
│  └─ validate-content.mjs
├─ tests/
│  └─ *.test.mjs
└─ dist/
   └─ lernfracht.html
```

---

## 10. Phase 2 – Backend & echte Social Features (Ausblick, nicht bauen)

- **Stack-Vorschlag:** statisches Frontend + Serverless Functions (z. B. Netlify Functions) + Postgres mit Auth und Row-Level-Security (z. B. Supabase, EU-Region).
- **Accounts:** Magic-Link oder Klassencode + Nickname. Klarnamen nicht nötig.
- **Echte Ligen:** Gruppen à 20–30 pro Tier, wöchentlich. Zusätzlich **Klassen-Liga** (Berufsschulklasse per Code) und **Betriebs-Liga** (Azubis eines Ausbildungsbetriebs).
- **Sync:** Lokaler State bleibt offline Source of Truth; Sync über das `events`-Log, XP wird serverseitig neu berechnet (Anti-Cheat: Plausibilitätsgrenzen, z. B. max. XP pro Stunde).
- **Push:** PWA (Manifest + Service Worker) + Web Push (VAPID) + Cron. Hinweis: auf iOS erst ab 16.4 und nur nach „Zum Home-Bildschirm hinzufügen“.
- **KI-Proxy** gemäß Abschnitt 5.2.
- **Store-Release:** erst PWA; später Wrapper (z. B. Capacitor) für App Store / Play Store.

## 11. Phase 3 – Ausbau & Business-Ideen (Ausblick)

- **Content:** alle Lernfelder des Ausbildungsberufs, dann Prüfungsbereiche der Abschlussprüfung (Struktur vorher mit der aktuellen Ausbildungsordnung abgleichen), dann weitere Berufe (z. B. Fachkraft für Lagerlogistik, Kaufleute für Büromanagement).
- **Rollen:** Ausbilder-Dashboard (Lernstand der eigenen Azubis, nur mit Opt-in), Lehrkräfte-Modus (Klassen anlegen, Fragen einreichen, Klausurtermine setzen).
- **Monetarisierung (Optionen):** Freemium (Basis gratis; KI-Tutor + unbegrenzte Simulationen im Pro-Abo) · B2B-Lizenz pro Azubi/Jahr für Ausbildungsbetriebe · Kooperationen mit Berufsschulen.
- **Wachstum:** Klassen-Liga als viraler Loop (Klassencode teilen), Short-Form-Videos mit Quizfragen aus dem Katalog.

---

## 12. Meilensteine (Phase 1)

Jeder Meilenstein endet mit: Tests grün · Validator grün · Build erzeugt lauffähige `dist/lernfracht.html` · Eintrag in `CHANGELOG.md` · Liste manueller Testschritte.

**M1 – Fundament**
Repo-Struktur, `package.json`-Scripts, Content-Loader, Validator, Storage + Migrationen, Router, leere Screens, Design-Tokens, Theme-Switch.
✅ `npm run validate` besteht für `lf14-2.json` · `dist/lernfracht.html` öffnet offline per `file://` und zeigt die 9 Themen · Tests für Storage/Migrationen.

**M2 – Fragen-Engine**
Alle 8 Fragetypen: Rendering, Bewertung inkl. Teilpunkte, Feedback-Sheet, Context-Block, Zahlenparser, Tastatursteuerung, Debug-Route.
✅ Über `#/debug/questions?debug=1` lassen sich alle 90 Fragen durchklicken · Unit-Tests je Bewertungsfunktion · Zahlenparser-Tests für alle Formate aus 4.3.

**M3 – Lektionen & Spaced Repetition**
Session-Builder, Leitner-Logik, Lektionsablauf inkl. Wiederholung am Ende, Ergebnis-Screen, Fehlerkiste, „Thema üben“.
✅ Test simuliert 14 Tage mit injizierter Uhr und prüft Fälligkeiten, Box-Wechsel und Fehlerkisten-Verhalten.

**M4 – Gamification**
XP, Tagesziel, Streak + Freeze, Badges, Mastery/Ampel, Demo-Liga, Home-Dashboard, Klausur-Countdown.
✅ Streak-Tests (Mitternacht, DST, verpasste Tage mit/ohne Freeze) · Liga deterministisch bei gleichem Seed · Auf-/Abstieg korrekt · Demo-Hinweis sichtbar.

**M5 – Klausur-Simulation & Kann-Liste**
Ziehung nach Gewichtung, Timer mit Auto-Abgabe, Freitext-Selbstbewertung, Notenschlüssel, Verlauf; Kann-Liste mit Selbsteinschätzung, Abweichungs-Hinweis und „Jetzt üben“.
✅ Tests für Ziehung (Gewichte, max. `open`, keine Duplikate), Scoring und Notengrenzen.

**M6 – Erinnerungen, Profil, Einstellungen**
.ics-Export, In-App-Notification, Profil/Statistik (Heatmap, SVG-Balken), Einstellungen, Export/Import/Reset.
✅ .ics besteht Format-Tests (CRLF, Escaping, RRULE, VALARM) und lässt sich manuell in Google/Apple Kalender importieren · Export → Reset → Import stellt identischen Zustand her.

**M7 – Polish**
A11y-Durchgang, `prefers-reduced-motion`, leere Zustände, Microcopy-Durchgang, Performance-Budget, `README.md` (Build, Hosting auf Netlify/GitHub Pages, neue Content-Datei anlegen).
✅ Lighthouse (mobil) Accessibility ≥ 95 · Dateigröße < 400 KB · README von Laien nachvollziehbar.

---

## 13. Rechtliches & Content-Regeln

- **Urheberrecht:** Das Berufsschul-Skript (PDF) gehört der Schule bzw. Lehrkraft und enthält teils Drittquellen. Es kommt **nicht** ins Repo und **nicht** in die App. Die Fragen in `lf14-2.json` sind eigenständig formuliert und verweisen nur mit Seitenzahlen auf das Skript. Vor einer Veröffentlichung über die eigene Klasse hinaus mit der Lehrkraft klären.
- **Firmendaten:** Keine internen Daten aus dem Ausbildungsbetrieb in Content, Beispielen oder Tests.
- **Phase 1:** Keine personenbezogenen Daten verlassen das Gerät. Kein Tracking, keine Analytics, keine externen Requests.
- **Phase 2:** DSGVO (Datenschutzerklärung, Auftragsverarbeitungsverträge mit Hosting- und KI-Anbietern, EU-Hosting wo möglich), Impressum. Nutzer:innen können minderjährig sein → Nicknames statt Klarnamen, Liga-Teilnahme opt-in, in Deutschland eigenständige Einwilligung ab 16, darunter Zustimmung der Erziehungsberechtigten.
- KI-Feedback immer als Übungsfeedback kennzeichnen, nie als offizielle Bewertung.

---

## 14. Offene Fragen (für Jarek)

1. Name und Branding final? („Lernfracht“ ist Arbeitstitel.)
2. Welchen Notenschlüssel nutzt eure Berufsschule für Klausuren?
3. Gibt es Musterlösungen der Lehrkraft, um `reviewStatus` auf `reviewed` zu setzen (v. a. Fragen mit `supplemented` oder `note`)?
4. Welche Klausur kommt als Nächstes → Content-Priorität?
5. Phase 2: reicht eine PWA oder soll es in die Stores?
6. Wer pflegt Content langfristig (du, Mitschüler:innen, Lehrkräfte, KI + Review)?

---

## 15. Arbeitsregeln für Claude Code

1. Lies diese SPEC vollständig. Lege `CLAUDE.md` mit den Kernregeln dieses Abschnitts an.
2. Ein Meilenstein pro Durchgang. Vor jeder Scope-Erweiterung nachfragen.
3. Engine ohne DOM, Uhr immer injizierbar, reine Funktionen bevorzugen.
4. Keine neuen Dependencies außer `esbuild` ohne Rückfrage.
5. Content nie im Code hardcoden. Content-Änderungen nur in `content/*.json`, danach `npm run validate`.
6. UI-Texte Deutsch, Code und Identifier Englisch, JSDoc-Typen für öffentliche Funktionen.
7. Bei Unklarheiten: sinnvolle Annahme treffen, im Code mit `// ASSUMPTION:` markieren und in der Meilenstein-Zusammenfassung auflisten.
8. Nach jedem Meilenstein: `npm test && npm run validate && npm run build` grün, `CHANGELOG.md` ergänzen, manuelle Testschritte nennen.
