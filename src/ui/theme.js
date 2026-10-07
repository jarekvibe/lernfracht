// Theme-Umschaltung: Dunkel (Default) · Hell · System.

/**
 * @param {'dark'|'light'|'system'} preference
 * @param {boolean} systemPrefersLight
 * @returns {'dark'|'light'}
 */
export function resolveTheme(preference, systemPrefersLight) {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference === 'light' ? 'light' : 'dark';
}

/**
 * Applies the theme to <html data-theme> and keeps "System" in sync with the OS.
 * @param {{doc?: Document, win?: Window}} [deps]
 */
export function createThemeController({ doc = document, win = window } = {}) {
  const query = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: light)') : null;
  /** @type {'dark'|'light'|'system'} */
  let preference = 'dark';

  function apply() {
    const root = doc.documentElement;
    root.dataset.theme = resolveTheme(preference, Boolean(query?.matches));
    const bg = win.getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }

  query?.addEventListener?.('change', () => {
    if (preference === 'system') apply();
  });

  return {
    /** @param {'dark'|'light'|'system'} next */
    set(next) {
      preference = next;
      apply();
    },
  };
}
