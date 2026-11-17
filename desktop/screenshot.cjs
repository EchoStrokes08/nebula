// Utilidad de desarrollo: abre la app con varios tamaños y guarda capturas para revisión visual.
// Uso: NEBULA_SCREENSHOT=<carpeta> electron desktop/main.cjs
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SIZES = [
  { name: 'escritorio-1280', width: 1280, height: 800 },
  { name: 'android-390', width: 390, height: 844 },
];
const ROUTES = (process.env.NEBULA_ROUTES || '/').split(',');

module.exports = function capture(createWindow, outDir) {
  run(createWindow, outDir).catch((e) => {
    console.error('[captura] fallo:', e && e.stack ? e.stack : e);
    app.exit(1);
  });
};

async function run(createWindow, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of SIZES) {
    // Una ventana por tamaño: en modo offscreen el redimensionado no cambia el lienzo.
    const win = createWindow({ offscreen: true, width: size.width, height: size.height });
    win.setContentSize(size.width, size.height);
    win.webContents.on('console-message', (e) => {
      if (e.level === 'error') console.error('[renderer]', e.message);
    });
    // En modo offscreen la imagen se obtiene del evento `paint` (capturePage no es fiable).
    let lastFrame = null;
    win.webContents.setFrameRate(10);
    win.webContents.on('paint', (_e, _dirty, image) => {
      lastFrame = image;
    });
    await new Promise((r) => win.webContents.once('did-finish-load', r));
    for (const route of ROUTES) {
      await win.webContents.executeJavaScript(
        `window.history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'));`,
      );
      await new Promise((r) => setTimeout(r, 1500));
      win.webContents.invalidate();
      await new Promise((r) => setTimeout(r, 300));
      if (!lastFrame) throw new Error('No se recibió ningún fotograma');
      const slug = route === '/' ? 'hoy' : route.replace(/\//g, '');
      fs.writeFileSync(path.join(outDir, `${size.name}-${slug}.png`), lastFrame.toPNG());
    }
    win.destroy();
  }
  app.quit();
}
