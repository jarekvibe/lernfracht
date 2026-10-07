// Fortschrittsring (SVG). Farbe über Klassen: is-green · is-yellow · is-red · is-done.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {Object} options
 * @param {number} options.ratio 0–1
 * @param {number} [options.size]
 * @param {number} [options.stroke]
 * @param {string} [options.className]
 * @param {string} [options.label] accessible name; without it the ring is decorative
 * @returns {SVGSVGElement}
 */
export function progressRing({ ratio, size = 56, stroke = 6, className = '', label }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `ring ${className}`.trim());
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  /** @param {string} cls */
  const circle = (cls) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(size / 2));
    c.setAttribute('cy', String(size / 2));
    c.setAttribute('r', String(r));
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke-width', String(stroke));
    c.setAttribute('class', cls);
    return c;
  };
  const value = circle('ring-value');
  value.setAttribute('stroke-dasharray', String(circumference));
  value.setAttribute('stroke-dashoffset', String(circumference * (1 - clamped)));
  value.setAttribute('stroke-linecap', 'round');
  value.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  svg.append(circle('ring-track'), value);
  return svg;
}
