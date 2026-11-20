import { freeMinutes, freeWindows, fromLegacyWindows } from './schedule';

describe('horario: tu día menos cuando estás ocupado', () => {
  const days = [1, 2, 6].map((weekday) => ({ weekday, start: '07:00', end: '22:00' }));
  const busy = [
    { label: 'Universidad', weekdays: [1, 2], start: '08:00', end: '12:00' },
    { label: 'Trabajo', weekdays: [2], start: '14:00', end: '18:00' },
  ];

  it('resta los bloques ocupados de cada día', () => {
    const free = freeWindows(days, busy);
    expect(free.filter((w) => w.weekday === 1)).toEqual([{ weekday: 1, start: '07:00', end: '08:00' }, { weekday: 1, start: '12:00', end: '22:00' }]);
    expect(free.filter((w) => w.weekday === 2)).toHaveLength(3);
    expect(free.filter((w) => w.weekday === 6)).toEqual([{ weekday: 6, start: '07:00', end: '22:00' }]);
    expect(freeMinutes(free, 1)).toBe(60 + 600);
  });

  it('descarta huecos de menos de 15 min y bloques que tapan el día entero', () => {
    const free = freeWindows([{ weekday: 1, start: '08:00', end: '12:00' }], [{ label: 'X', weekdays: [1], start: '08:10', end: '13:00' }]);
    expect(free).toEqual([]);
  });

  it('admite el día hasta medianoche', () => {
    expect(freeWindows([{ weekday: 0, start: '20:00', end: '24:00' }], [])).toEqual([{ weekday: 0, start: '20:00', end: '23:59' }]);
  });

  it('convierte las franjas libres antiguas y vuelve a dar las mismas', () => {
    const legacy = [
      { weekday: 1, start: '07:00', end: '08:00' }, { weekday: 1, start: '12:00', end: '22:00' },
      { weekday: 2, start: '07:00', end: '08:00' }, { weekday: 2, start: '12:00', end: '22:00' },
      { weekday: 5, start: '09:00', end: '13:00' },
    ];
    const { days: d, busy: b } = fromLegacyWindows(legacy);
    expect(d).toEqual([{ weekday: 1, start: '07:00', end: '22:00' }, { weekday: 2, start: '07:00', end: '22:00' }, { weekday: 5, start: '09:00', end: '13:00' }]);
    expect(b).toEqual([{ label: 'Ocupado', weekdays: [1, 2], start: '08:00', end: '12:00' }]);
    expect(freeWindows(d, b)).toEqual(legacy);
  });
});
