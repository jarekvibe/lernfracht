# Lernfracht

Prüfungstrainer für Azubis – Kaufleute für Spedition und Logistikdienstleistung.
Die App ist **eine einzige HTML-Datei**. Sie läuft komplett offline, und alle Daten bleiben im
Browser auf deinem Gerät.

> **Stand:** Phase 1 ist fertig (Meilensteine M1–M7). Was drin ist, steht in
> [`CHANGELOG.md`](CHANGELOG.md), der Plan in [`SPEC.md`](SPEC.md).

**Inhalt:** [Benutzen](#benutzen) · [Selbst bauen](#selbst-bauen) · [Online stellen](#online-stellen) ·
[Neue Lerneinheit anlegen](#neue-lerneinheit-anlegen) · [Wenn etwas hakt](#wenn-etwas-hakt) ·
[Für Entwickler:innen](#für-entwicklerinnen)

---

## Benutzen

**Online:** https://lernfracht.netlify.app

**Wie eine App auf dem Handy:**
- iPhone/iPad (Safari): Teilen-Symbol → **Zum Home-Bildschirm**
- Android (Chrome): Menü ⋮ → **Zum Startbildschirm hinzufügen**

**Offline als Datei:** `lernfracht.html` herunterladen (siehe [Selbst bauen](#selbst-bauen)) und
per Doppelklick im Browser öffnen. Internet braucht die Datei nie.

**Deine Daten:** Alles bleibt im Speicher deines Browsers. Es gibt kein Konto, keinen Server und kein
Tracking. Löschst du die Browserdaten, ist der Fortschritt weg. Sichern kannst du ihn unter
**Profil → Einstellungen → Sicherung exportieren**.

> **Gut zu wissen:** Jede Adresse hat ihren eigenen Speicher. Die Online-Version, die Datei auf dem
> Laptop und die App auf dem Handy wissen nichts voneinander. Zum Umziehen: am alten Ort
> **Sicherung exportieren**, am neuen Ort **Sicherung importieren**.

---

## Selbst bauen

Damit erzeugst du `dist/lernfracht.html` aus dem Quellcode. Einmal einrichten, dann sind es zwei
Befehle.

1. **Node.js installieren:** auf [nodejs.org](https://nodejs.org) die Version **LTS** herunterladen
   und installieren (Version 20 oder neuer).
2. **Projekt herunterladen:** auf GitHub den grünen Button **Code → Download ZIP**, dann entpacken.
   Wer Git nutzt: `git clone` geht natürlich auch.
3. **Terminal im Projektordner öffnen:**
   - Windows: im Ordner Rechtsklick auf eine freie Stelle → **Im Terminal öffnen**
   - Mac: Rechtsklick auf den Ordner → **Dienste → Neues Terminal beim Ordner**
4. Einmalig eingeben:
   ```bash
   npm install
   ```
5. Bauen:
   ```bash
   npm run build
   ```
   Am Ende steht `✔ dist/lernfracht.html – … KB`.
6. `dist/lernfracht.html` per Doppelklick öffnen. Fertig.

**Ohne Computer (z. B. am iPad):** GitHub baut die Datei bei jeder Änderung automatisch. Dazu im Repo
**Actions** öffnen, dann den neuesten Lauf **CI** antippen. Unten unter **Artifacts** liegt
`lernfracht-html` (ein ZIP mit der fertigen Datei).

---

## Online stellen

Die Datei braucht keinen Server mit Programmen. Jeder Dienst für statische Webseiten reicht.

### Netlify (so läuft es gerade)

Netlify baut die App bei jeder Änderung auf `main` neu. Die Einstellungen stehen schon in
`netlify.toml`.

1. Auf [app.netlify.com](https://app.netlify.com) **Add new project → Import an existing project**.
2. **GitHub** wählen, das Repo auswählen und Netlify den Zugriff erlauben.
3. Build-Einstellungen nicht ändern, Netlify liest sie aus `netlify.toml`. Dann auf **Deploy**.
4. Unter **Project configuration → General → Project name** einen Namen vergeben, zum Beispiel
   `lernfracht` (ergibt `lernfracht.netlify.app`).

> **Privates Repo im Gratis-Tarif:** Netlify baut dann nur, was von Mitgliedern des eigenen
> Netlify-Teams kommt. Sonst steht im Deploy **„Build blocked: Unrecognized Git contributor“**.
> Abhilfe: in Netlify unter **Link Git account** das eigene GitHub-Konto verknüpfen. Hilft das
> nicht, weil Commits von jemand anderem stammen (z. B. von Claude), bleibt nur das Repo öffentlich
> zu machen oder ein Bezahl-Tarif.

### Netlify Drop (ohne Git, am schnellsten)

1. `lernfracht.html` in **`index.html`** umbenennen und in einen leeren Ordner legen.
2. [app.netlify.com/drop](https://app.netlify.com/drop) öffnen und den Ordner ins Fenster ziehen.
3. Nach ein paar Sekunden ist die Seite online. Für Updates die neue Datei genauso hochladen.

### GitHub Pages

Im Gratis-Tarif geht das nur mit einem **öffentlichen** Repo. Das Projekt selbst kann privat bleiben,
veröffentlicht wird nur die fertige Datei.

1. Auf GitHub ein neues, öffentliches Repo anlegen, zum Beispiel `lernfracht-web`.
2. **Add file → Upload files**: `lernfracht.html` hochladen und dabei in **`index.html`**
   umbenennen (oder vorher umbenennen). **Commit changes**.
3. **Settings → Pages**: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** →
   **Save**.
4. Nach 1–2 Minuten ist die App unter `https://<dein-name>.github.io/lernfracht-web/` erreichbar.

### Vor dem Teilen

- Die Seite sagt Suchmaschinen, dass sie nicht aufgenommen werden will (`noindex`). Wer den Link
  hat, kann sie aber öffnen.
- Die Fragen verweisen auf das Unterrichtsskript. **Bevor du den Link über die eigene Klasse hinaus
  teilst, mit der Lehrkraft klären** (SPEC §13). Das Skript selbst gehört nie ins Repo oder in die
  App.

---

## Neue Lerneinheit anlegen

Jede Lerneinheit ist eine JSON-Datei in `content/`. Beim Bauen landen alle Dateien dort automatisch
in der App, eine neue Einheit erscheint dann im Lernpfad.

1. **Vorlage kopieren:** `docs/content-vorlage.json` nach `content/` kopieren und umbenennen. Der
   Dateiname muss zur `id` in der Datei passen: `"id": "lf15-1"` → `content/lf15-1.json`.
2. **Ausfüllen:**
   - **Kopf:** `title`, `lernfeld`, `description`. `reviewStatus` bleibt `"draft"`, bis eine
     Lehrkraft die Fragen geprüft hat.
   - **`topics`:** die Themen der Einheit. Jedes Thema hat eine kurze `id` (z. B. `"zoll"`), einen
     Titel, eine Reihenfolge (`order`) und ein Emoji.
   - **`canDo`:** die „Ich kann …“-Sätze je Thema, mit den IDs der passenden Fragen.
   - **`questions`:** die Fragen. Jede braucht `id`, `topic`, `type`, `difficulty` (1–3),
     `prompt`, `explanation` (sagt, *warum*) und `sourceRef` (z. B. `"Skript S. 12"`).
   - **`exam`:** Länge und Dauer der Klausur-Simulation sowie die Gewichtung der Themen.
3. **Prüfen:**
   ```bash
   npm run validate
   ```
   Der Prüfer sagt auf Deutsch, was fehlt oder nicht passt. Korrigieren, bis
   `0 Fehler` dasteht.
4. **Bauen:** `npm run build` – fertig.

**Fragetypen** (Details in [SPEC §7](SPEC.md#7-content-schema), ein vollständiges Beispiel mit allen
Typen ist `content/lf14-2.json`):

| `type` | Was | Zusätzliche Felder |
|---|---|---|
| `single` | eine richtige Antwort | `options`, `answer` (Index, ab 0) |
| `multi` | mehrere richtige | `options`, `answer` (Liste von Indizes) |
| `truefalse` | stimmt / stimmt nicht | `answer` (`true`/`false`) |
| `categorize` | Begriffe zuordnen | `categories`, `items` (`text`, `category`) |
| `order` | Reihenfolge | `items` in richtiger Reihenfolge (die App mischt) |
| `cloze` | Lückentext | `text` mit `{0}`, `{1}` …, `gaps`, `distractors` |
| `numeric` | Rechenaufgabe | `answer`, `tolerance`, optional `unit`, `decimals` |
| `open` | Freitext | `modelAnswer`, `rubric` (`criterion`, `points`), `keywords` |

**Regeln:**
- **IDs nie ändern.** Der Lernfortschritt hängt an `<einheit>/<frage>`. Neue Fragen bekommen neue
  IDs, gelöschte IDs nicht wiederverwenden.
- Eigene Formulierungen. Nichts aus dem Skript oder aus Büchern abschreiben, nur Seitenzahlen
  angeben.
- Keine echten Daten aus dem Ausbildungsbetrieb, auch nicht in Beispielen.
- Geht eine Frage über das Skript hinaus: `"supplemented": true` setzen.

**Ohne Computer:** Die Datei lässt sich auch direkt auf GitHub bearbeiten (Stift-Symbol). Danach
einen Pull Request anlegen – die CI prüft die Datei automatisch und meldet Fehler.

---

## Wenn etwas hakt

| Problem | Lösung |
|---|---|
| Netlify zeigt einen alten Stand | Unter **Deploys** nachsehen. Steht dort „Unrecognized Git contributor“: siehe [Netlify](#netlify-so-läuft-es-gerade). |
| „Speichern ist in diesem Browser blockiert“ | Privates Surfen oder blockierte Website-Daten. In einem normalen Fenster öffnen. |
| Fortschritt weg nach Umzug aufs Handy | Jede Adresse hat ihren eigenen Speicher – Sicherung exportieren und importieren. |
| Keine Browser-Benachrichtigung am iPhone | Geht nur, wenn die App auf dem Home-Bildschirm liegt. Die Kalender-Erinnerung klappt immer. |
| `npm run build` meldet „erlaubt sind 400 KB“ | Die Datei ist zu groß geworden, meist durch große Inhalte. Bilder weglassen oder Inhalte kürzen. |
| `npm run validate` meldet Fehler | Die Meldung nennt Datei, Frage-ID und Feld. Genau dort korrigieren. |

---

## Für Entwickler:innen

| Befehl | Was passiert |
|---|---|
| `npm run build` | baut `dist/lernfracht.html` (JS, CSS und alle Inhalte in einer Datei); bricht über 400 KB ab |
| `npm run dev` | wie `build`, baut bei jeder Änderung in `src/` oder `content/` neu |
| `npm test` | Unit-Tests (`node --test`) |
| `npm run validate` | prüft alle `content/*.json` gegen das Schema |

```
content/        Lerneinheiten als JSON (Schema: SPEC §7), z. B. lf14-2.json
docs/           Vorlage für neue Lerneinheiten
src/engine/     Logik ohne DOM: Content, Speicher, Wiederholung, XP, Liga, Klausur …
src/ui/         Router, Screens und Komponenten
src/main.js     Start: Inhalte und Zustand laden, alles verdrahten
scripts/        Build und Content-Validator
tests/          Unit-Tests
```

- Arbeitsregeln für Claude Code und Menschen: [`CLAUDE.md`](CLAUDE.md).
- Debug-Ansicht: `dist/lernfracht.html#/debug/questions?debug=1` – alle Fragen durchklicken.
  Tastatur: `1–9` wählt, `Enter` prüft bzw. geht weiter.
- Keine Netzwerk-Requests zur Laufzeit. Die Content-Security-Policy in `src/index.html` erzwingt das,
  ein Test prüft es zusätzlich.
- Barrierefreiheit geprüft mit axe-core (alle Screens, hell und dunkel) und Lighthouse (mobil).
- CI (`.github/workflows/ci.yml`): Tests, Validator und Build auf Node 20 und 22, das Ergebnis hängt
  als Artefakt am Lauf.
