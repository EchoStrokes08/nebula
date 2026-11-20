import { wrapLabel } from './label';

it('reparte el título de la meta en líneas sin cortar palabras', () => {
  expect(wrapLabel('Alcanzar nivel B1 de alemán')).toEqual(['Alcanzar nivel B1 de', 'alemán']);
  expect(wrapLabel('Leer')).toEqual(['Leer']);
  expect(wrapLabel('Dominar análisis de datos junior', 14)).toEqual(['Dominar', 'análisis de', 'datos junior']);
});
