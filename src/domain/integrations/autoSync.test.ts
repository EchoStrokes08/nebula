import { DEFAULT_SYNC_MINUTES, parseSyncMinutes, syncDue } from './autoSync';

describe('sincronización automática del calendario', () => {
  it('usa el intervalo por defecto si no hay uno válido', () => {
    expect(parseSyncMinutes(null)).toBe(DEFAULT_SYNC_MINUTES);
    expect(parseSyncMinutes('7')).toBe(DEFAULT_SYNC_MINUTES);
    expect(parseSyncMinutes('abc')).toBe(DEFAULT_SYNC_MINUTES);
    expect(parseSyncMinutes('0')).toBe(0);
    expect(parseSyncMinutes('360')).toBe(360);
  });

  it('decide si toca sincronizar según el intervalo', () => {
    const now = 10 * 3_600_000;
    expect(syncDue(now - 59 * 60_000, 60, now)).toBe(false);
    expect(syncDue(now - 60 * 60_000, 60, now)).toBe(true);
    expect(syncDue(0, 15, now)).toBe(true);
    expect(syncDue(0, 0, now)).toBe(false);
  });
});
