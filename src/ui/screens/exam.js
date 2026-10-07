import { h } from '../dom.js';
import { screenHeader } from '../components/screenHeader.js';
import { formatNumber } from '../../engine/numbers.js';

/** @param {string} date `YYYY-MM-DD` → `TT.MM.JJJJ` */
const germanDate = (date) => date.split('-').reverse().join('.');

/**
 * Klausur-Übersicht: Simulation starten, Regeln, bisherige Versuche.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render({ catalog, store }) {
  const exams = /** @type {{unitId: string, date: string, percent: number, grade: number, durationSec: number}[]} */ (store.get().exams);
  return [
    screenHeader({ title: 'Klausur' }),
    catalog.units.map((unit) => {
      const exam = unit.exam;
      const attempts = exams.filter((e) => e.unitId === unit.id).slice().reverse();
      const best = attempts.length ? Math.min(...attempts.map((a) => a.grade)) : null;
      return h(
        'section',
        { class: 'card exam-card' },
        h('h2', null, exam.title ?? `Klausur ${unit.title}`),
        h('p', { class: 'exam-facts' }, `${exam.questionCount} Fragen · ${exam.durationMinutes} Minuten · Note nach ${exam.gradeScale ? 'eurem Schlüssel' : 'IHK-Schlüssel'}`),
        h(
          'ul',
          { class: 'exam-rules' },
          h('li', null, 'Wie in echt: kein Feedback zwischendurch.'),
          h('li', null, 'Vor- und zurückblättern, Fragen markieren.'),
          h('li', null, 'Bei 0:00 wird automatisch abgegeben.'),
          h('li', null, 'Freitexte bewertest du danach selbst.'),
        ),
        h('a', { class: 'btn', href: `#/exam/run?unit=${encodeURIComponent(unit.id)}` }, 'Simulation starten'),
        h(
          'div',
          { class: 'exam-history' },
          h('h3', null, 'Deine Versuche'),
          attempts.length === 0
            ? h('p', { class: 'muted small' }, 'Noch kein Versuch. Ein paar Lektionen vorher helfen.')
            : [
                h('p', { class: 'muted small' }, `Beste Note: ${best}`),
                h(
                  'ol',
                  { class: 'history-list' },
                  attempts.slice(0, 10).map((a) =>
                    h(
                      'li',
                      null,
                      h('span', null, germanDate(a.date)),
                      h('span', { class: 'history-grade' }, `Note ${a.grade}`),
                      h('span', { class: 'muted' }, `${formatNumber(a.percent, 1)} % · ${Math.max(1, Math.round(a.durationSec / 60))} Min.`),
                    ),
                  ),
                ),
              ],
        ),
      );
    }),
  ];
}
