import { h } from '../dom.js';
import { uid } from '../uid.js';
import { screenHeader } from '../components/screenHeader.js';
import { goalPicker } from './onboarding.js';
import { todayLocal } from '../../engine/dates.js';

/** @type {[value: 'dark'|'light'|'system', label: string][]} */
const THEME_OPTIONS = [
  ['dark', 'Dunkel'],
  ['light', 'Hell'],
  ['system', 'System'],
];

/**
 * Einstellungen. M4: Spitzname, Tagesziel, Klausurtermine, Theme. Rest (Erinnerung, Export …) folgt mit M6.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ store, catalog, version, now }) {
  const profile = store.get().profile;
  /** @param {Partial<import('../../engine/storage.js').Profile>} patch */
  const setProfile = (patch) => store.update((s) => ({ ...s, profile: { ...s.profile, ...patch } }));

  const nickId = uid('nick');
  const nick = h('input', { id: nickId, class: 'field-input', type: 'text', maxlength: '24', autocomplete: 'nickname', value: profile.nickname, placeholder: 'Spitzname' });
  nick.addEventListener('change', () => setProfile({ nickname: nick.value.trim().slice(0, 24) }));

  return [
    screenHeader({ title: 'Einstellungen', back: { href: '#/profile', label: 'Zurück zum Profil' } }),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: nickId, class: 'field-label' }, 'Spitzname'), nick, h('p', { class: 'field-help' }, 'Erscheint nur in deiner Demo-Liga. Kein Klarname nötig.')),
    ),
    h('section', { class: 'card' }, h('h2', null, 'Tagesziel'), goalPicker(profile.dailyGoalXp, (xp) => setProfile({ dailyGoalXp: xp }))),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Klausurtermine'),
      catalog.units.map((unit) => {
        const id = uid('exam');
        const input = h('input', { id, class: 'field-input', type: 'date', min: todayLocal(now), value: profile.examDates[unit.id] ?? '' });
        input.addEventListener('change', () => {
          const examDates = { ...store.get().profile.examDates };
          if (input.value) examDates[unit.id] = input.value;
          else delete examDates[unit.id];
          setProfile({ examDates });
        });
        return h('div', { class: 'field' }, h('label', { for: id, class: 'field-label' }, unit.title.split(' – ')[0]), input);
      }),
      h('p', { class: 'field-help' }, 'Feld leeren, um den Termin zu entfernen.'),
    ),
    h(
      'section',
      { class: 'card' },
      h(
        'fieldset',
        { class: 'segmented' },
        h('legend', null, 'Darstellung'),
        h(
          'div',
          { class: 'segmented-options' },
          THEME_OPTIONS.map(([value, label]) =>
            h(
              'label',
              null,
              h('input', { type: 'radio', name: 'theme', value, checked: value === profile.theme, onChange: () => setProfile({ theme: value }) }),
              h('span', null, label),
            ),
          ),
        ),
      ),
      h('p', { class: 'muted small mt-8' }, '„System“ folgt der Einstellung deines Geräts.'),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Über Lernfracht'),
      h('p', { class: 'muted small' }, 'Deine Daten bleiben auf diesem Gerät. Kein Konto, kein Tracking.'),
      h('p', { class: 'muted small mt-8' }, `Version ${version}`),
    ),
  ];
}
