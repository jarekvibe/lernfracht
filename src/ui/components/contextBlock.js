import { h } from '../dom.js';

/** Zellen wie „1.280.000 €“ oder „12“ rechtsbündig mit Tabellenziffern. */
const NUMERIC_CELL_RE = /^[\s\d.,€%+\-−]*\d[\s\d.,€%+\-−]*$/;

/**
 * Context above the prompt: a paragraph and/or a horizontally scrollable table.
 * @param {{text?: string, table?: {headers: string[], rows: string[][]}}} context
 */
export function contextBlock(context) {
  const table = context.table;
  return h(
    'figure',
    { class: 'context' },
    context.text && h('p', { class: 'context-text' }, context.text),
    table &&
      h(
        'div',
        { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Tabelle (seitlich scrollbar)' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, table.headers.map((cell) => h('th', { scope: 'col' }, cell)))),
          h(
            'tbody',
            null,
            table.rows.map((row) =>
              h('tr', null, row.map((cell) => h('td', { class: NUMERIC_CELL_RE.test(cell) ? 'num' : null }, cell))),
            ),
          ),
        ),
      ),
  );
}
