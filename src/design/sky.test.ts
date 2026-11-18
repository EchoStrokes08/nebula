import { dailyLayout, resolveSky, skyForHour } from './sky';

describe('cielos', () => {
  it('cambia de cielo según la franja del día', () => {
    expect(skyForHour(7)).toBe('aurora');
    expect(skyForHour(12)).toBe('azur');
    expect(skyForHour(19)).toBe('ocaso');
    expect(skyForHour(23)).toBe('nebulosa');
    expect(skyForHour(3)).toBe('nebulosa');
  });
  it('respeta el cielo elegido', () => {
    expect(resolveSky('boreal', new Date(2026, 10, 17, 12)).id).toBe('boreal');
    expect(resolveSky('auto', new Date(2026, 10, 17, 12)).id).toBe('azur');
  });
  it('compone una galaxia estable por día y distinta entre días', () => {
    const a = dailyLayout(new Date(2026, 10, 17, 8));
    expect(dailyLayout(new Date(2026, 10, 17, 22))).toEqual(a);
    const days = Array.from({ length: 10 }, (_, i) => JSON.stringify(dailyLayout(new Date(2026, 10, 18 + i))));
    expect(new Set(days).size).toBeGreaterThan(5);
    expect(a.arms).toBeGreaterThanOrEqual(2);
    expect(a.arms).toBeLessThanOrEqual(4);
  });
});
