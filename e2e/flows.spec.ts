import { expect, test, type Page } from '@playwright/test';

import { settle } from './routes';

/**
 * Flujos del MVP con cuentas reales (F12-006). Requieren dos cuentas de prueba ya confirmadas:
 *   E2E_EMAIL_A / E2E_PASSWORD_A y E2E_EMAIL_B / E2E_PASSWORD_B (build `dist` con el Supabase real).
 * Sin ellas, la suite se omite y lo indica. Cada ejecución crea datos con un sufijo único.
 */
const A = { email: process.env.E2E_EMAIL_A, password: process.env.E2E_PASSWORD_A };
const B = { email: process.env.E2E_EMAIL_B, password: process.env.E2E_PASSWORD_B };
const run = `e2e-${Date.now().toString(36)}`;
test.skip(!A.email || !A.password, 'Faltan credenciales E2E_EMAIL_A/E2E_PASSWORD_A');
test.use({ viewport: { width: 1280, height: 800 } });

async function signIn(page: Page, who: { email?: string; password?: string }) {
  await page.goto('/entrar');
  await settle(page);
  await page.getByRole('textbox', { name: 'Correo', exact: true }).fill(who.email!);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(who.password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/(hoy|bienvenido)$/, { timeout: 20_000 });
  // Primera vez: recorre el onboarding real (todo omitible salvo el final).
  if (page.url().endsWith('/bienvenido')) {
    for (let i = 0; i < 8 && page.url().endsWith('/bienvenido'); i++) {
      const start = page.getByRole('button', { name: 'Empezar' });
      if (await start.isVisible()) await start.click();
      else await page.getByRole('button', { name: 'Omitir' }).click();
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveURL(/\/hoy$/, { timeout: 20_000 });
  }
}

test('registro de hábito → registro diario → estadística', async ({ page }) => {
  await signIn(page, A);
  await page.goto('/habito/nuevo');
  await settle(page);
  const name = `Leer ${run}`;
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Crear hábito' }).click();
  await expect(page).not.toHaveURL(/\/habito\/nuevo$/, { timeout: 20_000 });
  await page.goto('/hoy');
  await settle(page);
  await page.getByRole('checkbox', { name: `Marcar ${name} como hecho` }).click();
  await expect(page.getByRole('checkbox', { name: `Desmarcar ${name}` })).toBeVisible();
  // Persistencia: tras recargar sigue registrado.
  await page.reload();
  await settle(page);
  await expect(page.getByRole('checkbox', { name: `Desmarcar ${name}` })).toBeVisible();
  await page.goto('/estadisticas');
  await settle(page);
  await expect(page.getByText(/Hábitos cumplidos|cumplimiento/i).first()).toBeVisible();
});

test('tarea vinculada a una meta', async ({ page }) => {
  await signIn(page, A);
  await page.goto('/meta/nueva');
  await settle(page);
  const goal = `Meta ${run}`;
  await page.getByRole('textbox', { name: /Título|Nombre/ }).first().fill(goal);
  await page.getByRole('button', { name: /Crear/ }).last().click();
  await expect(page).not.toHaveURL(/\/meta\/nueva$/, { timeout: 20_000 });
  await page.goto('/tarea/nueva');
  await settle(page);
  await page.getByRole('textbox', { name: 'Qué hay que hacer' }).fill(`Primer paso ${run}`);
  await page.getByRole('button', { name: /Crear|Guardar/ }).last().click();
  await expect(page).not.toHaveURL(/\/tarea\/nueva$/, { timeout: 20_000 });
  await page.goto('/metas');
  await settle(page);
  await expect(page.getByText(goal)).toBeVisible();
});

test('amistad y reto 1 vs. 1 entre dos cuentas', async ({ browser }) => {
  test.skip(!B.email || !B.password, 'Faltan credenciales de la segunda cuenta (E2E_EMAIL_B/E2E_PASSWORD_B)');
  test.setTimeout(180_000);
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await signIn(a, A);
  await signIn(b, B);

  // 1) Amistad: A busca a B por @usuario y envía solicitud; B la acepta (idempotente si ya lo son).
  await b.goto('/amigos');
  await settle(b);
  const nameB = 'QA Nebula B';
  await a.goto('/amigos');
  await settle(a);
  if (!(await a.getByRole('button', { name: `Retar a ${nameB}` }).isVisible().catch(() => false))) {
    await a.getByRole('textbox', { name: 'Buscar por @usuario o nombre' }).fill('qa_nebula_b');
    const add = a.getByRole('button', { name: /^(Añadir|Aceptar)$/ }).first();
    await add.waitFor({ timeout: 15_000 });
    await add.click();
    await expect(a.getByText(/Solicitud enviada|Ahora sois amigos/).first()).toBeVisible({ timeout: 15_000 });
    await b.reload();
    await settle(b);
    const accept = b.getByRole('button', { name: 'Aceptar a QA Nebula A' });
    await accept.waitFor({ timeout: 20_000 });
    await accept.click();
    await expect(b.getByRole('button', { name: 'Retar a QA Nebula A' })).toBeVisible({ timeout: 20_000 });
    await a.reload();
    await settle(a);
  }
  await expect(a.getByRole('button', { name: `Retar a ${nameB}` })).toBeVisible({ timeout: 20_000 });

  // 2) A crea el duelo con su objetivo personal e invita a B.
  await a.getByRole('button', { name: `Retar a ${nameB}` }).click();
  await settle(a);
  await a.getByRole('radio', { name: 'Duelo 1 vs. 1' }).click();
  await a.getByRole('textbox', { name: 'Nombre', exact: true }).fill(`Duelo ${run}`);
  await a.getByRole('textbox', { name: /^Objetivo/ }).fill('60');
  const invitee = a.getByRole('radio', { name: nameB, exact: true });
  if ((await invitee.getAttribute('aria-checked')) !== 'true') await invitee.click();
  await a.getByRole('button', { name: 'Crear y enviar invitaciones' }).click();
  await expect(a).not.toHaveURL(/\/reto\/nuevo/, { timeout: 20_000 });

  // 3) B recibe la invitación, fija su objetivo y acepta las reglas.
  await b.goto('/retos');
  await settle(b);
  await b.getByText(`Duelo ${run}`).first().click({ timeout: 20_000 });
  await settle(b);
  await b.getByRole('textbox', { name: /objetivo personal/i }).fill('45');
  await b.getByRole('button', { name: 'Aceptar las reglas' }).click();
  // Empieza hoy y ya respondieron todos: el duelo está activo y muestra la clasificación a ambos.
  await expect(b.getByText('Clasificación', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
  await a.reload();
  await settle(a);
  await expect(a.getByLabel(/^Posición 1: /).first()).toBeVisible({ timeout: 20_000 });
  await expect(a.getByLabel(/^Posición \d: tú, /)).toBeVisible();
});
