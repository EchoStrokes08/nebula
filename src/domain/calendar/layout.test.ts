import { layoutColumns } from './layout';

describe('layoutColumns', () => {
  it('reparte columnas solo entre los que se solapan', () => {
    const r = layoutColumns([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 700, end: 720 },
    ]);
    const by = Object.fromEntries(r.map((x) => [x.id, [x.column, x.columns]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
