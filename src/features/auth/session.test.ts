import { isExpiry } from './session';

jest.mock('@/data/supabase', () => ({ supabase: null }));

it('solo un cierre no solicitado con sesión previa se explica como caducidad', () => {
  expect(isExpiry('SIGNED_OUT', true, false)).toBe(true);
  expect(isExpiry('SIGNED_OUT', true, true)).toBe(false);
  expect(isExpiry('SIGNED_OUT', false, false)).toBe(false);
  expect(isExpiry('TOKEN_REFRESHED', true, false)).toBe(false);
});
