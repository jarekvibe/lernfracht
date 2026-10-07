// Bootstrap: Inhalte laden, Zustand laden, Store + Persistenz + Theme verdrahten, Router starten.
// Hier (und nur hier) wird die echte Uhr gewählt; die Engine bekommt sie injiziert.

import { createCatalog } from './engine/content.js';
import { createStorage } from './engine/storage.js';
import { createStore } from './store.js';
import { createApp } from './ui/app.js';
import { h } from './ui/dom.js';
import { emptyState } from './ui/components/emptyState.js';
import { getBrowserBackend, readEmbeddedUnits } from './ui/platform.js';
import { createThemeController } from './ui/theme.js';

/* global __APP_VERSION__ */
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const now = () => Date.now();

/**
 * @param {import('./engine/storage.js').LoadResult['notice']} notice
 * @returns {import('./ui/app.js').Notice|null}
 */
function storageNotice(notice) {
  switch (notice?.code) {
    case 'corrupt':
      return notice.backupKey
        ? { tone: 'error', text: 'Dein gespeicherter Fortschritt war beschädigt. Wir haben eine Sicherung angelegt und neu gestartet.' }
        : { tone: 'error', text: 'Dein gespeicherter Fortschritt ist beschädigt und ließ sich nicht sichern. Speichern ist pausiert, damit nichts verloren geht.' };
    case 'newer':
      return { tone: 'error', text: 'Dein Fortschritt stammt aus einer neueren Lernfracht-Version. Öffne die aktuelle Version – hier wird nichts gespeichert.' };
    case 'unavailable':
      return { tone: 'error', text: 'Speichern ist in diesem Browser blockiert. Dein Fortschritt geht beim Schließen verloren.' };
    default:
      return null;
  }
}

function boot() {
  const root = /** @type {HTMLElement} */ (document.getElementById('app'));

  let units = [];
  try {
    units = readEmbeddedUnits(document);
  } catch (error) {
    console.error(error);
  }
  if (units.length === 0) {
    root.replaceChildren(
      h(
        'div',
        { class: 'screen' },
        h('h1', { class: 'visually-hidden' }, 'Fehler'),
        emptyState({ icon: '📭', title: 'Inhalte fehlen', text: 'Die Datei ist unvollständig. Lade Lernfracht bitte neu herunter.' }),
      ),
    );
    return;
  }
  const catalog = createCatalog(/** @type {any[]} */ (units));

  /** @type {ReturnType<typeof createApp>|null} */
  let app = null;
  let writeErrorShown = false;
  const { backend, persistent } = getBrowserBackend(window);
  const storage = createStorage({
    backend,
    now,
    onError: (error) => {
      console.error(error);
      if (writeErrorShown) return;
      writeErrorShown = true;
      app?.notify({ tone: 'error', text: 'Speichern fehlgeschlagen – ist der Gerätespeicher voll?' });
    },
  });
  const loaded = storage.load();

  const store = createStore(loaded.state);
  const theme = createThemeController({ doc: document, win: window });
  theme.set(loaded.state.profile.theme);

  store.subscribe((state, previous) => {
    storage.save(state);
    if (state.profile.theme !== previous.profile.theme) theme.set(state.profile.theme);
  });
  window.addEventListener('pagehide', () => storage.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') storage.flush();
  });

  app = createApp({ root, store, catalog, version: VERSION, win: window });
  const notice = persistent ? storageNotice(loaded.notice) : storageNotice({ code: 'unavailable' });
  if (notice) app.notify(notice);
  app.start();
}

boot();
