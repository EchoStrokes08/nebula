// Actualizaciones de escritorio sin servidor propio: la web publica `version.json` con la última
// versión y la release de GitHub guarda el AppImage. Solo se descargan URLs de este repositorio.
const UPDATE_INFO_URL = 'https://echostrokes08.github.io/nebula/version.json';
const RELEASES_URL = 'https://github.com/EchoStrokes08/nebula/releases/latest';
const DOWNLOAD_PREFIXES = ['https://github.com/EchoStrokes08/nebula/releases/', 'https://echostrokes08.github.io/nebula/'];

const parts = (v) => String(v).split('.').map((n) => Number.parseInt(n, 10) || 0);
/** true si `latest` es una versión posterior a `current` (X.Y.Z). */
function isNewer(latest, current) {
  const a = parts(latest); const b = parts(current);
  for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); }
  return false;
}

/** Valida `version.json`; devuelve null si no tiene la forma esperada. */
function parseUpdateInfo(data) {
  if (!data || typeof data !== 'object') return null;
  const { version, notes, linux } = data;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  return { version, notes: typeof notes === 'string' ? notes.slice(0, 500) : '', linux: isAllowedDownload(linux) ? linux : null };
}

function isAllowedDownload(url) {
  return typeof url === 'string' && DOWNLOAD_PREFIXES.some((p) => url.startsWith(p)) && !url.includes('..');
}

/** Un AppImage tipo 2 es un ELF con la marca «AI\x02» en el byte 8. */
function looksLikeAppImage(header) {
  return header.length >= 11 && header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46 && header[8] === 0x41 && header[9] === 0x49 && header[10] === 0x02;
}

module.exports = { UPDATE_INFO_URL, RELEASES_URL, isNewer, parseUpdateInfo, isAllowedDownload, looksLikeAppImage };
