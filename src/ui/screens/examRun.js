import { h } from '../dom.js';
import { uid } from '../uid.js';
import { icon } from '../components/icon.js';
import { emptyState } from '../components/emptyState.js';
import { contextBlock } from '../components/contextBlock.js';
import { solutionNode } from '../components/feedbackSheet.js';
import { createRenderer } from '../components/questions/index.js';
import { greenTopicCount } from '../gamification.js';
import { badgeById } from '../../engine/badges.js';
import { IHK_GRADE_SCALE, drawExam, scoreExam } from '../../engine/exam.js';
import { keywordHits } from '../../engine/grading.js';
import { formatNumber } from '../../engine/numbers.js';
import { prepareQuestion } from '../../engine/present.js';
import { finishExam } from '../../engine/progress.js';
import { createRng, hashString } from '../../engine/random.js';
import { describeSolution } from '../../engine/solution.js';

const WARN_AT_MS = 5 * 60 * 1000;

/**
 * Klausur-Simulation (SPEC §4.6): Durchlauf ohne Feedback → Selbstbewertung Freitext → Ergebnis.
 * `#/exam/run?unit=lf14-2`
 * ASSUMPTION: Eine laufende Simulation wird nicht gespeichert – wer die Seite neu lädt oder die
 * Route verlässt, bricht sie ab. Gespeichert wird beim Abgeben.
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render(ctx) {
  const { catalog, store, now, navigate } = ctx;
  const unit = (ctx.query.unit && catalog.getUnit(ctx.query.unit)) || catalog.units[0];
  const exam = unit?.exam;
  if (!unit || !exam) {
    return [
      h('h1', { class: 'visually-hidden', tabindex: '-1' }, 'Klausur nicht gefunden'),
      emptyState({ icon: '🔍', title: 'Klausur nicht gefunden', action: h('a', { class: 'btn btn-secondary', href: '#/exam' }, 'Zur Übersicht') }),
    ];
  }
  const scale = exam.gradeScale ?? IHK_GRADE_SCALE;
  const startedAt = now();
  const endsAt = startedAt + exam.durationMinutes * 60000;
  const gids = drawExam({ questions: catalog.getPathQuestions(unit.id), config: exam, rng: createRng(hashString(`${unit.id}:${startedAt}`)) });
  const questions = gids.map((gid) => /** @type {NonNullable<ReturnType<typeof catalog.getQuestion>>} */ (catalog.getQuestion(gid)));

  // Alle Fragen einmal aufbauen und am Leben lassen – so bleiben Antworten beim Blättern erhalten.
  const views = questions.map((question, i) => {
    const promptId = uid('exam-prompt');
    const view = { question, flagged: false, touched: false, renderer: /** @type {import('../components/questions/index.js').Renderer} */ (/** @type {unknown} */ (null)), el: /** @type {HTMLElement} */ (/** @type {unknown} */ (null)) };
    view.renderer = createRenderer(question, prepareQuestion(question, createRng(hashString(`${question.gid}:${startedAt}`))), {
      promptId,
      onChange: () => {
        view.touched = true;
        updateStrip();
      },
    });
    view.el = h(
      'article',
      { class: 'question exam-question', 'aria-labelledby': promptId },
      h('p', { class: 'exam-qno' }, `Frage ${i + 1} von ${questions.length}`),
      question.context && contextBlock(question.context),
      h('h2', { class: 'prompt', id: promptId, tabindex: '-1' }, question.prompt),
      question.type === 'multi' && h('p', { class: 'type-hint' }, 'Mehrere Antworten richtig.'),
      view.renderer.el,
    );
    return view;
  });

  // ASSUMPTION: Beantwortet = vollständig. Eine Reihenfolge-Frage gilt erst als beantwortet, wenn
  // sortiert wurde; eine ungültige Zahl zählt bei der Abgabe als unbeantwortet (0 Punkte).
  const isAnswered = (/** @type {(typeof views)[number]} */ v) => v.renderer.isComplete() && (v.question.type !== 'order' || v.touched);

  let index = 0;
  let phase = /** @type {'run'|'assess'|'result'} */ ('run');
  let warned = false;
  const root = h('div', { class: 'exam-run' });
  const timer = h('span', { class: 'timer', role: 'timer', 'aria-label': 'Restzeit' });
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'assertive' });
  const strip = h('nav', { class: 'exam-strip', 'aria-label': 'Fragenübersicht' });
  const slot = h('div', { class: 'exam-slot' });
  const prev = h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => go(index - 1) }, icon('back'), 'Zurück');
  const flag = h('button', { type: 'button', class: 'btn btn-secondary exam-flag', 'aria-pressed': 'false', onClick: toggleFlag }, 'Markieren');
  const next = h('button', { type: 'button', class: 'btn', onClick: () => (index === views.length - 1 ? requestSubmit() : go(index + 1)) });

  const cancelDialog = dialog('Simulation abbrechen?', 'Deine Antworten gehen dabei verloren.', [
    ['Weiter schreiben', 'btn', (d) => d.close()],
    ['Abbrechen', 'btn btn-secondary', () => navigate('/exam')],
  ]);
  const submitText = h('p');
  const submitDialog = dialog('Jetzt abgeben?', submitText, [
    ['Zurück zur Klausur', 'btn btn-secondary', (d) => d.close()],
    ['Abgeben', 'btn', (d) => { d.close(); submit(false); }],
  ]);

  function updateStrip() {
    strip.replaceChildren(
      ...views.map((v, i) => {
        const answered = isAnswered(v);
        const parts = [`Frage ${i + 1}`, answered ? 'beantwortet' : 'offen', v.flagged ? 'markiert' : ''].filter(Boolean);
        return h(
          'button',
          {
            type: 'button',
            class: `strip-item${i === index ? ' is-current' : ''}${answered ? ' is-answered' : ''}${v.flagged ? ' is-flagged' : ''}`,
            'aria-label': parts.join(', '),
            'aria-current': i === index ? 'step' : null,
            onClick: () => go(i),
          },
          String(i + 1),
        );
      }),
    );
  }

  /** @param {number} target */
  function go(target) {
    if (target < 0 || target >= views.length || phase !== 'run') return;
    const leaving = views[index];
    if (leaving.question.type === 'numeric' && leaving.renderer.isComplete()) {
      const error = leaving.renderer.validate?.();
      if (error) leaving.renderer.showError?.(error);
    }
    index = target;
    showQuestion();
  }

  function showQuestion() {
    const v = views[index];
    slot.replaceChildren(v.el);
    prev.disabled = index === 0;
    flag.setAttribute('aria-pressed', String(v.flagged));
    flag.textContent = v.flagged ? 'Markiert' : 'Markieren';
    next.replaceChildren(...(index === views.length - 1 ? ['Abgeben'] : ['Weiter', icon('next')]));
    updateStrip();
    if (root.isConnected) {
      window.scrollTo(0, 0);
      /** @type {HTMLElement|null} */ (v.el.querySelector('.prompt'))?.focus({ preventScroll: true });
    }
  }

  function toggleFlag() {
    const v = views[index];
    v.flagged = !v.flagged;
    flag.setAttribute('aria-pressed', String(v.flagged));
    flag.textContent = v.flagged ? 'Markiert' : 'Markieren';
    updateStrip();
  }

  function tick() {
    if (phase !== 'run') return;
    const left = Math.max(0, endsAt - now());
    const total = Math.ceil(left / 1000);
    timer.textContent = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    if (left <= WARN_AT_MS && !warned) {
      warned = true;
      timer.classList.add('is-low');
      live.textContent = 'Noch 5 Minuten.';
      ctx.notify({ text: '⏱️ Noch 5 Minuten – Zeit, die markierten Fragen anzuschauen.' });
    }
    if (left <= 0) submit(true);
  }
  const interval = window.setInterval(tick, 1000);
  ctx.onCleanup(() => window.clearInterval(interval));

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if (phase !== 'run' || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest?.('dialog')) return;
    const typing = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text');
    if (typing) return;
    if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else if (/^[1-9]$/.test(event.key) && views[index].renderer.onDigit?.(Number(event.key))) {
      views[index].touched = true;
      updateStrip();
    } else return;
    event.preventDefault();
  }
  document.addEventListener('keydown', onKeyDown);
  ctx.onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  function requestSubmit() {
    const open = views.filter((v) => !isAnswered(v)).length;
    const flagged = views.filter((v) => v.flagged).length;
    if (open === 0 && flagged === 0) {
      submit(false);
      return;
    }
    submitText.textContent = [open > 0 && `${open} ${open === 1 ? 'Frage ist' : 'Fragen sind'} noch offen.`, flagged > 0 && `${flagged} markiert.`].filter(Boolean).join(' ');
    if (typeof submitDialog.showModal === 'function') submitDialog.showModal();
    else submit(false);
  }

  /** @type {Record<string, any>} */
  const answers = {};
  let finishedAt = 0;

  /** @param {boolean} auto */
  function submit(auto) {
    if (phase !== 'run') return;
    phase = 'assess';
    finishedAt = Math.min(now(), endsAt);
    window.clearInterval(interval);
    if (cancelDialog.open) cancelDialog.close();
    if (submitDialog.open) submitDialog.close();
    if (auto) ctx.notify({ text: '⏱️ Zeit ist um – deine Klausur wurde automatisch abgegeben.' });
    for (const v of views) {
      if (!isAnswered(v)) continue;
      if (v.renderer.validate?.()) continue; // ungültige Zahl → unbeantwortet
      answers[v.question.gid] = v.renderer.getAnswer();
    }
    const toAssess = views.filter((v) => v.question.type === 'open' && answers[v.question.gid]);
    assess(toAssess, 0);
  }

  /**
   * Self-assessment of the free-text answers, one after another.
   * @param {typeof views} items
   * @param {number} i
   */
  function assess(items, i) {
    if (i >= items.length) {
      showResult();
      return;
    }
    const q = items[i].question;
    const answer = answers[q.gid];
    const hits = keywordHits(q, answer.text);
    const base = uid('rubric');
    /** @type {{criterion: string, points: number}[]} */
    const rubric = q.rubric;
    const boxes = rubric.map((_, k) => h('input', { type: 'checkbox', id: `${base}-${k}`, class: 'rubric-input' }));
    root.replaceChildren(
      h('h1', { tabindex: '-1', class: 'exam-h1' }, `Freitext bewerten (${i + 1}/${items.length})`),
      h('p', { class: 'muted' }, 'Vergleich deine Antwort mit der Musterlösung und hak ab, was drinsteckt.'),
      h('h2', { class: 'prompt' }, q.prompt),
      h('section', { class: 'card' }, h('p', { class: 'solution-label' }, 'Deine Antwort'), h('p', { class: 'own-answer' }, answer.text)),
      hits.total > 0 && h('p', { class: 'keyword-hint' }, `Du hast ${hits.used.length} von ${hits.total} Schlüsselbegriffen verwendet.`),
      h('section', { class: 'model-answer' }, h('h3', null, 'Musterlösung'), h('p', null, q.modelAnswer)),
      h(
        'fieldset',
        { class: 'rubric' },
        h('legend', null, 'Was steckt in deiner Antwort?'),
        rubric.map((r, k) =>
          h('label', { class: 'rubric-row', for: boxes[k].id }, boxes[k], h('span', { class: 'rubric-text' }, r.criterion), h('span', { class: 'rubric-points' }, `${formatNumber(r.points)} P.`)),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onClick: () => {
              answers[q.gid] = { text: answer.text, met: boxes.map((b) => b.checked) };
              assess(items, i + 1);
            },
          },
          i + 1 < items.length ? 'Weiter' : 'Ergebnis anzeigen',
        ),
      ),
    );
    window.scrollTo(0, 0);
    /** @type {HTMLElement|null} */ (root.querySelector('h1'))?.focus();
  }

  function showResult() {
    phase = 'result';
    const result = scoreExam({ questions, answers, scale });
    const durationSec = (finishedAt - startedAt) / 1000;
    const done = finishExam(store.get(), { now, unitId: unit.id, result, durationSec, greenTopics: (s) => greenTopicCount(catalog, s.cards) });
    store.update(() => done.state);
    const after = store.get();
    const minutes = Math.max(1, Math.round(durationSec / 60));
    const streakUp = after.streak.current > done.streakBefore;

    root.replaceChildren(
      h(
        'section',
        { class: 'exam-grade' },
        h('p', { class: 'exam-grade-eyebrow' }, exam.title ?? 'Klausur-Simulation'),
        h('h1', { tabindex: '-1' }, h('span', { class: 'grade-big' }, `Note ${result.grade.grade}`), h('span', { class: 'grade-label' }, result.grade.label)),
        h('p', { class: 'result-lead' }, `${formatNumber(result.points)} von ${formatNumber(result.maxPoints)} Punkten · ${formatNumber(result.percent, 1)} %`),
        h(
          'ul',
          { class: 'result-chips' },
          h('li', null, `${minutes} Min.`),
          h('li', { class: 'is-hot' }, `+${done.xp} XP`),
          h('li', { class: streakUp ? 'is-hot' : '' }, `🔥 ${after.streak.current}${streakUp ? ' · +1' : ''}`),
        ),
        h('p', { class: 'muted small' }, exam.gradeScale ? 'Notenschlüssel deiner Schule' : 'Notenschlüssel nach IHK'),
      ),
      done.badges.length > 0 &&
        h(
          'section',
          { class: 'card new-badges', role: 'status' },
          h('h2', null, done.badges.length === 1 ? 'Neues Abzeichen' : 'Neue Abzeichen'),
          h('ul', null, done.badges.map((b) => badgeById(b.id)).filter((b) => b !== null).map((b) => h('li', null, h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, b.icon), h('strong', null, b.title)))),
        ),
      h(
        'section',
        { class: 'card' },
        h('h2', null, 'Nach Themen'),
        h(
          'ul',
          { class: 'topic-scores' },
          unit.topics
            .filter((t) => result.perTopic[t.id])
            .map((t) => {
              const s = result.perTopic[t.id];
              const pct = s.maxPoints > 0 ? (s.points / s.maxPoints) * 100 : 0;
              const tone = pct >= 81 ? 'good' : pct >= 50 ? 'ok' : 'bad';
              return h(
                'li',
                null,
                h('span', { class: 'topic-score-name' }, `${t.icon ?? ''} ${t.title}`),
                h('span', { class: 'topic-score-points' }, `${formatNumber(s.points)}/${formatNumber(s.maxPoints)}`),
                h('span', { class: `score-bar is-${tone}`, 'aria-hidden': 'true' }, h('span', { class: 'score-fill', style: `width:${Math.round(pct)}%` })),
              );
            }),
        ),
      ),
      result.wrong.length > 0 &&
        h(
          'section',
          { class: 'card' },
          h('h2', null, `Das ging daneben (${result.wrong.length})`),
          h('p', { class: 'muted small' }, 'Alle diese Fragen liegen jetzt in deiner Fehlerkiste.'),
          h(
            'ul',
            { class: 'mistake-details' },
            result.items
              .filter((item) => !item.grade.correct)
              .map((item) => {
                const q = /** @type {NonNullable<ReturnType<typeof catalog.getQuestion>>} */ (catalog.getQuestion(item.gid));
                return h(
                  'li',
                  null,
                  h(
                    'details',
                    null,
                    h(
                      'summary',
                      null,
                      h('span', { class: 'mistake-prompt' }, q.prompt),
                      h('span', { class: 'mistake-meta' }, item.answered ? `${formatNumber(item.grade.points)} von ${formatNumber(item.grade.maxPoints)} P.` : 'nicht beantwortet'),
                    ),
                    h(
                      'div',
                      { class: 'mistake-body' },
                      q.type !== 'open' && h('div', { class: 'solution' }, h('p', { class: 'solution-label' }, 'Richtig ist:'), solutionNode(describeSolution(q))),
                      q.type === 'open' && h('div', { class: 'solution' }, h('p', { class: 'solution-label' }, 'Musterlösung'), h('p', null, q.modelAnswer)),
                      h('p', null, q.explanation),
                      h('p', { class: 'sheet-source' }, `Quelle: ${q.sourceRef}`),
                    ),
                  ),
                );
              }),
          ),
        ),
      h(
        'div',
        { class: 'actions' },
        result.wrong.length > 0 && h('a', { class: 'btn', href: '#/lesson?mode=mistakes' }, `Fehler üben (${result.wrong.length})`),
        h('a', { class: result.wrong.length > 0 ? 'btn btn-secondary' : 'btn', href: '#/exam' }, 'Zur Klausur-Übersicht'),
        h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
      ),
    );
    window.scrollTo(0, 0);
    /** @type {HTMLElement|null} */ (root.querySelector('h1'))?.focus();
  }

  root.append(
    h(
      'header',
      { class: 'exam-top' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Simulation abbrechen', onClick: () => (typeof cancelDialog.showModal === 'function' ? cancelDialog.showModal() : navigate('/exam')) }, icon('close')),
      timer,
      h('button', { type: 'button', class: 'text-button exam-submit', onClick: requestSubmit }, 'Abgeben'),
    ),
    h('h1', { class: 'visually-hidden', tabindex: '-1' }, exam.title ?? 'Klausur-Simulation'),
    strip,
    slot,
    h('div', { class: 'exam-nav' }, prev, flag, next),
    live,
    cancelDialog,
    submitDialog,
  );
  tick();
  showQuestion();
  return root;
}

/**
 * @param {string} title
 * @param {string|Node} text
 * @param {[label: string, cls: string, onClick: (d: HTMLDialogElement) => void][]} actions
 * @returns {HTMLDialogElement}
 */
function dialog(title, text, actions) {
  const titleId = uid('dialog');
  /** @type {HTMLDialogElement} */
  const d = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h('h2', { id: titleId }, title),
    typeof text === 'string' ? h('p', null, text) : text,
    h('div', { class: 'dialog-actions' }, actions.map(([label, cls, onClick]) => h('button', { type: 'button', class: cls, onClick: () => onClick(d) }, label))),
  );
  return d;
}
