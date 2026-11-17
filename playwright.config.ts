import { defineConfig } from '@playwright/test';

/**
 * E2E del build web (base del escritorio). Dos builds:
 * - `preview`: sin servidor (EXPO_PUBLIC_DEV_PREVIEW_UI=1) → recorre la app sin datos reales.
 * - `dist`: el build real → pantallas de autenticación y, con credenciales E2E_*, flujos completos.
 * Preparar con `npm run e2e:build`.
 */
const PREVIEW = 4301;
const DIST = 4302;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 2,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: [
    { command: `node scripts/serve-static.mjs .e2e/preview ${PREVIEW}`, port: PREVIEW, reuseExistingServer: true },
    { command: `node scripts/serve-static.mjs dist ${DIST}`, port: DIST, reuseExistingServer: true },
  ],
  projects: [
    { name: 'preview', testMatch: /(a11y|keyboard|visual)\.spec\.ts/, use: { baseURL: `http://127.0.0.1:${PREVIEW}` } },
    { name: 'dist', testMatch: /(auth|flows|resilience)\.spec\.ts/, use: { baseURL: `http://127.0.0.1:${DIST}` } },
  ],
});
