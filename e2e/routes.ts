/** Rutas revisadas en las auditorías (vista previa, sin servidor). */
export const APP_ROUTES = [
  '/hoy', '/habitos', '/agenda', '/retos', '/perfil',
  '/habito/nuevo', '/tarea/nueva', '/meta/nueva', '/evento/nuevo', '/reto/nuevo',
  '/metas', '/simulador', '/planificar', '/disponibilidad', '/enfoque', '/estadisticas', '/revision',
  '/amigos', '/circulos', '/notificaciones', '/configuracion', '/captura', '/asistente', '/sincronizacion',
  '/salas', '/diario', '/constelacion', '/integraciones',
];
export const AUTH_ROUTES = ['/bienvenida', '/entrar', '/registro', '/recuperar'];

/** Espera a que React haya pintado la pantalla (fuentes y primer render). */
export async function settle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(800);
}
