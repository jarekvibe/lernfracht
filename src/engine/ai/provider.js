// KI-Schicht (SPEC §5): Die UI kennt nur dieses Interface. Phase 1 nutzt LocalProvider (local.js),
// Phase 2 einen Provider, der über einen Server-Proxy die Claude API anspricht.

/**
 * @typedef {Object} GradeResult
 * @property {number} points
 * @property {number} maxPoints
 * @property {{criterion: string, met: boolean, comment?: string}[]} criteria
 * @property {string} feedback
 * @property {'self'|'ai'} source
 */

/**
 * @typedef {Object} GradeContext
 * @property {boolean[]} [selfAssessment] criteria the learner ticked (one per rubric criterion)
 */

/**
 * ASSUMPTION: gradeOpenAnswer bekommt optional einen dritten Parameter `context` mit der
 * Selbstbewertung aus der UI. Der LocalProvider braucht sie; ein KI-Provider kann sie ignorieren.
 *
 * @typedef {Object} AiProvider
 * @property {(question: object, answerText: string, context?: GradeContext) => Promise<GradeResult>} gradeOpenAnswer
 * @property {(question: object, userAnswer: unknown) => Promise<string|null>} explainMistake
 */

/**
 * @param {unknown} value
 * @returns {value is AiProvider}
 */
export function isAiProvider(value) {
  const p = /** @type {Record<string, unknown>} */ (value);
  return typeof value === 'object' && value !== null
    && typeof p.gradeOpenAnswer === 'function'
    && typeof p.explainMistake === 'function';
}
