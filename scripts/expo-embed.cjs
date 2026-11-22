#!/usr/bin/env node
// Envoltorio de `expo export:embed` para el empaquetado JS del APK (lo llama Gradle en lugar de @expo/cli;
// ver plugins/withFastBundle.js). El plugin de React Native pasa siempre `--reset-cache`, así que cada APK
// reempaquetaba todo el JavaScript desde cero (~1 min). Aquí se conserva la caché de Metro y solo se vacía
// si cambió algo que la invalida sin que Metro lo note: variables EXPO_PUBLIC_*, dependencias o configuración.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const FINGERPRINT_INPUTS = ['.env', 'app.json', 'package-lock.json', 'babel.config.js', 'metro.config.js', 'scripts/babel/lucide-imports.js'];

/** Huella de todo lo que debe vaciar la caché de Metro si cambia. */
function fingerprint(dir = root, env = process.env) {
  const hash = crypto.createHash('sha256');
  for (const rel of FINGERPRINT_INPUTS) {
    hash.update(`${rel}\0`);
    try { hash.update(fs.readFileSync(path.join(dir, rel))); } catch { hash.update('ausente'); }
  }
  for (const key of Object.keys(env).filter((k) => k.startsWith('EXPO_')).sort()) hash.update(`${key}=${env[key]}\0`);
  return hash.digest('hex');
}

/** Quita `--reset-cache` si la huella coincide con la del último empaquetado. */
function embedArgs(args, current, previous) {
  return current === previous ? args.filter((a) => a !== '--reset-cache') : args;
}

if (require.main === module) {
  const stampFile = path.join(root, 'node_modules', '.cache', 'nebula-embed.fingerprint');
  const current = fingerprint();
  let previous = null;
  try { previous = fs.readFileSync(stampFile, 'utf8').trim(); } catch { /* primera vez */ }
  const args = embedArgs(process.argv.slice(2), current, previous);
  console.log(args.includes('--reset-cache') ? '[nebula] Caché de Metro vaciada (cambió la configuración).' : '[nebula] Reutilizando la caché de Metro.');
  const cli = require.resolve('@expo/cli', { paths: [path.dirname(require.resolve('expo/package.json', { paths: [root] }))] });
  // La huella se guarda solo si el empaquetado termina bien.
  process.on('exit', (code) => {
    if (code !== 0) return;
    fs.mkdirSync(path.dirname(stampFile), { recursive: true });
    fs.writeFileSync(stampFile, `${current}\n`);
  });
  process.argv = [process.argv[0], cli, ...args];
  require(cli);
}

module.exports = { fingerprint, embedArgs };
