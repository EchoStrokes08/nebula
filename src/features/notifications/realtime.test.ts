import { shouldAlertSocial } from './realtime';

jest.mock('@/data/supabase', () => ({ supabase: null }));
jest.mock('@/platform/notifications', () => ({ notifications: { show: jest.fn() } }));

it('respeta la preferencia social y las horas de silencio', () => {
  const base = { social: true, quietStart: '22:00', quietEnd: '07:00', tz: 'UTC' };
  expect(shouldAlertSocial(base, 12 * 60)).toBe(true);
  expect(shouldAlertSocial(base, 23 * 60)).toBe(false);
  expect(shouldAlertSocial({ ...base, social: false }, 12 * 60)).toBe(false);
  expect(shouldAlertSocial(null)).toBe(false);
});
