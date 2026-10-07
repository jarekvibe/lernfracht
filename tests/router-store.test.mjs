import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDebugEnabled, matchRoute, parseHash } from '../src/ui/router.js';
import { createStore } from '../src/store.js';
import { isDateString, toLocalDateString } from '../src/engine/dates.js';

test('parseHash splits path and query', () => {
  assert.deepEqual(parseHash('#/home'), { path: '/home', query: {} });
  assert.deepEqual(parseHash('#/debug/questions?debug=1'), { path: '/debug/questions', query: { debug: '1' } });
  assert.deepEqual(parseHash('#/cando/lf14-2/'), { path: '/cando/lf14-2', query: {} });
  assert.deepEqual(parseHash(''), { path: '', query: {} });
  assert.deepEqual(parseHash('#'), { path: '', query: {} });
  assert.deepEqual(parseHash('#//home'), { path: '/home', query: {} });
});

test('matchRoute resolves params and rejects unknown paths', () => {
  const routes = [{ path: '/home' }, { path: '/cando/:unitId' }, { path: '/debug/questions' }];
  assert.deepEqual(matchRoute(routes, '/home'), { route: routes[0], params: {} });
  assert.deepEqual(matchRoute(routes, '/cando/lf14-2'), { route: routes[1], params: { unitId: 'lf14-2' } });
  assert.equal(matchRoute(routes, '/cando'), null);
  assert.equal(matchRoute(routes, '/nope'), null);
  assert.equal(matchRoute(routes, '/cando/%E0%A4%A'), null, 'malformed escape is not a match');
});

test('debug flag from page URL or hash query', () => {
  assert.equal(isDebugEnabled('?debug=1', {}), true);
  assert.equal(isDebugEnabled('', { debug: '1' }), true);
  assert.equal(isDebugEnabled('', {}), false);
  assert.equal(isDebugEnabled('?debug=0', { debug: 'true' }), false);
});

test('store notifies subscribers with next and previous state', () => {
  const store = createStore({ n: 1 });
  const seen = [];
  const unsubscribe = store.subscribe((next, prev) => seen.push([prev.n, next.n]));
  store.update((s) => ({ n: s.n + 1 }));
  store.update((s) => s); // same object → no notification
  unsubscribe();
  store.update((s) => ({ n: s.n + 1 }));
  assert.deepEqual(seen, [[1, 2]]);
  assert.equal(store.get().n, 3);
});

test('dates: local formatting and calendar validation', () => {
  assert.equal(toLocalDateString(new Date(2026, 0, 5, 0, 0, 1)), '2026-01-05');
  assert.equal(toLocalDateString(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
  assert.equal(isDateString('2026-11-20'), true);
  assert.equal(isDateString('2028-02-29'), true);
  assert.equal(isDateString('2026-02-29'), false);
  assert.equal(isDateString('2026-13-01'), false);
  assert.equal(isDateString('20.11.2026'), false);
  assert.equal(isDateString(20261120), false);
});
