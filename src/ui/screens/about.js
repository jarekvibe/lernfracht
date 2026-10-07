import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';

/**
 * Über & Datenschutz (SPEC §4.11, §13).
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ version, catalog }) {
  const drafts = catalog.units.filter((u) => u.reviewStatus === 'draft').map((u) => u.title.split(' – ')[0]);
  return [
    screenHeader({ title: 'Über & Datenschutz', back: { href: '#/settings', label: 'Zurück zu den Einstellungen' } }),
    h(
      'section',
      { class: 'card prose' },
      h('h2', null, 'Was ist Lernfracht?'),
      h('p', null, 'Ein Prüfungstrainer für Azubis – Kaufleute für Spedition und Logistikdienstleistung. Kurze Lektionen, Wiederholung nach Plan, Klausur-Simulation.'),
    ),
    h(
      'section',
      { class: 'card prose' },
      h('h2', null, 'Deine Daten'),
      h(
        'ul',
        null,
        h('li', null, 'Alles bleibt auf diesem Gerät, im Speicher deines Browsers. Es gibt kein Konto und keinen Server.'),
        h('li', null, 'Kein Tracking, keine Analyse, keine Werbung. Die App lädt nichts aus dem Internet nach.'),
        h('li', null, 'Löschst du die Browserdaten, ist dein Fortschritt weg. Sichern kannst du ihn unter Einstellungen → Sicherung exportieren.'),
        h('li', null, 'Dein Spitzname erscheint nur in deiner eigenen Demo-Liga. Die Gegner dort sind simuliert.'),
      ),
    ),
    h(
      'section',
      { class: 'card prose' },
      h('h2', null, 'Zu den Inhalten'),
      h('p', null, 'Die Fragen sind eigenständig formuliert und verweisen mit Seitenzahlen auf das Unterrichtsskript. Das Skript selbst ist nicht enthalten.'),
      drafts.length > 0 && h('p', null, `Noch im Entwurf und nicht von einer Lehrkraft geprüft: ${drafts.join(', ')}. Fragen mit dem Hinweis „Ergänzung“ gehen über das Skript hinaus – mit dem Unterricht abgleichen.`),
    ),
    h('p', { class: 'muted small about-version' }, `Lernfracht · Version ${version}`),
  ];
}
