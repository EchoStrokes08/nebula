import { test } from '@playwright/test';
import path from 'node:path';

import { APP_ROUTES, settle } from './routes';

// Capturas para la auditoría visual (F02-017, F12-001). Con SHOTS_DIR se guardan ahí.
const out = process.env.SHOTS_DIR;
for (const size of [{ name: 'android-390', width: 390, height: 844 }, { name: 'escritorio-1280', width: 1280, height: 800 }, { name: 'escritorio-1920', width: 1920, height: 1080 }]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const route of APP_ROUTES) {
      test(`captura ${route}`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(route);
        await settle(page);
        const file = `${size.name}${route.replace(/\//g, '-')}.png`;
        await page.screenshot({ path: out ? path.join(out, file) : info.outputPath(file) });
        if (errors.length) throw new Error(`Errores en ${route}: ${errors.join(' | ')}`);
      });
    }
  });
}
