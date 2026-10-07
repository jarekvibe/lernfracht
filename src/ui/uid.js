// Eindeutige DOM-IDs (für aria-labelledby & Co.).
let counter = 0;

/** @param {string} prefix */
export function uid(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}
