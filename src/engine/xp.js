// XP und Tagesziel (SPEC §4.8).

export const XP_RULES = Object.freeze({
  correct: 10,
  correctHard: 15, // Schwierigkeit 3
  mistakeCorrect: 5,
  openFactor: 20, // open: Rubrik-Anteil × 20
  sessionComplete: 10,
  perfectSession: 10,
});

/** Tagesziele aus dem Onboarding. */
export const DAILY_GOALS = Object.freeze([
  { xp: 30, label: 'Chill', hint: 'locker bleiben' },
  { xp: 60, label: 'Solide', hint: 'jeden Tag ein Stück' },
  { xp: 100, label: 'Ehrgeizig', hint: 'zieht ordentlich an' },
  { xp: 150, label: 'Prüfungsmodus', hint: 'volle Ladung' },
]);

/** Diese Typen geben bei Teilpunkten anteilig XP. */
const PARTIAL_TYPES = new Set(['categorize', 'cloze', 'order', 'multi']);

/**
 * XP for one answer.
 * ASSUMPTION: In „Fehler üben“ gibt es 5 XP nur für ganz richtige Antworten, keine Teil-XP.
 * @param {{type: string, difficulty: number}} question
 * @param {{correct: boolean, score: number}} grade
 * @param {{mode: string, retry?: boolean}} context
 * @returns {number}
 */
export function xpForAnswer(question, grade, { mode, retry = false }) {
  if (retry) return 0;
  if (mode === 'mistakes') return grade.correct ? XP_RULES.mistakeCorrect : 0;
  if (question.type === 'open') return Math.round(grade.score * XP_RULES.openFactor);
  const base = question.difficulty >= 3 ? XP_RULES.correctHard : XP_RULES.correct;
  if (grade.correct) return base;
  return PARTIAL_TYPES.has(question.type) ? Math.round(grade.score * base) : 0;
}

/**
 * Bonus for finishing a lesson: +10, perfect (all right on the first attempt) +10 more.
 * ASSUMPTION: Gilt auch für „Thema üben“ und „Fehler üben“.
 * @param {{total: number, perfect: boolean}} summary
 */
export function xpForSession(summary) {
  if (summary.total === 0) return 0;
  return XP_RULES.sessionComplete + (summary.perfect ? XP_RULES.perfectSession : 0);
}
