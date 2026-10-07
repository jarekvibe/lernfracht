import { h } from '../dom.js';
import { uid } from '../uid.js';
import { icon } from '../components/icon.js';
import { emptyState } from '../components/emptyState.js';
import { questionView } from '../components/questionView.js';
import { setLastResult } from '../lastResult.js';
import { greenTopicCount, leagueSnapshot, todayXp } from '../gamification.js';
import { advance, answerCurrent, currentItem, isFinished, startLesson, summarize } from '../../engine/lesson.js';
import { finishSession, mistakeCount, recordAnswer } from '../../engine/progress.js';
import { xpForAnswer } from '../../engine/xp.js';
import { createRng, hashString } from '../../engine/random.js';
import { buildMistakeSession, buildSession } from '../../engine/session.js';
import { canDoGids } from '../../engine/cando.js';

/**
 * Lektion · Thema üben · Fehler üben.
 * `#/lesson?unit=lf14-2` · `#/lesson?mode=topic&unit=lf14-2&topic=abc` · `#/lesson?mode=mistakes`
 * · `#/lesson?mode=cando&unit=lf14-2&cando=abc.c1` (Kann-Liste-Zeile)
 * Jede Erstantwort wird sofort gespeichert – wer abbricht, verliert nichts.
 * ASSUMPTION: Eine abgebrochene Lektion zählt nicht als abgeschlossen (kein Eintrag in `days`).
 * @param {import('../app.js').ScreenContext} ctx
 */
export function render(ctx) {
  const { catalog, store, now, navigate } = ctx;
  const scope = resolveScope(catalog, ctx.query);
  const back = h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'Zurück zum Lernpfad' }, icon('close'));

  if (!scope) {
    return [
      h('header', { class: 'lesson-top' }, back),
      h('h1', { class: 'visually-hidden', tabindex: '-1' }, 'Nicht gefunden'),
      emptyState({
        icon: '🔍',
        title: 'Nicht gefunden',
        text: 'Dieses Thema bzw. diese Kann-Liste-Zeile gibt es in dieser Version nicht.',
        action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
      }),
    ];
  }

  const cards = store.get().cards;
  const gids = scope.mode === 'mistakes'
    ? buildMistakeSession({ questions: scope.questions, cards })
    : buildSession({ questions: scope.questions, cards, now });

  if (gids.length === 0) {
    return [
      h('header', { class: 'lesson-top' }, back),
      h('h1', { class: 'visually-hidden', tabindex: '-1' }, scope.title),
      scope.mode === 'mistakes'
        ? emptyState({ icon: '🧰', title: 'Fehlerkiste leer. Läuft.', text: 'Gerade gibt es nichts nachzuüben.', action: h('a', { class: 'btn', href: '#/home' }, 'Weiterlernen') })
        : emptyState({ icon: '📦', title: 'Hier ist gerade nichts zu tun', text: 'Für diesen Bereich gibt es keine Fragen.', action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad') }),
    ];
  }

  let lesson = startLesson({ gids, mode: scope.mode, now });
  const mistakesBefore = mistakeCount(store.get());
  const xpBefore = todayXp(store.get(), now);
  let xpEarned = 0;
  /** @type {(() => void)[]} */
  let questionCleanups = [];
  const runQuestionCleanups = () => {
    for (const fn of questionCleanups) fn();
    questionCleanups = [];
  };
  ctx.onCleanup(runQuestionCleanups);

  const fill = h('span', { class: 'progress-fill' });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Fortschritt der Lektion', 'aria-valuemin': '0' }, fill);
  const counter = h('span', { class: 'lesson-count', 'aria-hidden': 'true' });
  const slot = h('div', { class: 'lesson-slot' });

  const dialogTitle = uid('dialog');
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': dialogTitle },
    h('h2', { id: dialogTitle }, 'Lektion beenden?'),
    h('p', null, 'Deine Antworten bis hier sind gespeichert.'),
    h(
      'div',
      { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, 'Weiterlernen'),
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: exit }, 'Beenden'),
    ),
  );
  const close = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Lektion beenden', onClick: requestExit }, icon('close'));

  function requestExit() {
    if (lesson.results.length === 0 || typeof dialog.showModal !== 'function') exit();
    else dialog.showModal();
  }

  function exit() {
    if (dialog.open) dialog.close();
    navigate('/home');
  }

  function updateProgress() {
    const answered = lesson.results.length + lesson.retryResults.length;
    const total = lesson.queue.length;
    fill.style.width = `${Math.round((answered / total) * 100)}%`;
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(answered));
    progress.setAttribute('aria-valuetext', `${answered} von ${total} beantwortet`);
    counter.textContent = `${Math.min(lesson.index + 1, total)} / ${total}`;
  }

  function show() {
    runQuestionCleanups();
    const item = currentItem(lesson);
    if (!item) {
      finish();
      return;
    }
    const question = /** @type {NonNullable<ReturnType<typeof catalog.getQuestion>>} */ (catalog.getQuestion(item.gid));
    const shownAt = now();
    /** @param {{correct: boolean, score: number}} grade */
    const xpFor = (grade) => xpForAnswer(question, grade, { mode: scope.mode, retry: item.retry });
    const view = questionView({
      xpFor,
      question,
      rng: createRng(hashString(item.gid) ^ shownAt),
      ai: ctx.ai,
      store,
      onCleanup: (fn) => questionCleanups.push(fn),
      nextLabel: () => (lesson.index + 1 >= lesson.queue.length ? 'Fertig' : 'Weiter'),
      onGraded: (grade) => {
        lesson = answerCurrent(lesson, grade);
        if (!item.retry) {
          const ms = now() - shownAt;
          const xp = xpFor(grade);
          xpEarned += xp;
          store.update((state) => recordAnswer(state, { gid: item.gid, grade, now, ms, mode: scope.mode, xp }));
        }
        updateProgress();
      },
      onNext: () => {
        lesson = advance(lesson);
        show();
      },
    });
    slot.replaceChildren(
      ...[item.retry && h('p', { class: 'retry-note' }, 'Nochmal: Die hattest du vorhin falsch.'), view.el].filter(
        (node) => node instanceof Node,
      ),
    );
    updateProgress();
    if (slot.isConnected) {
      window.scrollTo(0, 0);
      /** @type {HTMLElement|null} */ (view.el.querySelector('.prompt'))?.focus({ preventScroll: true });
    }
  }

  function finish() {
    if (!isFinished(lesson)) return;
    const summary = summarize(lesson, now);
    const done = finishSession(store.get(), {
      now,
      summary,
      mistakesBefore,
      greenTopics: (state) => greenTopicCount(catalog, state.cards),
    });
    store.update(() => done.state);
    const after = store.get();
    const league = leagueSnapshot(after, now);
    setLastResult({
      ...summary,
      unitId: scope.unitId,
      topicId: scope.topicId,
      canDoId: scope.canDoId ?? null,
      title: scope.title,
      xp: xpEarned + done.bonusXp,
      streakBefore: done.streakBefore,
      streakAfter: after.streak.current,
      badges: done.badges.map((b) => b.id),
      league: { rank: league.rank, tierName: league.tierName },
      goal: { xp: after.profile.dailyGoalXp, before: xpBefore, after: todayXp(after, now) },
    });
    navigate('/result', { replace: true });
  }

  show();

  return [
    h('header', { class: 'lesson-top' }, close, progress, counter),
    h('h1', { class: 'visually-hidden', tabindex: '-1' }, scope.title),
    slot,
    dialog,
  ];
}

/**
 * @param {import('../app.js').ScreenContext['catalog']} catalog
 * @param {Record<string, string>} query
 * @returns {{mode: import('../../engine/lesson.js').LessonMode, title: string, unitId: string|null, topicId: string|null,
 *   canDoId?: string, questions: ReturnType<typeof catalog.getPathQuestions>}|null}
 */
function resolveScope(catalog, query) {
  if (query.mode === 'mistakes') {
    return {
      mode: 'mistakes',
      title: 'Fehler üben',
      unitId: null,
      topicId: null,
      questions: catalog.units.flatMap((u) => catalog.getPathQuestions(u.id)),
    };
  }
  const unit = (query.unit && catalog.getUnit(query.unit)) || catalog.units[0];
  if (!unit) return null;
  if (query.mode === 'cando') {
    const entry = unit.topics.flatMap((t) => t.canDo ?? []).find((c) => c.id === query.cando);
    if (!entry) return null;
    const linked = new Set(canDoGids(unit.id, entry));
    return {
      mode: 'cando',
      title: `Kann-Liste üben: ${entry.text}`,
      unitId: unit.id,
      topicId: null,
      canDoId: entry.id,
      questions: catalog.getPathQuestions(unit.id).filter((q) => linked.has(q.gid)),
    };
  }
  if (query.mode === 'topic') {
    const topic = unit.topics.find((t) => t.id === query.topic);
    if (!topic) return null;
    return { mode: 'topic', title: `Thema üben: ${topic.title}`, unitId: unit.id, topicId: topic.id, questions: catalog.getTopicQuestions(unit.id, topic.id) };
  }
  return { mode: 'path', title: 'Lektion', unitId: unit.id, topicId: null, questions: catalog.getPathQuestions(unit.id) };
}
