import { expect, test } from '@playwright/test';

import { settle } from './routes';

// F12-005: sesión caducada, sin conexión y conexión lenta (build real, sin cuentas).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;

test('una sesión caducada que no se puede renovar vuelve a la bienvenida sin bloquearse', async ({ page }) => {
  await page.goto('/bienvenida');
  await settle(page);
  test.skip(!url, 'Define EXPO_PUBLIC_SUPABASE_URL (npm run e2e lo toma de .env) para conocer la clave de sesión');
  const host = new URL(url!).hostname.split('.')[0];
  const storageKey = `sb-${host}-auth-token`;
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
    access_token: 'caducado', refresh_token: 'invalido', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 3600, user: { id: '00000000-0000-0000-0000-000000000000', aud: 'authenticated', role: 'authenticated' },
  })), storageKey);
  await page.goto('/hoy');
  await settle(page);
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 20_000 });
  expect(await page.evaluate((k) => localStorage.getItem(k), storageKey)).toBeNull();
});

test('sin conexión, la app arranca y muestra la entrada sin errores', async ({ page, context }) => {
  await page.goto('/entrar');
  await settle(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.setOffline(true);
  await page.getByRole('textbox', { name: 'Correo', exact: true }).fill('alguien@example.com');
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('una-contraseña-larga-1');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/conexión|red|internet/i).first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test('con una conexión lenta el formulario muestra que está trabajando y no duplica envíos', async ({ page }) => {
  let calls = 0;
  await page.route('**/auth/v1/token**', async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 3000));
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
  });
  await page.goto('/entrar');
  await settle(page);
  await page.getByRole('textbox', { name: 'Correo', exact: true }).fill('alguien@example.com');
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('una-contraseña-larga-1');
  const button = page.getByRole('button', { name: 'Entrar' });
  await button.click();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await button.click({ force: true }).catch(() => {});
  await expect(page.getByText(/correo o la contraseña|credenciales/i).first()).toBeVisible({ timeout: 15_000 });
  expect(calls).toBe(1);
});
