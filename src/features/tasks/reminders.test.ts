import { toDayKey } from '@/lib/dates';

import { reminderInstant } from './reminders';

describe('reminderInstant', () => {
  it('usa la zona horaria del usuario', () => {
    expect(reminderInstant(toDayKey('2026-11-20'), '18:00', 15, 'Europe/Madrid')).toBe('2026-11-20T16:45:00.000Z');
    expect(reminderInstant(toDayKey('2026-11-20'), null, 0, 'America/Bogota')).toBe('2026-11-20T14:00:00.000Z');
    expect(reminderInstant(toDayKey('2026-11-21'), '09:00', 1440, 'Europe/Madrid')).toBe('2026-11-20T08:00:00.000Z');
  });
});
