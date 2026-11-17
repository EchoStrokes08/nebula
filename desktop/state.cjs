const fs = require('node:fs');
const path = require('node:path');
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
function safeBounds(saved, displays) {
  const width = Math.max(400, Math.min(3840, Number(saved?.width) || 1280));
  const height = Math.max(560, Math.min(2160, Number(saved?.height) || 820));
  const bounds = { width, height };
  const x = Number(saved?.x), y = Number(saved?.y);
  if (Number.isFinite(x) && Number.isFinite(y) && displays.some((d) => x < d.x + d.width - 80 && y < d.y + d.height - 80 && x + width > d.x + 80 && y + height > d.y + 80)) Object.assign(bounds, { x, y });
  return bounds;
}
module.exports = { readJson, writeJson, safeBounds };
