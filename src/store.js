// Minimaler App-Store: ein unveränderlicher Zustand, Updates über reine Funktionen.

/**
 * @template S
 * @param {S} initial
 */
export function createStore(initial) {
  let state = initial;
  /** @type {Set<(state: S, previous: S) => void>} */
  const listeners = new Set();

  return {
    /** @returns {S} */
    get: () => state,
    /**
     * Replaces the state with `fn(state)`. Returning the same object is a no-op.
     * @param {(state: S) => S} fn
     */
    update(fn) {
      const previous = state;
      const next = fn(state);
      if (next === previous) return;
      state = next;
      for (const listener of [...listeners]) listener(state, previous);
    },
    /**
     * @param {(state: S, previous: S) => void} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
