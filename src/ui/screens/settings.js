import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';

/** @type {[value: 'dark'|'light'|'system', label: string][]} */
const THEME_OPTIONS = [
  ['dark', 'Dunkel'],
  ['light', 'Hell'],
  ['system', 'System'],
];

/** @param {import('../app.js').ScreenContext} ctx */
export function render({ store, version }) {
  const current = store.get().profile.theme;

  /** @param {'dark'|'light'|'system'} theme */
  const setTheme = (theme) => store.update((s) => ({ ...s, profile: { ...s.profile, theme } }));

  return [
    screenHeader({ title: 'Einstellungen', back: { href: '#/profile', label: 'Zurück zum Profil' } }),
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
              h('input', { type: 'radio', name: 'theme', value, checked: value === current, onChange: () => setTheme(value) }),
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
