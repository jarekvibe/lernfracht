// Klausur-Simulation (SPEC §4.6): Ziehung nach Themengewichtung, Scoring, Notenschlüssel.

import { gradeAnswer, maxPoints } from './grading.js';
import { shuffle } from './random.js';

/**
 * @typedef {{minPercent: number, grade: number, label: string}} GradeStep
 * @typedef {import('./content.js').Question & Record<string, any>} AnyQuestion
 * @typedef {AnyQuestion & {gid: string}} ExamQuestion
 */

/** IHK-Notenschlüssel (Default). Berufsschulen können per `exam.gradeScale` im Content abweichen. */
export const IHK_GRADE_SCALE = Object.freeze([
  { minPercent: 92, grade: 1, label: 'sehr gut' },
  { minPercent: 81, grade: 2, label: 'gut' },
  { minPercent: 67, grade: 3, label: 'befriedigend' },
  { minPercent: 50, grade: 4, label: 'ausreichend' },
  { minPercent: 30, grade: 5, label: 'mangelhaft' },
  { minPercent: 0, grade: 6, label: 'ungenügend' },
]);

/**
 * Grade for a percentage. Steps are inclusive at their lower bound (81 → 2, 80.99 → 3).
 * ASSUMPTION: Ohne Runden – 80,99 % sind eine 3. Rundet eure Schule, lässt sich das über
 * `exam.gradeScale` im Content abbilden (offene Frage SPEC §14.2).
 * @param {number} percent 0–100
 * @param {readonly GradeStep[]} [scale] sorted from best to worst
 * @returns {GradeStep}
 */
export function gradeForPercent(percent, scale = IHK_GRADE_SCALE) {
  return scale.find((step) => percent >= step.minPercent) ?? scale[scale.length - 1];
}

/**
 * How many questions per topic: proportional to the weights (largest remainder method).
 * @param {Record<string, number>} weights
 * @param {number} count
 * @returns {Record<string, number>}
 */
export function topicQuotas(weights, count) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total === 0) return {};
  const raw = entries.map(([topic, w], index) => ({ topic, index, exact: (count * w) / total }));
  /** @type {Record<string, number>} */
  const quotas = Object.fromEntries(raw.map((r) => [r.topic, Math.floor(r.exact)]));
  let left = count - Object.values(quotas).reduce((a, b) => a + b, 0);
  const byRemainder = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || a.index - b.index);
  for (const r of byRemainder) {
    if (left <= 0) break;
    quotas[r.topic] += 1;
    left -= 1;
  }
  return quotas;
}

/**
 * Draws the exam: per topic as many questions as its weight allows, chosen at random, every
 * question at most once, at most `maxOpen` free-text questions. If a topic runs short, the
 * missing places go to the other topics (highest weight first).
 * ASSUMPTION: Die Fragen erscheinen nach Themen sortiert (Pfad-Reihenfolge), innerhalb eines
 * Themas zufällig – wie eine Klausur, die Thema für Thema abfragt.
 * @param {Object} input
 * @param {ExamQuestion[]} input.questions all questions of the unit in path order
 * @param {{questionCount: number, maxOpenQuestions: number, topicWeights: Record<string, number>}} input.config
 * @param {() => number} input.rng
 * @returns {string[]} gids
 */
export function drawExam({ questions, config, rng }) {
  const quotas = topicQuotas(config.topicWeights, config.questionCount);
  const topicOrder = [...new Set(questions.map((q) => q.topic))];
  /** @type {Map<string, ExamQuestion[]>} shuffled pool per topic */
  const pools = new Map(topicOrder.map((t) => [t, shuffle(questions.filter((q) => q.topic === t), rng)]));
  /** @type {Map<string, ExamQuestion[]>} */
  const picked = new Map(topicOrder.map((t) => [t, []]));
  let open = 0;
  let total = 0;

  /** Takes the next allowed question of a topic; false when the topic has none left. */
  const takeFrom = (/** @type {string} */ topic) => {
    const pool = pools.get(topic) ?? [];
    const index = pool.findIndex((q) => q.type !== 'open' || open < config.maxOpenQuestions);
    if (index === -1) return false;
    const [q] = pool.splice(index, 1);
    if (q.type === 'open') open += 1;
    /** @type {ExamQuestion[]} */ (picked.get(topic)).push(q);
    total += 1;
    return true;
  };

  for (const topic of topicOrder) {
    for (let i = 0; i < (quotas[topic] ?? 0); i += 1) {
      if (!takeFrom(topic)) break;
    }
  }

  // Fehlende Plätze auffüllen: Themen mit hohem Gewicht zuerst, reihum.
  const fillOrder = topicOrder
    .filter((t) => (config.topicWeights[t] ?? 0) > 0)
    .sort((a, b) => config.topicWeights[b] - config.topicWeights[a] || topicOrder.indexOf(a) - topicOrder.indexOf(b));
  let progress = true;
  while (total < config.questionCount && progress) {
    progress = false;
    for (const topic of fillOrder) {
      if (total >= config.questionCount) break;
      if (takeFrom(topic)) progress = true;
    }
  }

  return topicOrder.flatMap((t) => (picked.get(t) ?? []).map((q) => q.gid));
}

/**
 * @typedef {Object} ExamItem
 * @property {string} gid
 * @property {string} topic
 * @property {boolean} answered
 * @property {import('./grading.js').Grade} grade
 *
 * @typedef {Object} ExamResult
 * @property {ExamItem[]} items
 * @property {number} points
 * @property {number} maxPoints
 * @property {number} percent 0–100
 * @property {GradeStep} grade
 * @property {Record<string, {points: number, maxPoints: number}>} perTopic
 * @property {string[]} wrong gids not fully correct (incl. unanswered)
 */

/** @param {number} n */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Scores a finished exam. Unanswered questions give 0 points.
 * @param {Object} input
 * @param {ExamQuestion[]} input.questions in exam order
 * @param {Record<string, any>} input.answers gid → answer in the shape gradeAnswer() expects; missing = unanswered
 * @param {readonly GradeStep[]} [input.scale]
 * @returns {ExamResult}
 */
export function scoreExam({ questions, answers, scale = IHK_GRADE_SCALE }) {
  /** @type {Record<string, {points: number, maxPoints: number}>} */
  const perTopic = {};
  const items = questions.map((q) => {
    const answered = Object.prototype.hasOwnProperty.call(answers, q.gid) && answers[q.gid] !== null && answers[q.gid] !== undefined;
    const grade = answered
      ? gradeAnswer(q, answers[q.gid])
      : { correct: false, score: 0, points: 0, maxPoints: maxPoints(q) };
    const t = (perTopic[q.topic] ??= { points: 0, maxPoints: 0 });
    t.points = round2(t.points + grade.points);
    t.maxPoints = round2(t.maxPoints + grade.maxPoints);
    return { gid: q.gid, topic: q.topic, answered, grade };
  });
  const points = round2(items.reduce((sum, i) => sum + i.grade.points, 0));
  const max = round2(items.reduce((sum, i) => sum + i.grade.maxPoints, 0));
  const percent = max > 0 ? (points / max) * 100 : 0;
  return {
    items,
    points,
    maxPoints: max,
    percent,
    grade: gradeForPercent(percent, scale),
    perTopic,
    wrong: items.filter((i) => !i.grade.correct).map((i) => i.gid),
  };
}

/**
 * XP for an exam simulation: round(percent / 2), +10 from 50 %.
 * @param {number} percent
 */
export function examXp(percent) {
  return Math.round(percent / 2) + (percent >= 50 ? 10 : 0);
}
