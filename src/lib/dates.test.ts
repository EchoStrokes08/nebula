import {
  addDays,
  dayKeyOf,
  dayRange,
  diffDays,
  hoursInDay,
  isDayKey,
  startOfDayInstant,
  startOfMonth,
  startOfWeek,
  toDayKey,
  weekdayOf,
} from './dates';

describe('DayKey', () => {
  it('valida fechas reales', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(() => toDayKey('16/11/2026')).toThrow();
  });

  it('el mismo instante es un día distinto según la zona', () => {
    const instant = new Date('2026-11-17T03:30:00Z');
    expect(dayKeyOf(instant, 'Europe/Madrid')).toBe('2026-11-17');
    expect(dayKeyOf(instant, 'America/Bogota')).toBe('2026-11-16');
  });

  it('suma días cruzando meses, años y cambios de hora', () => {
    expect(addDays(toDayKey('2026-03-28'), 2)).toBe('2026-03-30');
    expect(addDays(toDayKey('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(toDayKey('2026-03-01'), -1)).toBe('2026-02-28');
    expect(diffDays(toDayKey('2026-03-01'), toDayKey('2026-04-01'))).toBe(31);
  });

  it('calcula el inicio de semana con lunes o domingo', () => {
    const wed = toDayKey('2026-11-18');
    expect(weekdayOf(wed)).toBe(3);
    expect(startOfWeek(wed, 1)).toBe('2026-11-16');
    expect(startOfWeek(wed, 0)).toBe('2026-11-15');
    expect(startOfWeek(toDayKey('2026-11-16'), 1)).toBe('2026-11-16');
    expect(startOfMonth(wed)).toBe('2026-11-01');
  });

  it('genera rangos inclusivos', () => {
    expect(dayRange(toDayKey('2026-11-29'), toDayKey('2026-12-02'))).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(dayRange(toDayKey('2026-12-02'), toDayKey('2026-12-01'))).toEqual([]);
  });

  it('respeta el DST de Madrid (23 h en marzo, 25 h en octubre) y Bogotá sin DST', () => {
    expect(hoursInDay(toDayKey('2026-03-29'), 'Europe/Madrid')).toBe(23);
    expect(hoursInDay(toDayKey('2026-10-25'), 'Europe/Madrid')).toBe(25);
    expect(hoursInDay(toDayKey('2026-03-29'), 'America/Bogota')).toBe(24);
    expect(startOfDayInstant(toDayKey('2026-07-01'), 'Europe/Madrid').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(startOfDayInstant(toDayKey('2026-07-01'), 'America/Bogota').toISOString()).toBe('2026-07-01T05:00:00.000Z');
  });
});
