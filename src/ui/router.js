// Kleiner Hash-Router (`#/home`, `#/cando/lf14-2`, `#/debug/questions?debug=1`).
// parseHash() und matchRoute() sind DOM-frei und getestet.

export const DEFAULT_PATH = '/home';

/**
 * @typedef {Object} ParsedHash
 * @property {string} path normalized, always starts with `/`, no trailing slash
 * @property {Record<string, string>} query
 */

/**
 * @param {string} hash e.g. `#/debug/questions?debug=1`
 * @returns {ParsedHash}
 */
export function parseHash(hash) {
  const raw = hash.replace(/^#/, '');
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const segments = pathPart.split('/').filter(Boolean);
  return {
    path: segments.length ? `/${segments.join('/')}` : '',
    query: Object.fromEntries(new URLSearchParams(queryPart)),
  };
}

/**
 * Finds the first route whose pattern (e.g. `/cando/:unitId`) matches the path.
 * @template {{path: string}} R
 * @param {R[]} routes
 * @param {string} path
 * @returns {{route: R, params: Record<string, string>}|null}
 */
export function matchRoute(routes, path) {
  const segments = path.split('/').filter(Boolean);
  for (const route of routes) {
    const parts = route.path.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    const ok = parts.every((part, i) => {
      if (part.startsWith(':')) {
        try {
          params[part.slice(1)] = decodeURIComponent(segments[i]);
        } catch {
          return false;
        }
        return true;
      }
      return part === segments[i];
    });
    if (ok) return { route, params };
  }
  return null;
}

/**
 * Debug views need `?debug=1`, either in the page URL or in the hash query.
 * @param {string} search `location.search`
 * @param {Record<string, string>} hashQuery
 */
export function isDebugEnabled(search, hashQuery) {
  return new URLSearchParams(search).get('debug') === '1' || hashQuery.debug === '1';
}

/**
 * @template {{path: string}} R
 * @param {Object} options
 * @param {R[]} options.routes
 * @param {(match: {route: R, params: Record<string, string>, query: Record<string, string>, path: string}) => void} options.onRoute
 * @param {Window} [options.win]
 */
export function createRouter({ routes, onRoute, win = window }) {
  function resolve() {
    const { path, query } = parseHash(win.location.hash);
    const match = path ? matchRoute(routes, path) : null;
    if (!match) {
      navigate(DEFAULT_PATH, { replace: true });
      return;
    }
    onRoute({ ...match, query, path });
  }

  /**
   * @param {string} path
   * @param {{replace?: boolean}} [options]
   */
  function navigate(path, { replace = false } = {}) {
    const hash = `#${path}`;
    // Hash-Wechsel lösen `hashchange` aus, das resolve() aufruft (auch unter file://).
    if (win.location.hash === hash) resolve();
    else if (replace) win.location.replace(hash);
    else win.location.hash = hash;
  }

  return {
    start() {
      win.addEventListener('hashchange', resolve);
      resolve();
    },
    navigate,
  };
}
