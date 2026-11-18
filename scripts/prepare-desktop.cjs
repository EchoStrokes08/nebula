// Prepara una aplicación Electron mínima: el renderer ya contiene sus dependencias en dist.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.desktop-app');
const metadata = require('../package.json');
// La versión publicada es la de app.json (la que sube `npm run release`), igual que en Android.
const version = require('../app.json').expo.version;
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) throw new Error('Ejecuta npm run build:web antes de preparar el escritorio.');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.join(target, 'desktop'), { recursive: true });
fs.mkdirSync(path.join(target, 'assets'), { recursive: true });
for (const file of ['main.cjs', 'preload.cjs', 'state.cjs', 'links.cjs']) fs.copyFileSync(path.join(root, 'desktop', file), path.join(target, 'desktop', file));
fs.cpSync(path.join(root, 'dist'), path.join(target, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(target, 'assets', 'icon.png'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: metadata.name, version, description: metadata.description, author: metadata.author, main: 'desktop/main.cjs', desktopName: metadata.desktopName, private: true }, null, 2));
console.log('Aplicación de escritorio preparada sin herramientas de desarrollo ni secretos.');
