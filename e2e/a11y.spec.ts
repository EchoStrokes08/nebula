import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { APP_ROUTES, settle } from './routes';

// Auditoría automática WCAG 2.1 A/AA (F12-002). Sin infracciones graves ni críticas.
for (const route of APP_ROUTES) {
  test(`accesibilidad ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route);
    await settle(page);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}
