// Proceso principal de Nebula para escritorio (Windows y Linux).
// Sirve el export web de Expo mediante el protocolo privado `app://` y expone al renderer
// solo la API mínima del preload. Ver docs/ARQUITECTURA.md §1.1.
const { app, BrowserWindow, Notification, ipcMain, protocol, safeStorage, shell, net, Tray, Menu, screen, nativeImage, globalShortcut } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readJson, writeJson, safeBounds } = require('./state.cjs');
const { isAllowedRoute, deepLinkToRoute, findDeepLink, autostartEntry, normalizeShortcut, DEFAULT_SHORTCUT } = require('./links.cjs');
const { UPDATE_INFO_URL, RELEASES_URL, isNewer, parseUpdateInfo, looksLikeAppImage } = require('./update.cjs');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
let quitting = false;
let tray = null;
let mainWindow = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const desktopSettings = () => ({ minimizeToTray: false, startWithSystem: false, globalShortcut: DEFAULT_SHORTCUT, ...readJson(settingsFile(), {}) });
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    const url = new URL(event.senderFrame.url);
    if (url.protocol !== 'app:' || url.hostname !== 'nebula') throw new Error('Origen no autorizado');
    return fn(event, ...args);
  });
}

// Las capturas automáticas usan renderizado por software para no depender de la GPU.
if (process.env.NEBULA_SCREENSHOT) app.disableHardwareAcceleration();

const DIST = process.env.NEBULA_SCREENSHOT && process.env.NEBULA_PREVIEW_DIST ? path.resolve(process.env.NEBULA_PREVIEW_DIST) : path.join(__dirname, '..', 'dist');
const SCHEME = 'app';

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// ---- Almacenamiento seguro (sesión) ---------------------------------------------------
// Los valores se cifran con el almacén del sistema (DPAPI en Windows; libsecret/kwallet en
// Linux). Si no hay cifrado disponible, NO se escriben en disco en claro: se guardan solo en
// memoria y la sesión dura mientras la app esté abierta.
const memoryStore = new Map();
const storeFile = () => path.join(app.getPath('userData'), 'secure-store.json');
function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    return {};
  }
}
function writeStore(data) {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(data), { mode: 0o600 });
}
const validKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 200;

handle('secure:get', async (_e, key) => {
  if (!validKey(key)) return null;
  if (memoryStore.has(key)) return memoryStore.get(key);
  const v = readStore()[key];
  if (typeof v !== 'string') return null;
  try {
    const { result } = await safeStorage.decryptStringAsync(Buffer.from(v, 'base64'));
    return result;
  } catch {
    return null;
  }
});
handle('secure:set', async (_e, key, value) => {
  if (!validKey(key) || typeof value !== 'string' || value.length > 1_000_000) throw new Error('Entrada no válida');
  const data = readStore();
  if (await safeStorage.isAsyncEncryptionAvailable()) {
    memoryStore.delete(key);
    data[key] = (await safeStorage.encryptStringAsync(value)).toString('base64');
    writeStore(data);
    return { persisted: true };
  }
  memoryStore.set(key, value);
  if (key in data) {
    delete data[key];
    writeStore(data);
  }
  return { persisted: false };
});
handle('secure:remove', (_e, key) => {
  if (!validKey(key)) return;
  memoryStore.delete(key);
  const data = readStore();
  if (key in data) {
    delete data[key];
    writeStore(data);
  }
});

// ---- Notificaciones ----------------------------------------------------------------------
handle('notify', (_e, opts) => {
  if (!Notification.isSupported()) return;
  const title = String(opts?.title ?? '').slice(0, 120);
  const body = String(opts?.body ?? '').slice(0, 400);
  new Notification({ title, body }).show();
});

// Notificaciones programadas: viven en el proceso principal para dispararse aunque la ventana
// esté minimizada (Chromium ralentiza los temporizadores de las ventanas ocultas).
const scheduled = new Map();
const MAX_DELAY = 2_147_000_000;
handle('notify:schedule', (_e, n) => {
  const id = String(n?.id ?? '').slice(0, 120);
  const at = Number(n?.at);
  if (!id || !Number.isFinite(at)) throw new Error('Notificación no válida');
  clearTimeout(scheduled.get(id));
  const delay = at - Date.now();
  if (delay <= 0 || delay > MAX_DELAY) return;
  const title = String(n.title ?? '').slice(0, 120);
  const body = String(n.body ?? '').slice(0, 400);
  const route = isAllowedRoute(n.route) ? n.route : null;
  scheduled.set(
    id,
    setTimeout(() => {
      scheduled.delete(id);
      if (!Notification.isSupported()) return;
      const note = new Notification({ title, body, icon: ICON });
      // Clic → abre la ventana en la pantalla correspondiente.
      note.on('click', () => showRoute(route));
      note.show();
    }, delay),
  );
});
handle('notify:cancel', (_e, id) => {
  clearTimeout(scheduled.get(id));
  scheduled.delete(id);
});
handle('notify:cancelPrefix', (_e, prefix) => {
  for (const [id, t] of scheduled) {
    if (id.startsWith(String(prefix))) {
      clearTimeout(t);
      scheduled.delete(id);
    }
  }
});

// ---- OAuth (RFC 8252: retorno por loopback) ----------------------------------------------
// Puerto fijo para que la URL de retorno pueda estar en la lista de Supabase:
//   http://127.0.0.1:47913/auth/callback
const OAUTH_PORT = 47913;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;
let oauthServer = null;
let oauthWaiter = null;

const CALLBACK_PAGE = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Nebula</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0B0815;color:#F7F4FF;font-family:system-ui,sans-serif">
<div style="text-align:center"><div style="width:14px;height:14px;border-radius:50%;background:#8055E8;margin:0 auto 16px"></div>
<h1 style="font-weight:600;font-size:22px;margin:0 0 8px">Listo</h1><p style="color:#B5AAC8;margin:0">Puedes cerrar esta pestaña y volver a Nebula.</p></div></body></html>`;

function stopOAuthServer() {
  if (oauthServer) oauthServer.close();
  oauthServer = null;
}

handle('oauth:listen', async () => {
  stopOAuthServer();
  oauthServer = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${OAUTH_PORT}`);
    if (url.pathname !== '/auth/callback') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(CALLBACK_PAGE);
    const waiter = oauthWaiter;
    oauthWaiter = null;
    stopOAuthServer();
    if (waiter) waiter(url.toString());
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  await new Promise((resolve, reject) => {
    oauthServer.once('error', (e) =>
      reject(new Error(e.code === 'EADDRINUSE' ? `El puerto ${OAUTH_PORT} está ocupado por otra aplicación.` : e.message)),
    );
    oauthServer.listen(OAUTH_PORT, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${OAUTH_PORT}/auth/callback`;
});

handle('oauth:open', async (_e, authUrl) => {
  const u = new URL(String(authUrl));
  // Solo se abren URLs de autorización de Supabase por HTTPS.
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co') || !u.pathname.startsWith('/auth/v1/authorize')) {
    stopOAuthServer();
    throw new Error('URL de autorización no permitida');
  }
  if (!oauthServer) throw new Error('El servidor de retorno no está activo');
  const result = new Promise((resolve) => {
    oauthWaiter = resolve;
    setTimeout(() => {
      if (oauthWaiter === resolve) {
        oauthWaiter = null;
        stopOAuthServer();
        resolve(null);
      }
    }, OAUTH_TIMEOUT_MS);
  });
  await shell.openExternal(u.toString());
  return result;
});

// ---- Ventana -------------------------------------------------------------------------------
function createWindow({ offscreen = false, width = 1280, height = 820 } = {}) {
  const win = new BrowserWindow({
    ...(offscreen ? { width, height } : safeBounds(readJson(path.join(app.getPath('userData'), 'window.json'), {}), screen.getAllDisplays().map((d) => d.workArea))),
    minWidth: 400,
    useContentSize: true,
    enableLargerThanScreen: offscreen,
    minHeight: 560,
    backgroundColor: '#0B0815',
    title: 'Nebula',
    icon: ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
      offscreen, // solo para capturas automáticas de revisión visual
    },
  });
  win.once('ready-to-show', () => win.show());
  if (!offscreen) {
    mainWindow = win;
    let saveTimer;
    const saveBounds = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (!win.isDestroyed() && !win.isMinimized()) writeJson(path.join(app.getPath('userData'), 'window.json'), win.getNormalBounds()); }, 300); };
    win.on('resize', saveBounds); win.on('move', saveBounds);
    win.on('close', (event) => { if (!quitting && tray && desktopSettings().minimizeToTray) { event.preventDefault(); win.hide(); } });
    win.on('closed', () => { clearTimeout(saveTimer); mainWindow = null; });
  }


  // Enlaces externos → navegador del sistema; no se navega fuera de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://nebula/`)) event.preventDefault();
  });

  win.loadURL(`${SCHEME}://nebula/`);
  return win;
}

/** Lleva la ventana principal al frente y, si se indica, navega a una ruta interna. */
function showRoute(route) {
  const win = mainWindow || createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (route) {
    const go = () => win.webContents.executeJavaScript(`window.history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));`).catch(() => {});
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', go); else go();
  }
}

// ---- Mini-ventana de enfoque «siempre visible» (sustituto del widget de Android, F11-009) ----
let miniWindow = null;
handle('focus:mini', () => {
  if (miniWindow && !miniWindow.isDestroyed()) { miniWindow.show(); miniWindow.focus(); return; }
  const { workArea } = screen.getPrimaryDisplay();
  miniWindow = new BrowserWindow({
    width: 300, height: 230, x: workArea.x + workArea.width - 320, y: workArea.y + 20,
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true,
    title: 'Nebula · Enfoque', icon: ICON, backgroundColor: '#0B0815', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  miniWindow.setAlwaysOnTop(true, 'floating');
  miniWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  miniWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${SCHEME}://nebula/`)) event.preventDefault(); });
  miniWindow.on('closed', () => { miniWindow = null; });
  miniWindow.loadURL(`${SCHEME}://nebula/enfoque?mini=1`);
});
handle('focus:openMain', () => showRoute('/enfoque'));

// ---- Atajo global configurable (F11-008) ----------------------------------------------------
let registeredShortcut = null;
function applyGlobalShortcut(accelerator) {
  if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
  registeredShortcut = null;
  if (!accelerator) return true;
  const ok = globalShortcut.register(accelerator, () => showRoute('/captura'));
  if (ok) registeredShortcut = accelerator;
  return ok;
}

// ---- Actualizaciones ------------------------------------------------------------------------
// El proceso principal consulta version.json (el renderer no puede: CSP) y, en Linux con
// AppImage, descarga el nuevo, lo verifica, sustituye el actual y reinicia. En otro caso abre
// la página de descargas. La URL de descarga nunca la decide el renderer.
async function fetchUpdateInfo() {
  const r = await net.fetch(`${UPDATE_INFO_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return parseUpdateInfo(await r.json());
}
// NEBULA_PRETEND_VERSION solo sirve para probar el actualizador con una versión ya publicada.
const currentVersion = () => (/^\d+\.\d+\.\d+$/.test(process.env.NEBULA_PRETEND_VERSION ?? '') ? process.env.NEBULA_PRETEND_VERSION : app.getVersion());
const canSelfUpdate = () => process.platform === 'linux' && !!process.env.APPIMAGE;
let updating = false;
handle('update:check', async () => {
  try {
    const info = await fetchUpdateInfo();
    if (!info || !isNewer(info.version, currentVersion())) return null;
    return { current: currentVersion(), latest: info.version, notes: info.notes, canInstall: canSelfUpdate() && !!info.linux };
  } catch { return null; }
});
handle('update:install', async () => {
  if (updating) return { status: 'busy' };
  updating = true;
  const target = process.env.APPIMAGE;
  const temp = target ? `${target}.download` : null;
  try {
    const info = await fetchUpdateInfo();
    if (!info || !info.linux || !canSelfUpdate()) { await shell.openExternal(RELEASES_URL); return { status: 'opened' }; }
    const r = await net.fetch(info.linux, { redirect: 'follow' });
    if (!r.ok || !r.body) throw new Error(`descarga ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(temp, { mode: 0o755 }));
    const fd = fs.openSync(temp, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
    if (!looksLikeAppImage(head) || fs.statSync(temp).size < 20 * 1024 * 1024) throw new Error('el archivo descargado no es un AppImage');
    fs.chmodSync(temp, 0o755);
    fs.renameSync(temp, target); // el proceso actual sigue usando el archivo antiguo hasta reiniciar
    setTimeout(() => { quitting = true; app.relaunch({ execPath: target, args: [] }); app.exit(0); }, 300);
    return { status: 'restarting' };
  } catch (e) {
    if (temp) fs.rmSync(temp, { force: true });
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  } finally { updating = false; }
});

// ---- Inicio con el sistema en Linux (XDG autostart) ------------------------------------------
const autostartFile = () => path.join(process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config'), 'autostart', 'nebula.desktop');
const linuxExec = () => process.env.APPIMAGE || process.execPath;
function setLinuxAutostart(enabled) {
  if (enabled) {
    fs.mkdirSync(path.dirname(autostartFile()), { recursive: true });
    fs.writeFileSync(autostartFile(), autostartEntry(linuxExec()), { mode: 0o644 });
  } else if (fs.existsSync(autostartFile())) fs.unlinkSync(autostartFile());
}

const CSP = [
  "default-src 'self'",
  // El bundle de desarrollo de Expo usa eval; solo se permite con NEBULA_DEV=1.
  process.env.NEBULA_DEV === '1' ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
].join('; ');

// ---- Enlaces nebula:// (recuperación de contraseña, accesos directos) -------------------------
// Una sola instancia: los enlaces abiertos con la app en marcha llegan como `second-instance`.
if (!process.env.NEBULA_SCREENSHOT) {
  if (!app.requestSingleInstanceLock()) app.quit();
  app.on('second-instance', (_event, argv) => showRoute(deepLinkToRoute(findDeepLink(argv))));
  if (process.defaultApp && process.argv.length >= 2) app.setAsDefaultProtocolClient('nebula', process.execPath, [path.resolve(process.argv[1])]);
  else app.setAsDefaultProtocolClient('nebula');
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, async (request) => {
    const { pathname, hostname } = new URL(request.url);
    if (hostname !== 'nebula') return new Response('Forbidden', { status: 403 });
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    let file = path.normalize(path.join(DIST, rel));
    // Evita salir de dist y aplica el fallback SPA a index.html.
    if (!(file === DIST || file.startsWith(DIST + path.sep)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    const response = await net.fetch(pathToFileURL(file).toString());
    if (file.endsWith('.html')) {
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', CSP);
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  });

  if (process.env.NEBULA_SCREENSHOT) {
    require(process.env.NEBULA_PROBE || './screenshot.cjs')(createWindow, process.env.NEBULA_SCREENSHOT);
    return;
  }
  const startHidden = process.argv.includes('--hidden') && desktopSettings().minimizeToTray;
  const win = createWindow();
  if (startHidden) win.once('ready-to-show', () => win.hide());
  const initialLink = deepLinkToRoute(findDeepLink(process.argv));
  if (initialLink) showRoute(initialLink);
  try { applyGlobalShortcut(desktopSettings().globalShortcut); } catch { /* acelerador inválido guardado */ }
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 22, height: 22 });
    tray = new Tray(icon); tray.setToolTip('Nebula');
    const show = showRoute;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Abrir Nebula', click: () => show() },
      { label: 'Captura rápida', click: () => show('/captura') },
      { label: 'Iniciar enfoque', click: () => show('/enfoque') },
      { type: 'separator' },
      { label: 'Salir', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', () => show());
  } catch { tray = null; }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.env.NEBULA_SCREENSHOT) return; // la utilidad de capturas cierra la app al terminar
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
const canAutostart = () => process.platform === 'win32' || (process.platform === 'linux' && app.isPackaged);
handle('settings:get', () => ({ ...desktopSettings(), canStartWithSystem: canAutostart(), trayAvailable: !!tray, shortcutActive: !!registeredShortcut }));
handle('settings:set', (_event, patch) => {
  const previous = desktopSettings();
  const settings = {
    minimizeToTray: typeof patch?.minimizeToTray === 'boolean' ? patch.minimizeToTray : previous.minimizeToTray,
    startWithSystem: typeof patch?.startWithSystem === 'boolean' ? patch.startWithSystem : previous.startWithSystem,
    globalShortcut: patch && 'globalShortcut' in patch ? normalizeShortcut(patch.globalShortcut) : previous.globalShortcut,
  };
  if (settings.minimizeToTray && !tray) throw new Error('El sistema no dispone de bandeja.');
  if (settings.startWithSystem !== previous.startWithSystem) {
    if (!canAutostart()) throw new Error('El inicio automático solo está disponible en la app instalada.');
    if (process.platform === 'win32') app.setLoginItemSettings({ openAtLogin: settings.startWithSystem, args: ['--hidden'] });
    else setLinuxAutostart(settings.startWithSystem);
  }
  if (settings.globalShortcut !== previous.globalShortcut && !applyGlobalShortcut(settings.globalShortcut)) {
    applyGlobalShortcut(previous.globalShortcut);
    throw new Error('Ese atajo ya lo usa otra aplicación o no es válido.');
  }
  writeJson(settingsFile(), settings);
  return settings;
});
