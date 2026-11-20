import { supabase } from '@/data/supabase';

import { exchangeCode, wasExchanged } from './api';

// jest.mock se eleva por encima de los import al transformar.
jest.mock('@/data/supabase', () => ({ supabase: { auth: { exchangeCodeForSession: jest.fn(async () => ({ error: null })) } } }));

it('un código OAuth se canjea una sola vez aunque la vuelta llegue repetida', async () => {
  expect(wasExchanged('abc')).toBe(false);
  await Promise.all([exchangeCode('abc'), exchangeCode('abc')]);
  await exchangeCode('abc');
  expect(supabase!.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  expect(wasExchanged('abc')).toBe(true);
});
