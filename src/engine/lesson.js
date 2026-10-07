// Ablauf einer Lektion (SPEC §4.3): Fragen nacheinander, falsch beantwortete kommen
// einmal erneut am Ende (ohne XP).
// ASSUMPTION: Die Wiederholung am Ende ändert die Leitner-Karte nicht – nur der erste Versuch zählt.

/**
 * @typedef {'path'|'topic'|'mistakes'} LessonMode
 *
 * @typedef {Object} LessonItem
 * @property {string} gid
 * @property {boolean} retry true for the repeat at the end
 *
 * @typedef {Object} LessonResult
 * @property {string} gid
 * @property {boolean} correct
 * @property {number} score
 *
 * @typedef {Object} Lesson
 * @property {LessonMode} mode
 * @property {number} startedAt epoch ms
 * @property {LessonItem[]} queue grows by one retry item per wrong first attempt
 * @property {number} index current position in the queue
 * @property {LessonResult[]} results first attempts only
 * @property {LessonResult[]} retryResults
 */

/**
 * @param {{gids: string[], mode: LessonMode, now: () => number}} input
 * @returns {Lesson}
 */
export function startLesson({ gids, mode, now }) {
  return {
    mode,
    startedAt: now(),
    queue: gids.map((gid) => ({ gid, retry: false })),
    index: 0,
    results: [],
    retryResults: [],
  };
}

/**
 * @param {Lesson} lesson
 * @returns {LessonItem|null}
 */
export function currentItem(lesson) {
  return lesson.queue[lesson.index] ?? null;
}

/**
 * Records the grade for the current item. A wrong first attempt queues one retry at the end.
 * @param {Lesson} lesson
 * @param {{correct: boolean, score: number}} grade
 * @returns {Lesson}
 */
export function answerCurrent(lesson, grade) {
  const item = currentItem(lesson);
  if (!item) return lesson;
  const result = { gid: item.gid, correct: grade.correct, score: grade.score };
  if (item.retry) return { ...lesson, retryResults: [...lesson.retryResults, result] };
  return {
    ...lesson,
    results: [...lesson.results, result],
    queue: grade.correct ? lesson.queue : [...lesson.queue, { gid: item.gid, retry: true }],
  };
}

/**
 * @param {Lesson} lesson
 * @returns {Lesson}
 */
export function advance(lesson) {
  return { ...lesson, index: Math.min(lesson.index + 1, lesson.queue.length) };
}

/** @param {Lesson} lesson */
export const isFinished = (lesson) => lesson.index >= lesson.queue.length;

/**
 * @typedef {Object} LessonSummary
 * @property {LessonMode} mode
 * @property {number} total questions in the lesson (without retries)
 * @property {number} correctFirstTry
 * @property {boolean} perfect everything right on the first attempt
 * @property {string[]} wrong gids wrong on the first attempt
 * @property {number} durationMs
 */

/**
 * @param {Lesson} lesson
 * @param {() => number} now
 * @returns {LessonSummary}
 */
export function summarize(lesson, now) {
  const correctFirstTry = lesson.results.filter((r) => r.correct).length;
  return {
    mode: lesson.mode,
    total: lesson.results.length,
    correctFirstTry,
    perfect: lesson.results.length > 0 && correctFirstTry === lesson.results.length,
    wrong: lesson.results.filter((r) => !r.correct).map((r) => r.gid),
    durationMs: Math.max(0, now() - lesson.startedAt),
  };
}
