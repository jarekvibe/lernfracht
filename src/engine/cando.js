// Kann-Liste (SPEC §4.7): Selbsteinschätzung je „Ich kann …“-Satz und Abgleich mit der Mastery.

import { globalQuestionId } from './content.js';
import { mastery } from './mastery.js';

/** Stufen der Selbsteinschätzung, von sicher nach unsicher; `level` = gefühlte Sicherheit 0–1. */
export const SELF_LEVELS = Object.freeze([
  { id: 'sehr_sicher', label: 'sehr sicher', level: 1 },
  { id: 'ziemlich_sicher', label: 'ziemlich sicher', level: 2 / 3 },
  { id: 'unsicher', label: 'unsicher', level: 1 / 3 },
  { id: 'sehr_unsicher', label: 'sehr unsicher', level: 0 },
]);

/** Ab diesem Abstand zwischen Gefühl und Mastery gibt es einen Hinweis. */
export const GAP_THRESHOLD = 0.5;

/**
 * Key in `state.selfAssessment`, e.g. `lf14-2/abc.c1`.
 * @param {string} unitId
 * @param {string} canDoId
 */
export const selfAssessmentKey = (unitId, canDoId) => `${unitId}/${canDoId}`;

/**
 * Global ids of the questions linked to a canDo line.
 * @param {string} unitId
 * @param {{questionIds: string[]}} canDo
 */
export const canDoGids = (unitId, canDo) => canDo.questionIds.map((id) => globalQuestionId(unitId, id));

/**
 * Compares the learner's feeling with the mastery of the linked questions.
 * ASSUMPTION: „Stark auseinander“ = Abstand ≥ 0,5 zwischen gefühlter Sicherheit (1 / ⅔ / ⅓ / 0)
 * und Mastery-Anteil (Box ≥ 4).
 * @param {{questionIds: string[]}} canDo
 * @param {string} unitId
 * @param {Record<string, import('./scheduler.js').Card>} cards
 * @param {string|undefined} self id from SELF_LEVELS
 * @returns {{mastered: number, total: number, ratio: number, gap: 'over'|'under'|null, message: string|null}}
 */
export function canDoStatus(canDo, unitId, cards, self) {
  const m = mastery(canDoGids(unitId, canDo).map((gid) => ({ gid })), cards);
  const level = SELF_LEVELS.find((s) => s.id === self)?.level;
  /** @type {'over'|'under'|null} */
  let gap = null;
  let message = null;
  if (level !== undefined && level - m.ratio >= GAP_THRESHOLD) {
    gap = 'over';
    const open = m.total - m.mastered;
    message = `Du fühlst dich sicher, aber ${open} von ${m.total} ${m.total === 1 ? 'Frage sitzt' : 'Fragen sitzen'} noch nicht.`;
  } else if (level !== undefined && m.ratio - level >= GAP_THRESHOLD) {
    gap = 'under';
    message = `Du bist unsicher – dabei ${m.mastered === 1 ? 'sitzt' : 'sitzen'} schon ${m.mastered} von ${m.total} Fragen.`;
  }
  return { mastered: m.mastered, total: m.total, ratio: m.ratio, gap, message };
}
