import { openInSplit, setSplitActive, useSplit } from './split';

it('solo selecciona cuando la lista está en columnas y limpia al salir', () => {
  expect(openInSplit('habit', 'h1')).toBe(false);
  setSplitActive('habit', true);
  expect(openInSplit('habit', 'h1')).toBe(true);
  expect(useSplit.getState().selected.habit).toBe('h1');
  expect(openInSplit('task', 't1')).toBe(false);
  setSplitActive('habit', false);
  expect(useSplit.getState().selected.habit).toBeNull();
});
