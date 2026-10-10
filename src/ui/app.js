// App-Shell: Routen, Bottom-Navigation, Hinweise. Screens liefern nur DOM-Knoten.

import { h } from './dom.js';
import { createRouter, isDebugEnabled } from './router.js';
import { bottomNav } from './components/bottomNav.js';
import { emptyState } from './components/emptyState.js';
import { icon } from './components/icon.js';
import * as about from './screens/about.js';
import * as cando from './screens/cando.js';
import * as debug from './screens/debug.js';
import * as exam from './screens/exam.js';
import * as examRun from './screens/examRun.js';
import * as home from './screens/home.js';
import * as league from './screens/league.js';
import * as lesson from './screens/lesson.js';
import * as mistakes from './screens/mistakes.js';
import * as onboarding from './screens/onboarding.js';
import * as profile from './screens/profile.js';
import * as result from './screens/result.js';
import * as settings from './screens/settings.js';

/**
 * @typedef {import('../engine/storage.js').AppState} AppState
 *
 * @typedef {Object} ScreenContext
 * @property {ReturnType<typeof import('../store.js').createStore<AppState>>} store
 * @property {ReturnType<typeof import('../engine/content.js').createCatalog>} catalog
 * @property {Record<string, string>} params route params, e.g. `unitId`
 * @property {Record<string, string>} query hash query
 * @property {boolean} debug
 * @property {string} version
 * @property {(path: string, options?: {replace?: boolean}) => void} navigate
 * @property {(fn: () => void) => void} onCleanup runs when the screen is left
 * @property {(notice: Notice) => void} notify
 * @property {import('../engine/ai/provider.js').AiProvider} ai
 * @property {() => number} now the app clock (epoch ms)
 * @property {(next: AppState) => void} replaceState swaps the whole state (import/reset), runs the
 *   daily maintenance and writes immediately
 *
 * @typedef {Object} Notice
 * @property {string} text
 * @property {'info'|'error'} [tone]
 *
 * @typedef {Object} RouteDef
 * @property {string} path
 * @property {string} title
 * @property {(ctx: ScreenContext) => Node|Node[]|(Node|Node[])[]} render
 * @property {string} [tab] active bottom-nav tab; without it the tab bar is hidden
 * @property {boolean} [debugOnly]
 */

/** @type {RouteDef[]} */
export const ROUTES = [
  { path: '/home', title: 'Lernen', render: home.render, tab: 'learn' },
  { path: '/cando/:unitId', title: 'Kann-Liste', render: cando.render, tab: 'learn' },
  { path: '/mistakes', title: 'Fehlerkiste', render: mistakes.render, tab: 'mistakes' },
  { path: '/exam', title: 'Klausur', render: exam.render, tab: 'exam' },
  { path: '/exam/run', title: 'Klausur-Simulation', render: examRun.render },
  { path: '/league', title: 'Liga', render: league.render, tab: 'league' },
  { path: '/profile', title: 'Profil', render: profile.render, tab: 'profile' },
  { path: '/settings', title: 'Einstellungen', render: settings.render, tab: 'profile' },
  { path: '/about', title: 'Über & Datenschutz', render: about.render, tab: 'profile' },
  { path: '/onboarding', title: 'Willkommen', render: onboarding.render },
  { path: '/lesson', title: 'Lektion', render: lesson.render },
  { path: '/result', title: 'Ergebnis', render: result.render },
  { path: '/debug/questions', title: 'Debug', render: debug.render, debugOnly: true },
];

/**
 * @param {Object} deps
 * @param {HTMLElement} deps.root
 * @param {ScreenContext['store']} deps.store
 * @param {ScreenContext['catalog']} deps.catalog
 * @param {string} deps.version
 * @param {import('../engine/ai/provider.js').AiProvider} deps.ai
 * @param {() => number} deps.now
 * @param {ScreenContext['replaceState']} deps.replaceState
 * @param {Window} [deps.win]
 */
export function createApp({ root, store, catalog, version, ai, now, replaceState, win = window }) {
  const notices = h('div', { class: 'notices', 'aria-live': 'polite' });
  const main = h('main', { id: 'main' });
  const nav = bottomNav();
  const shell = h('div', { class: 'shell' }, notices, main, nav.el);
  root.replaceChildren(shell);

  /** @type {(() => void)[]} */
  let cleanups = [];
  let firstRender = true;

  /** @param {Notice} notice */
  function notify({ text, tone = 'info' }) {
    const el = h(
      'div',
      { class: `notice${tone === 'error' ? ' is-error' : ''}` },
      h('p', null, text),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Hinweis schließen', onClick: () => el.remove() }, icon('close')),
    );
    notices.append(el);
  }

  /** @param {{route: RouteDef, params: Record<string, string>, query: Record<string, string>}} match */
  function onRoute({ route, params, query }) {
    const debugEnabled = isDebugEnabled(win.location.search, query);
    if (route.debugOnly && !debugEnabled) {
      router.navigate('/home', { replace: true });
      return;
    }

    for (const fn of cleanups) fn();
    cleanups = [];

    /** @type {ScreenContext} */
    const ctx = {
      store,
      catalog,
      params,
      query,
      debug: debugEnabled,
      version,
      navigate: router.navigate,
      onCleanup: (fn) => cleanups.push(fn),
      notify,
      ai,
      now,
      replaceState,
    };

    let view;
    try {
      view = route.render(ctx);
    } catch (error) {
      console.error(error);
      view = [
        h('h1', { class: 'visually-hidden', tabindex: '-1' }, 'Fehler'),
        emptyState({
          icon: '🚧',
          title: 'Da ist was schiefgelaufen',
          text: 'Dieser Bildschirm konnte nicht geladen werden.',
          action: h('a', { class: 'btn btn-secondary', href: '#/home' }, 'Zum Lernpfad'),
        }),
      ];
    }
    main.replaceChildren(h('div', { class: firstRender ? 'screen' : 'screen is-entering' }, view));

    const hasTabs = route.tab !== undefined;
    nav.el.hidden = !hasTabs;
    shell.classList.toggle('has-tabs', hasTabs);
    nav.setActive(route.tab ?? null);
    win.document.title = route.path === '/home' ? 'Lernfracht' : `${route.title} · Lernfracht`;

    if (!firstRender) {
      win.scrollTo(0, 0);
      /** @type {HTMLElement|null} */ (main.querySelector('h1'))?.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  const router = createRouter({ routes: ROUTES, onRoute, win });

  return {
    start: () => router.start(),
    notify,
  };
}
