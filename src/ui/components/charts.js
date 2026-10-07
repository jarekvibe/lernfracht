// Kleine Diagramme ohne Bibliothek (SPEC §4.10): XP der letzten 14 Tage und Streak-Kalender.
// Eine Datenreihe → keine Legende, der Titel sagt, was gezeigt wird. Werte stehen zusätzlich
// in Tooltip und Tabelle, die Farbe trägt nie allein Information.

import { h } from '../dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 */
function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** @param {string} date `YYYY-MM-DD` */
const weekday = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
};
/** @param {string} date */
const shortDate = (date) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`;

/**
 * Tooltip inside a chart wrapper: value first, label second.
 * @param {HTMLElement} wrap
 */
function tooltip(wrap) {
  const value = h('strong');
  const label = h('span');
  const tip = h('div', { class: 'chart-tip', hidden: true, 'aria-hidden': 'true' }, value, label);
  wrap.append(tip);
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  return {
    /** @param {string} v @param {string} l @param {number} xPercent @param {number} yPx */
    show(v, l, xPercent, yPx) {
      clearTimeout(timer);
      value.textContent = v;
      label.textContent = l;
      tip.hidden = false;
      tip.style.left = `${Math.min(88, Math.max(12, xPercent))}%`;
      tip.style.top = `${yPx}px`;
    },
    /**
     * Touch meldet pointerleave direkt nach dem Antippen – dann bleibt der Tooltip kurz stehen.
     * @param {Event} [event]
     */
    hide(event) {
      clearTimeout(timer);
      if (event && /** @type {PointerEvent} */ (event).pointerType === 'touch') timer = setTimeout(() => { tip.hidden = true; }, 2500);
      else tip.hidden = true;
    },
  };
}

/**
 * Column chart: XP per day, goal as a reference line, today and the best day labelled.
 * @param {{date: string, xp: number}[]} series oldest first
 * @param {number} goal daily goal in XP
 * @param {string} today
 * @returns {HTMLElement}
 */
export function xpChart(series, goal, today) {
  const W = 340;
  const H = 170;
  const top = 22;
  const bottom = 24;
  const plotH = H - top - bottom;
  const maxXp = Math.max(goal, ...series.map((d) => d.xp));
  const yMax = Math.ceil((maxXp * 1.1) / 10) * 10;
  const slot = W / series.length;
  const barW = Math.min(16, slot - 6);
  const y = (/** @type {number} */ v) => top + plotH - (v / yMax) * plotH;
  const best = series.reduce((a, b) => (b.xp > a.xp ? b : a), series[0]);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `XP der letzten ${series.length} Tage, Tagesziel ${goal} XP` });
  // Grundlinie und Ziellinie: Haarlinien, zurückhaltend
  root.append(svg('line', { x1: 0, x2: W, y1: top + plotH, y2: top + plotH, class: 'chart-axis' }));
  root.append(svg('line', { x1: 0, x2: W, y1: y(goal), y2: y(goal), class: 'chart-goal' }));
  const goalLabel = svg('text', { x: W - 2, y: y(goal) - 5, 'text-anchor': 'end', class: 'chart-note' });
  goalLabel.textContent = `Ziel ${goal}`;
  root.append(goalLabel);

  const wrap = h('div', { class: 'chart-wrap' });
  const tip = tooltip(wrap);
  /** @type {SVGElement[]} */
  const bars = [];

  series.forEach((d, i) => {
    const cx = slot * i + slot / 2;
    const x = cx - barW / 2;
    if (d.xp > 0) {
      const yTop = y(d.xp);
      const r = Math.min(4, (top + plotH - yTop) / 2);
      // 4 px gerundetes Datenende, gerade an der Grundlinie
      const path = svg('path', {
        d: `M${x},${top + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${top + plotH} Z`,
        class: 'chart-bar',
      });
      bars[i] = path;
      root.append(path);
      if (d.date === today || d === best) {
        const label = svg('text', { x: cx, y: yTop - 5, 'text-anchor': 'middle', class: 'chart-value' });
        label.textContent = String(d.xp);
        root.append(label);
      }
    }
    const day = svg('text', { x: cx, y: H - 7, 'text-anchor': 'middle', class: `chart-day${d.date === today ? ' is-today' : ''}` });
    day.textContent = d.date === today ? 'heute' : weekday(d.date);
    root.append(day);

    // Trefferfläche: die ganze Spalte, per Tastatur erreichbar
    const hit = svg('rect', { x: slot * i, y: 0, width: slot, height: H, class: 'chart-hit', tabindex: 0, 'aria-label': `${weekday(d.date)} ${shortDate(d.date)}: ${d.xp} XP` });
    const show = () => {
      bars[i]?.classList.add('is-hover');
      const yTop = d.xp > 0 ? y(d.xp) : top + plotH;
      tip.show(`${d.xp} XP`, `${weekday(d.date)}, ${shortDate(d.date)}`, (cx / W) * 100, (yTop / H) * wrap.clientHeight);
    };
    const hide = (/** @type {Event} */ event) => {
      bars[i]?.classList.remove('is-hover');
      tip.hide(event);
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
    root.append(hit);
  });

  wrap.prepend(root);
  return h(
    'figure',
    { class: 'chart-figure' },
    wrap,
    h(
      'details',
      { class: 'chart-table' },
      h('summary', null, 'Als Tabelle'),
      h(
        'table',
        null,
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Tag'), h('th', { scope: 'col', class: 'num' }, 'XP'))),
        h('tbody', null, series.map((d) => h('tr', null, h('td', null, `${weekday(d.date)}, ${shortDate(d.date)}`), h('td', { class: 'num' }, String(d.xp))))),
      ),
    ),
  );
}

/**
 * Streak calendar: weeks as columns (oldest left), Monday on top.
 * Intensity: XP compared with the daily goal (½ · 1 · 2×); bridged days get a ring.
 * ASSUMPTION: Die Stufen richten sich nach dem aktuellen Tagesziel, nicht nach dem Ziel am jeweiligen Tag.
 * @param {import('../../engine/stats.js').HeatCell[][]} weeks
 * @param {number} goal
 * @returns {HTMLElement}
 */
export function streakCalendar(weeks, goal) {
  /** @param {import('../../engine/stats.js').HeatCell} c */
  const level = (c) => {
    if (!c.active) return 0;
    if (c.xp >= goal * 2) return 4;
    if (c.xp >= goal) return 3;
    if (c.xp >= goal / 2) return 2;
    return 1;
  };
  const cells = weeks.flat();
  const active = cells.filter((c) => !c.future && c.active).length;
  const days = cells.filter((c) => !c.future).length;

  const grid = h(
    'div',
    { class: 'heat-grid', 'aria-hidden': 'true' },
    ['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((label, row) => h('span', { class: 'heat-day', style: `grid-row:${row + 1}` }, label)),
    weeks.map((week, col) =>
      week.map((c, row) =>
        h('span', {
          class: `heat-cell level-${level(c)}${c.frozen ? ' is-frozen' : ''}${c.today ? ' is-today' : ''}${c.future ? ' is-future' : ''}`,
          style: `grid-column:${col + 2};grid-row:${row + 1}`,
          'data-tip': c.future ? '' : `${shortDate(c.date)}: ${c.frozen ? 'Streak-Freeze' : c.active ? `${c.xp} XP` : 'kein Lerntag'}`,
        }),
      ),
    ),
  );
  const wrap = h('div', { class: 'chart-wrap heat-wrap' }, grid);
  const tip = tooltip(wrap);
  grid.addEventListener('pointerover', (event) => {
    const cell = /** @type {HTMLElement} */ (event.target);
    const text = cell.dataset?.tip;
    if (!text) {
      tip.hide();
      return;
    }
    const box = cell.getBoundingClientRect();
    const outer = wrap.getBoundingClientRect();
    const [label, ...rest] = text.split(': ');
    tip.show(rest.join(': '), label, ((box.left + box.width / 2 - outer.left) / outer.width) * 100, box.top - outer.top);
  });
  grid.addEventListener('pointerleave', (event) => tip.hide(event));

  return h(
    'figure',
    { class: 'chart-figure' },
    h('p', { class: 'visually-hidden' }, `In den letzten 12 Wochen an ${active} von ${days} Tagen gelernt.`),
    wrap,
    h(
      'figcaption',
      { class: 'heat-legend' },
      h('span', null, 'weniger'),
      [0, 1, 2, 3, 4].map((l) => h('span', { class: `heat-cell level-${l}`, 'aria-hidden': 'true' })),
      h('span', null, 'mehr'),
      h('span', { class: 'heat-cell is-frozen level-0', 'aria-hidden': 'true' }),
      h('span', null, 'Freeze'),
    ),
  );
}
