// LocalProvider (Phase 1): keine KI, keine Requests. Bewertung = Selbstbewertung der Lernenden,
// Erklärung = `explanation` aus dem Content.

/**
 * @returns {import('./provider.js').AiProvider}
 */
export function createLocalProvider() {
  return {
    async gradeOpenAnswer(question, _answerText, context = {}) {
      const q = /** @type {{rubric: {criterion: string, points: number}[]}} */ (question);
      const met = context.selfAssessment ?? [];
      const criteria = q.rubric.map((r, i) => ({ criterion: r.criterion, met: Boolean(met[i]) }));
      return {
        points: q.rubric.reduce((sum, r, i) => sum + (criteria[i].met ? r.points : 0), 0),
        maxPoints: q.rubric.reduce((sum, r) => sum + r.points, 0),
        criteria,
        feedback: '',
        source: 'self',
      };
    },
    async explainMistake(question) {
      const explanation = /** @type {{explanation?: unknown}} */ (question).explanation;
      return typeof explanation === 'string' ? explanation : null;
    },
  };
}
