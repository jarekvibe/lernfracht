// Versions-Migrationen für den gespeicherten Zustand (`lernfracht.state.v1`).
// Neue Version: CURRENT_VERSION erhöhen und einen Schritt `MIGRATIONS[alteVersion]` ergänzen.

export const CURRENT_VERSION = 1;

/**
 * Migration steps keyed by the version they migrate FROM (`n` → `n + 1`).
 * Each step receives a deep copy and returns the migrated state.
 * @type {Readonly<Record<number, (state: Record<string, any>) => Record<string, any>>>}
 */
export const MIGRATIONS = Object.freeze({});

export class MigrationError extends Error {
  /**
   * @param {'invalid'|'newer'|'missing-step'} code
   * @param {string} message
   * @param {number} [version]
   */
  constructor(code, message, version) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.version = version;
  }
}

/**
 * Brings a parsed state object up to `targetVersion`. Does not mutate the input.
 * @param {unknown} input
 * @param {{migrations?: Record<number, (state: Record<string, any>) => Record<string, any>>, targetVersion?: number}} [options]
 * @returns {{state: Record<string, any>, fromVersion: number}}
 * @throws {MigrationError}
 */
export function migrate(input, { migrations = MIGRATIONS, targetVersion = CURRENT_VERSION } = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new MigrationError('invalid', 'Zustand ist kein Objekt');
  }
  // ASSUMPTION: Ein Objekt ohne `version` stammt aus der Zeit vor dem ersten Release und wird
  // als Version 1 behandelt; fehlende Felder ergänzt anschließend normalizeState().
  let version = input.version === undefined ? 1 : input.version;
  if (!Number.isInteger(version) || version < 1) {
    throw new MigrationError('invalid', `Ungültige Version ${JSON.stringify(input.version)}`);
  }
  if (version > targetVersion) {
    throw new MigrationError('newer', `Version ${version} ist neuer als ${targetVersion}`, version);
  }

  const fromVersion = version;
  /** @type {Record<string, any>} */
  let state = JSON.parse(JSON.stringify(input));
  while (version < targetVersion) {
    const step = migrations[version];
    if (typeof step !== 'function') {
      throw new MigrationError('missing-step', `Keine Migration von Version ${version}`, version);
    }
    state = step(state);
    version += 1;
    state.version = version;
  }
  state.version = version;
  return { state, fromVersion };
}
