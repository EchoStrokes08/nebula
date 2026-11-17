import { expect, test } from '@playwright/test';

import { settle } from './routes';

test.use({ viewport: { width: 1280, height: 800 } });

test('Ctrl+1…5 cambia de sección y Ctrl+K abre la captura', async ({ page }) => {
  await page.goto('/hoy');
  await settle(page);
  for (const [key, path] of [['2', '/habitos'], ['3', '/agenda'], ['4', '/retos'], ['5', '/perfil'], ['1', '/hoy']] as const) {
    await page.keyboard.press(`Control+${key}`);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/\/captura$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/hoy$/);
});

test('la navegación lateral se recorre con Tab y tiene foco visible', async ({ page }) => {
  await page.goto('/hoy');
  await settle(page);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '');
    if (label) seen.add(label.trim());
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
    if (/^(Hoy|Hábitos|Agenda|Retos|Perfil)/.test(label.trim())) expect(outline).not.toBe('none');
  }
  for (const s of [/^Capturar/, /^Hoy/, /^Hábitos/]) expect([...seen].some((x) => s.test(x))).toBe(true);
});

test('los diálogos se cierran con Esc', async ({ page }) => {
  await page.goto('/dev/catalogo');
  await settle(page);
  const opener = page.getByRole('button', { name: 'Abrir confirmación' });
  if (!(await opener.count())) test.skip(true, 'El catálogo solo existe en builds de desarrollo');
  await opener.click();
  await expect(page.getByText('Se borrarán también sus registros.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Se borrarán también sus registros.')).toBeHidden();
});
