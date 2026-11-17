import { formatDuration, hhmm, minutesOf, normalizeTime } from './time';

describe('horas', () => {
  it('normaliza entradas habituales', () => {
    expect(normalizeTime('8')).toBe('08:00');
    expect(normalizeTime('8:5')).toBeNull();
    expect(normalizeTime('18.30')).toBe('18:30');
    expect(normalizeTime('1830')).toBe('18:30');
    expect(normalizeTime('24:00')).toBeNull();
  });
  it('convierte y formatea', () => {
    expect(minutesOf('09:30')).toBe(570);
    expect(hhmm(570)).toBe('09:30');
    expect(formatDuration(95)).toBe('1 h 35 min');
    expect(formatDuration(120)).toBe('2 h');
  });
});
