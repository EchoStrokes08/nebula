import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import path from 'node:path';

import { AUTH_ROUTES, settle } from './routes';

// Build real sin sesión: las rutas protegidas llevan a la bienvenida.
test('sin sesión, una ruta protegida lleva a la bienvenida', async ({ page }) => {
  await page.goto('/habitos');
  await settle(page);
  await expect(page).toHaveURL(/\/bienvenida$/);
});

test('el registro valida antes de enviar', async ({ page }) => {
  await page.goto('/registro');
  await settle(page);
  await page.getByRole('textbox', { name: 'Correo', exact: true }).fill('no-es-un-email');
  await page.getByRole('button', { name: /crear cuenta/i }).click();
  await expect(page.getByText('Introduce un correo válido.')).toBeVisible();
});

for (const route of AUTH_ROUTES) {
  test(`accesibilidad y captura ${route}`, async ({ page }) => {
    for (const size of [{ n: 'android-390', w: 390, h: 844 }, { n: 'escritorio-1280', w: 1280, h: 800 }]) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.goto(route);
      await settle(page);
      if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, `${size.n}${route.replace(/\//g, '-')}.png`) });
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}
