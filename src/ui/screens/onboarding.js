import { h } from '../dom.js';
import { uid } from '../uid.js';
import { downloadReminderIcs } from '../reminders.js';
import { todayLocal } from '../../engine/dates.js';
import { DAILY_GOALS } from '../../engine/xp.js';

const NICKNAME_MAX = 24;

/**
 * Onboarding (SPEC §4.1): Nickname · Tagesziel · Klausurdatum · Erinnerungszeit. Jederzeit überspringbar.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ store, catalog, navigate, now, version }) {
  const profile = store.get().profile;
  const today = todayLocal(now);
  const draft = {
    nickname: profile.nickname,
    dailyGoalXp: profile.dailyGoalXp,
    examDates: { ...profile.examDates },
    reminderTime: profile.reminderTime,
  };
  let step = 0;
  const root = h('div', { class: 'onboarding' });

  /** Speichert, was bisher gewählt wurde (Überspringen behält die Vorgaben). */
  function finish() {
    store.update((s) => ({
      ...s,
      profile: { ...s.profile, ...draft, nickname: draft.nickname.trim().slice(0, NICKNAME_MAX), onboardedAt: today },
    }));
    navigate('/home', { replace: true });
  }

  const steps = [
    {
      title: 'Willkommen bei Lernfracht',
      text: 'Fünf Minuten am Tag für deine Klausur. Deine Daten bleiben auf diesem Gerät.',
      body: () => {
        const id = uid('nick');
        const input = h('input', {
          id,
          class: 'field-input',
          type: 'text',
          maxlength: String(NICKNAME_MAX),
          autocomplete: 'nickname',
          placeholder: 'z. B. PalettenProfi',
          value: draft.nickname,
          'aria-describedby': `${id}-hint`,
        });
        input.addEventListener('input', () => {
          draft.nickname = input.value;
        });
        return h(
          'div',
          { class: 'field' },
          h('label', { for: id, class: 'field-label' }, 'Wie sollen wir dich nennen?'),
          input,
          h('p', { id: `${id}-hint`, class: 'field-help' }, 'Ein Spitzname reicht, kein Klarname nötig. Er taucht nur in deiner Demo-Liga auf.'),
        );
      },
    },
    {
      title: 'Dein Tagesziel',
      text: 'Wie viel willst du am Tag schaffen? Lässt sich jederzeit ändern.',
      body: () => goalPicker(draft.dailyGoalXp, (xp) => { draft.dailyGoalXp = xp; }),
    },
    {
      title: 'Wann ist Klausur?',
      text: 'Optional. Dann zeigt dir die App, wie viel du pro Tag lernen solltest.',
      body: () =>
        h(
          'div',
          { class: 'field-stack' },
          catalog.units.map((unit) => {
            const id = uid('exam');
            const input = h('input', { id, class: 'field-input', type: 'date', min: today, value: draft.examDates[unit.id] ?? '' });
            input.addEventListener('change', () => {
              if (input.value) draft.examDates[unit.id] = input.value;
              else delete draft.examDates[unit.id];
            });
            return h('div', { class: 'field' }, h('label', { for: id, class: 'field-label' }, `Klausur ${unit.title.split(' – ')[0]}`), input);
          }),
        ),
    },
    {
      title: 'Wann erinnern?',
      text: 'Wähl eine Uhrzeit für deine tägliche Lern-Erinnerung.',
      body: () => {
        const id = uid('time');
        const input = h('input', { id, class: 'field-input', type: 'time', value: draft.reminderTime, step: '300' });
        input.addEventListener('change', () => {
          if (/^\d{2}:\d{2}$/.test(input.value)) draft.reminderTime = input.value;
        });
        const state = store.get();
        return h(
          'div',
          { class: 'field' },
          h('label', { for: id, class: 'field-label' }, 'Erinnerung um'),
          input,
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary mt-12',
              onClick: () => downloadReminderIcs({ ...state, profile: { ...state.profile, reminderTime: draft.reminderTime } }, now, version),
            },
            'In Kalender eintragen',
          ),
          h('p', { class: 'field-help' }, 'Lädt einen täglichen Termin mit Alarm für deinen Kalender. Geht auch später in den Einstellungen.'),
        );
      },
    },
  ];

  function show() {
    const current = steps[step];
    const last = step === steps.length - 1;
    root.replaceChildren(
      h(
        'div',
        { class: 'onboarding-top' },
        h(
          'div',
          { class: 'steps' },
          h('span', { class: 'visually-hidden' }, `Schritt ${step + 1} von ${steps.length}`),
          steps.map((_, i) => h('span', { class: `step-dot${i <= step ? ' is-done' : ''}`, 'aria-hidden': 'true' })),
        ),
        h('button', { type: 'button', class: 'text-button', onClick: () => finish() }, 'Überspringen'),
      ),
      h('h1', { tabindex: '-1' }, current.title),
      h('p', { class: 'onboarding-text' }, current.text),
      current.body(),
      h(
        'div',
        { class: 'onboarding-actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onClick: () => {
              if (last) finish();
              else {
                step += 1;
                show();
                /** @type {HTMLElement|null} */ (root.querySelector('h1'))?.focus();
              }
            },
          },
          last ? 'Los geht’s' : 'Weiter',
        ),
        step > 0 &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary',
              onClick: () => {
                step -= 1;
                show();
              },
            },
            'Zurück',
          ),
      ),
    );
  }

  show();
  return root;
}

/**
 * Four goal cards (radio group). Also used in the settings.
 * @param {number} value
 * @param {(xp: number) => void} onChange
 */
export function goalPicker(value, onChange) {
  const name = uid('goal');
  return h(
    'fieldset',
    { class: 'goal-picker' },
    h('legend', { class: 'visually-hidden' }, 'Tagesziel'),
    DAILY_GOALS.map((goal) =>
      h(
        'label',
        { class: 'goal-option' },
        h('input', { type: 'radio', name, value: String(goal.xp), checked: goal.xp === value, onChange: () => onChange(goal.xp) }),
        h('span', { class: 'goal-card' }, h('span', { class: 'goal-title' }, goal.label), h('span', { class: 'goal-xp' }, `${goal.xp} XP`), h('span', { class: 'goal-hint' }, goal.hint)),
      ),
    ),
  );
}
