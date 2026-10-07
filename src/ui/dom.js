// Winziger DOM-Helfer. Texte immer als Textknoten – nie innerHTML mit Content.

/**
 * @typedef {Node|string|number|null|undefined|false} Child
 */

/**
 * Creates an element. `class` sets className, `onX` adds event listeners,
 * every other prop becomes an attribute (`true` → empty attribute, null/false → omitted).
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, any>|null} [props]
 * @param {...(Child|Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

/**
 * @param {Node} parent
 * @param {any[]} children nested arrays are flattened
 */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}
