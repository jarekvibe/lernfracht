// Ein Renderer je Fragetyp. Alle liefern dieselbe Schnittstelle an questionView.

import { categorizeRenderer } from './categorize.js';
import { choiceRenderer } from './choice.js';
import { clozeRenderer } from './cloze.js';
import { numericRenderer } from './numeric.js';
import { openRenderer } from './open.js';
import { orderRenderer } from './order.js';

/**
 * @typedef {Object} RendererDeps
 * @property {() => void} onChange call whenever completeness or the primary label may have changed
 * @property {string} promptId id of the prompt heading (for aria-labelledby)
 *
 * @typedef {Object} Renderer
 * @property {HTMLElement} el
 * @property {() => boolean} isComplete may the primary button be pressed?
 * @property {() => any} getAnswer answer in the shape gradeAnswer() expects
 * @property {(grade: import('../../../engine/grading.js').Grade) => void} reveal lock inputs, mark right/wrong
 * @property {(digit: number) => boolean} [onDigit] keys 1–9; true if handled
 * @property {() => string|null} [validate] error message instead of grading (e.g. not a number)
 * @property {(message: string) => void} [showError]
 * @property {() => boolean} [advance] multi-step questions consume the primary press (true) before grading
 * @property {() => string} [primaryLabel]
 *
 * @typedef {import('../../../engine/content.js').Question & Record<string, any>} AnyQuestion
 */

/**
 * @param {AnyQuestion} question
 * @param {import('../../../engine/present.js').Presentation} presentation
 * @param {RendererDeps} deps
 * @returns {Renderer}
 */
export function createRenderer(question, presentation, deps) {
  switch (question.type) {
    case 'single':
    case 'multi':
    case 'truefalse':
      return choiceRenderer(question, presentation, deps);
    case 'categorize':
      return categorizeRenderer(question, presentation, deps);
    case 'order':
      return orderRenderer(question, presentation, deps);
    case 'cloze':
      return clozeRenderer(question, presentation, deps);
    case 'numeric':
      return numericRenderer(question, presentation, deps);
    case 'open':
      return openRenderer(question, presentation, deps);
    default:
      throw new TypeError(`Unbekannter Fragetyp: ${question.type}`);
  }
}
