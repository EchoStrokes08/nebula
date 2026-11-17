// Utilidades puras del proceso principal (probadas en links.test.cjs).

/** Traduce un enlace `nebula://ruta?query` a una ruta interna, o null si no está permitida. */
const ALLOWED = /^\/(auth\/callback|captura|enfoque|hoy|habitos|agenda|retos|perfil|notificaciones|revision|reto\/[0-9a-f-]{36}|habito\/[0-9a-f-]{36}|tarea\/[0-9a-f-]{36})$/;
function deepLinkToRoute(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return null; }
  if (u.protocol !== 'nebula:') return null;
  // `nebula://captura` → host «captura»; `nebula:///captura` → pathname «/captura».
  const route = `/${[u.hostname, u.pathname.replace(/^\/+/, '')].filter(Boolean).join('/')}`.replace(/\/+$/, '');
  if (!ALLOWED.test(route)) return null;
  return route + (u.search.length > 1 ? u.search : '');
}

/** Ruta interna permitida (sin consulta) para abrir desde notificaciones. */
const isAllowedRoute = (route) => typeof route === 'string' && ALLOWED.test(route);

/** Busca un enlace nebula:// entre los argumentos (Windows/Linux lo pasan en argv). */
function findDeepLink(argv) {
  return (argv || []).find((a) => typeof a === 'string' && a.startsWith('nebula://')) || null;
}

/** Entrada XDG de inicio automático (Linux). */
function autostartEntry(exec) {
  const quoted = `"${String(exec).replace(/(["\\`$])/g, '\\$1')}"`;
  return ['[Desktop Entry]', 'Type=Application', 'Name=Nebula', 'Comment=Hábitos, tareas y enfoque', `Exec=${quoted} --hidden`, 'X-GNOME-Autostart-enabled=true', ''].join('\n');
}

/** Acelerador global por defecto y validación básica (Electron rechaza los inválidos al registrar). */
const DEFAULT_SHORTCUT = 'CommandOrControl+Alt+N';
function normalizeShortcut(value) {
  if (value === '' || value === null) return '';
  const s = String(value ?? DEFAULT_SHORTCUT).trim();
  if (s.length > 60 || !/^[A-Za-z0-9+]+$/.test(s) || !s.includes('+')) throw new Error('Atajo no válido. Ejemplo: CommandOrControl+Alt+N');
  return s;
}

module.exports = { isAllowedRoute, deepLinkToRoute, findDeepLink, autostartEntry, normalizeShortcut, DEFAULT_SHORTCUT };
