import { h } from '../dom.js';
import { uid } from '../uid.js';
import { icon } from '../components/icon.js';
import { screenHeader } from '../components/screenHeader.js';
import { goalPicker } from './onboarding.js';
import { downloadText } from '../download.js';
import { downloadReminderIcs, effectiveAppUrl, notificationsSupported } from '../reminders.js';
import { exportState, parseImport } from '../../engine/backup.js';
import { todayLocal } from '../../engine/dates.js';
import { createDefaultState } from '../../engine/storage.js';

/** @type {[value: 'dark'|'light'|'system', label: string][]} */
const THEME_OPTIONS = [
  ['dark', 'Dunkel'],
  ['light', 'Hell'],
  ['system', 'System'],
];

/** @param {string} date */
const germanDate = (date) => date.split('-').reverse().join('.');

/**
 * Einstellungen & Datenhoheit (SPEC §4.11).
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render(ctx) {
  const { store, catalog, version, now, navigate } = ctx;
  const profile = store.get().profile;
  /** @param {Partial<import('../../engine/storage.js').Profile>} patch */
  const setProfile = (patch) => store.update((s) => ({ ...s, profile: { ...s.profile, ...patch } }));

  return [
    screenHeader({ title: 'Einstellungen', back: { href: '#/profile', label: 'Zurück zum Profil' } }),
    section('Profil', textField({
      label: 'Spitzname',
      value: profile.nickname,
      maxlength: 24,
      autocomplete: 'nickname',
      help: 'Erscheint nur in deiner Demo-Liga. Kein Klarname nötig.',
      onChange: (v) => setProfile({ nickname: v.trim().slice(0, 24) }),
    })),
    section(
      'Lernen',
      h('p', { class: 'field-label' }, 'Tagesziel'),
      goalPicker(profile.dailyGoalXp, (xp) => setProfile({ dailyGoalXp: xp })),
      catalog.units.map((unit) => {
        const id = uid('exam');
        const input = h('input', { id, class: 'field-input', type: 'date', min: todayLocal(now), value: profile.examDates[unit.id] ?? '' });
        input.addEventListener('change', () => {
          const examDates = { ...store.get().profile.examDates };
          if (input.value) examDates[unit.id] = input.value;
          else delete examDates[unit.id];
          setProfile({ examDates });
        });
        return h('div', { class: 'field mt-12' }, h('label', { for: id, class: 'field-label' }, `Klausurtermin ${unit.title.split(' – ')[0]}`), input, h('p', { class: 'field-help' }, 'Feld leeren, um den Termin zu entfernen.'));
      }),
    ),
    reminderSection(ctx, setProfile),
    section(
      'Darstellung',
      h(
        'fieldset',
        { class: 'segmented' },
        h('legend', { class: 'visually-hidden' }, 'Theme'),
        h(
          'div',
          { class: 'segmented-options' },
          THEME_OPTIONS.map(([value, label]) =>
            h('label', null, h('input', { type: 'radio', name: 'theme', value, checked: value === profile.theme, onChange: () => setProfile({ theme: value }) }), h('span', null, label)),
          ),
        ),
      ),
      h('p', { class: 'field-help mt-8' }, '„System“ folgt der Einstellung deines Geräts.'),
      switchRow('Haptik', 'Kurzes Vibrieren bei richtig und falsch (wo das Gerät es kann).', profile.haptics, (on) => setProfile({ haptics: on })),
    ),
    dataSection(ctx),
    section(
      'Über Lernfracht',
      h('a', { class: 'row-link', href: '#/about' }, h('span', null, 'Über & Datenschutz'), icon('next')),
      h('p', { class: 'field-help mt-8' }, `Version ${version}`),
    ),
  ];

  /**
   * @param {import('../app.js').ScreenContext} c
   * @param {(patch: Partial<import('../../engine/storage.js').Profile>) => void} set
   */
  function reminderSection(c, set) {
    const timeId = uid('time');
    const time = h('input', { id: timeId, class: 'field-input', type: 'time', step: '300', value: profile.reminderTime });
    time.addEventListener('change', () => {
      if (/^\d{2}:\d{2}$/.test(time.value)) set({ reminderTime: time.value });
    });
    const status = h('p', { class: 'field-help', 'aria-live': 'polite' });
    const supported = notificationsSupported();
    const notifyRow = switchRow(
      'Browser-Benachrichtigung',
      'Funktioniert nur, solange die App geöffnet ist. Kommt nur, wenn dein Tagesziel noch offen ist.',
      profile.notify && supported && Notification.permission === 'granted',
      async (on, input) => {
        if (!on) {
          set({ notify: false });
          status.textContent = '';
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          set({ notify: true });
          status.textContent = 'Eingeschaltet.';
        } else {
          input.checked = false;
          set({ notify: false });
          status.textContent = 'Dein Browser hat Benachrichtigungen blockiert. Erlauben kannst du sie in den Browser-Einstellungen.';
        }
      },
      !supported,
    );
    return section(
      'Erinnerung',
      h('div', { class: 'field' }, h('label', { for: timeId, class: 'field-label' }, 'Uhrzeit'), time),
      h(
        'button',
        { type: 'button', class: 'btn mt-12', onClick: () => downloadReminderIcs(store.get(), now, version) },
        'Erinnerung in Kalender eintragen',
      ),
      h('p', { class: 'field-help mt-8' }, 'Lädt eine Kalenderdatei mit einem täglichen 10-Minuten-Termin samt Alarm. Klappt mit Google Kalender, Apple Kalender und Outlook. Neue Uhrzeit? Nochmal eintragen – ersetzt dein Kalender den alten Termin nicht, lösch ihn dort.'),
      textField({
        label: 'App-Adresse für den Kalendertermin',
        value: profile.appUrl,
        type: 'url',
        placeholder: effectiveAppUrl({ appUrl: '' }, window.location) || 'https://…',
        help: 'Leer lassen = aktuelle Adresse, falls die App online läuft.',
        onChange: (v) => set({ appUrl: v.trim() }),
      }),
      notifyRow,
      !supported && h('p', { class: 'field-help' }, 'Dein Browser kann hier keine Benachrichtigungen anzeigen. Auf dem iPhone geht das nur, wenn Lernfracht auf dem Home-Bildschirm liegt – die Kalender-Erinnerung klappt überall.'),
      status,
    );
  }

  /**
   * ASSUMPTION: Import ersetzt den Stand komplett (kein Zusammenführen zweier Geräte). Reset löscht
   * auch die Einstellungen und startet mit dem Onboarding.
   * @param {import('../app.js').ScreenContext} c
   */
  function dataSection(c) {
    const fileId = uid('import');
    const file = h('input', { id: fileId, type: 'file', accept: '.json,application/json', class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
    const importArea = h('div', { class: 'import-area', 'aria-live': 'polite' });

    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      file.value = '';
      if (!selected) return;
      const result = parseImport(await selected.text(), now);
      if (!result.ok) {
        importArea.replaceChildren(h('p', { class: 'form-error', role: 'alert' }, result.error));
        return;
      }
      const p = result.preview;
      importArea.replaceChildren(
        h(
          'div',
          { class: 'import-preview' },
          h('p', { class: 'field-label' }, `Sicherung${p.exportedAt ? ` vom ${germanDate(p.exportedAt.slice(0, 10))}` : ''}${p.nickname ? ` · ${p.nickname}` : ''}`),
          h(
            'ul',
            { class: 'stat-list' },
            h('li', null, h('span', null, 'Gelernte Fragen'), h('span', null, String(p.cards))),
            h('li', null, h('span', null, 'Streak'), h('span', null, `🔥 ${p.streak}`)),
            h('li', null, h('span', null, 'XP gesamt'), h('span', null, String(p.xp))),
            h('li', null, h('span', null, 'Klausur-Simulationen'), h('span', null, String(p.exams))),
            h('li', null, h('span', null, 'Abzeichen'), h('span', null, String(p.badges))),
          ),
          h('p', { class: 'field-help' }, 'Dein aktueller Stand auf diesem Gerät wird dabei ersetzt.'),
          h(
            'div',
            { class: 'button-row' },
            h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => importArea.replaceChildren() }, 'Abbrechen'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn',
                onClick: () => {
                  c.replaceState(result.state);
                  c.notify({ text: 'Sicherung importiert.' });
                  navigate('/home');
                },
              },
              'Importieren',
            ),
          ),
        ),
      );
    });

    const reset1 = confirmDialog('Alles zurücksetzen?', 'Fortschritt, Streak, Liga, Abzeichen und Einstellungen werden von diesem Gerät gelöscht.', 'Weiter', () => {
      reset1.close();
      reset2.showModal();
    });
    const reset2 = confirmDialog('Wirklich endgültig?', 'Das lässt sich nicht rückgängig machen. Wenn du unsicher bist: vorher exportieren.', 'Endgültig löschen', () => {
      reset2.close();
      c.replaceState(createDefaultState(now));
      c.notify({ text: 'Alles zurückgesetzt. Neuer Start.' });
      navigate('/onboarding');
    }, true);

    return section(
      'Deine Daten',
      h('p', { class: 'field-help' }, 'Alles bleibt auf diesem Gerät. Mit einer Sicherung nimmst du deinen Stand auf ein anderes Gerät mit.'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary mt-12',
          onClick: () => downloadText(`lernfracht-sicherung-${todayLocal(now)}.json`, 'application/json', exportState(store.get(), now)),
        },
        'Sicherung exportieren',
      ),
      h('button', { type: 'button', class: 'btn btn-secondary mt-8', onClick: () => file.click() }, 'Sicherung importieren'),
      file,
      importArea,
      h('button', { type: 'button', class: 'btn btn-danger mt-12', onClick: () => reset1.showModal() }, 'Alles zurücksetzen'),
      reset1,
      reset2,
    );
  }
}

/**
 * @param {string} title
 * @param {...any} children
 */
function section(title, ...children) {
  return h('section', { class: 'card settings-section' }, h('h2', null, title), ...children);
}

/**
 * @param {{label: string, value: string, help?: string, type?: string, maxlength?: number, placeholder?: string,
 *   autocomplete?: string, onChange: (value: string) => void}} options
 */
function textField({ label, value, help, type = 'text', maxlength, placeholder, autocomplete, onChange }) {
  const id = uid('field');
  const input = h('input', { id, class: 'field-input', type, value, maxlength: maxlength ? String(maxlength) : null, placeholder, autocomplete, 'aria-describedby': help ? `${id}-help` : null });
  input.addEventListener('change', () => onChange(input.value));
  return h('div', { class: 'field mt-12' }, h('label', { for: id, class: 'field-label' }, label), input, help && h('p', { id: `${id}-help`, class: 'field-help' }, help));
}

/**
 * On/off switch (checkbox with role="switch").
 * @param {string} label
 * @param {string} help
 * @param {boolean} checked
 * @param {(on: boolean, input: HTMLInputElement) => void} onChange
 * @param {boolean} [disabled]
 */
function switchRow(label, help, checked, onChange, disabled = false) {
  const id = uid('switch');
  const input = h('input', { id, type: 'checkbox', role: 'switch', class: 'switch', checked, disabled, 'aria-describedby': `${id}-help` });
  input.addEventListener('change', () => onChange(input.checked, input));
  return h(
    'div',
    { class: 'switch-row mt-12' },
    h('div', null, h('label', { for: id, class: 'field-label' }, label), h('p', { id: `${id}-help`, class: 'field-help' }, help)),
    input,
  );
}

/**
 * @param {string} title
 * @param {string} text
 * @param {string} confirmLabel
 * @param {() => void} onConfirm
 * @param {boolean} [danger]
 */
function confirmDialog(title, text, confirmLabel, onConfirm, danger = false) {
  const titleId = uid('dialog');
  /** @type {HTMLDialogElement} */
  const d = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h('h2', { id: titleId }, title),
    h('p', null, text),
    h(
      'div',
      { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => d.close() }, 'Abbrechen'),
      h('button', { type: 'button', class: danger ? 'btn btn-danger' : 'btn', onClick: onConfirm }, confirmLabel),
    ),
  );
  return d;
}
