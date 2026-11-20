import { filterOptions } from './Select';

it('el buscador del selector ignora mayúsculas y tildes', () => {
  const opts = [{ value: 'a', label: 'Gramática básica A1' }, { value: 'b', label: 'Práctica de SQL', description: 'Datos' }, { value: 'c', label: 'Leer' }];
  expect(filterOptions(opts, 'gramatica').map((o) => o.value)).toEqual(['a']);
  expect(filterOptions(opts, 'PRACT').map((o) => o.value)).toEqual(['b']);
  expect(filterOptions(opts, 'datos').map((o) => o.value)).toEqual(['b']);
  expect(filterOptions(opts, '  ')).toHaveLength(3);
});
